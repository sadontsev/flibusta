const bcrypt = require('bcryptjs');
const { query } = require('./connection');

async function initSuperadmin() {
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

        if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];
            console.log(`📝 Found existing superadmin user: ${user.username} (${user.role})`);
            
            // Update password and username if needed
            const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            
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
            console.log(`📧 Email: ${email}`);
            
        } else {
            // Create new superadmin user
            const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            
            await query(`
                INSERT INTO users (
                    user_uuid, 
                    username, 
                    email, 
                    password_hash, 
                    role, 
                    is_active, 
                    display_name, 
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    $1, 
                    $2, 
                    $3, 
                    'superadmin', 
                    true, 
                    $4,
                    CURRENT_TIMESTAMP
                )
            `, [
                username,
                email,
                passwordHash,
                `Super Administrator (${username})`
            ]);
            
            console.log(`✅ Superadmin user created successfully`);
            console.log(`🔑 Username: ${username}`);
            console.log(`🔑 Password: ${password}`);
            console.log(`📧 Email: ${email}`);
        }

        // Verify the user exists and can be queried
        const verifyUser = await query(`
            SELECT username, email, role, is_active 
            FROM users 
            WHERE username = $1
        `, [username]);

        if (verifyUser.rows.length > 0) {
            const user = verifyUser.rows[0];
            console.log(`✅ Verification successful: ${user.username} (${user.role}) - Active: ${user.is_active}`);
        } else {
            console.error('❌ Failed to verify superadmin user creation');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error initializing superadmin:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    initSuperadmin().then(() => {
        console.log('🎉 Superadmin initialization completed');
        process.exit(0);
    }).catch((error) => {
        console.error('💥 Superadmin initialization failed:', error);
        process.exit(1);
    });
}

module.exports = { initSuperadmin };
