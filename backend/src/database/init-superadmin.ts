import bcrypt from 'bcryptjs';
import { query } from './connection';
import { v4 as uuidv4 } from 'uuid';

interface SuperadminResult {
    success: boolean;
    message: string;
    user_uuid: string;
    username: string;
}

async function initSuperadmin(): Promise<SuperadminResult> {
    try {
        const username = process.env.SUPERADMIN_USERNAME || 'admin';
        const password = process.env.SUPERADMIN_PASSWORD || 'admin123';
        const email = process.env.SUPERADMIN_EMAIL || 'admin@flibusta.local';
        
        if (!password) {
            console.error('❌ SUPERADMIN_PASSWORD environment variable is required');
            process.exit(1);
        }

        console.log(`🔧 Initializing superadmin user: ${username}`);

        // Check if superadmin user already exists
        const existingUser = await query(`
            SELECT user_uuid, username, email, role 
            FROM users 
            WHERE username = $1 OR role = 'superadmin'
        `, [username]);

        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
        const passwordHash = await bcrypt.hash(password, saltRounds);

        if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0] as any;
            console.log(`📝 Found existing superadmin user: ${user.username} (${user.role})`);
            
            // Update password and username if needed
            await query(`
                UPDATE users 
                SET password_hash = $1, 
                    username = $2,
                    email = $3,
                    display_name = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_uuid = $5
            `, [
                passwordHash, 
                username,
                email, 
                `Super Administrator (${username})`,
                user.user_uuid
            ]);
            
            console.log(`✅ Superadmin password updated successfully`);
            console.log(`🔑 Username: ${username}`);
            console.log(`🔑 Password: ${password}`);
            
            return {
                success: true,
                message: 'Superadmin user updated successfully',
                user_uuid: user.user_uuid,
                username: username
            };
        } else {
            // Create new superadmin user
            const userUuid = uuidv4();
            
            await query(`
                INSERT INTO users (
                    user_uuid, username, email, password_hash, role, 
                    display_name, is_active, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                userUuid,
                username,
                email,
                passwordHash,
                'superadmin',
                `Super Administrator (${username})`,
                true
            ]);
            
            console.log(`✅ Superadmin user created successfully`);
            console.log(`🔑 UUID: ${userUuid}`);
            console.log(`🔑 Username: ${username}`);
            console.log(`🔑 Password: ${password}`);
            console.log(`📧 Email: ${email}`);
            
            return {
                success: true,
                message: 'Superadmin user created successfully',
                user_uuid: userUuid,
                username: username
            };
        }
    } catch (error) {
        console.error('❌ Error initializing superadmin:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    initSuperadmin()
        .then((result) => {
            console.log(`🎉 Initialization completed: ${result.message}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Initialization failed:', error);
            process.exit(1);
        });
}

export default initSuperadmin;