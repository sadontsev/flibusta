const { query } = require('./connection');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

async function createSessionsTable() {
    try {
        // Create sessions table for PostgreSQL session store
        await query(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid VARCHAR NOT NULL COLLATE "default",
                sess JSON NOT NULL,
                expire TIMESTAMP(6) NOT NULL
            )
            WITH (OIDS=FALSE);
        `);

        // Create index on sid
        await query(`
            CREATE INDEX IF NOT EXISTS IDX_sessions_sid ON sessions(sid);
        `);

        // Create index on expire
        await query(`
            CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions(expire);
        `);

        logger.info('Sessions table created successfully');
    } catch (error) {
        logger.error('Error creating sessions table:', error);
        throw error;
    }
}

async function createUsersTable() {
    try {
        // Create users table with proper authentication
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                user_uuid VARCHAR(36) UNIQUE NOT NULL,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                display_name VARCHAR(100),
                avatar_url VARCHAR(500)
            );
        `);

        // Create indexes
        await query(`
            CREATE INDEX IF NOT EXISTS IDX_users_username ON users(username);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS IDX_users_email ON users(email);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS IDX_users_role ON users(role);
        `);

        logger.info('Users table created successfully');
    } catch (error) {
        logger.error('Error creating users table:', error);
        throw error;
    }
}

async function createSuperAdmin() {
    try {
        const superAdminUsername = process.env.SUPERADMIN_USERNAME || 'admin';
        const superAdminPassword = process.env.SUPERADMIN_PASSWORD || 'admin123';
        const superAdminEmail = process.env.SUPERADMIN_EMAIL || 'admin@flibusta.local';

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(superAdminPassword, saltRounds);

        // Check if superadmin already exists
        const existingAdmin = await query(`
            SELECT id, username, email FROM users WHERE role = 'superadmin' LIMIT 1
        `);

        if (existingAdmin.rows.length === 0) {
            // Create superadmin if none exists
            await query(`
                INSERT INTO users (user_uuid, username, email, password_hash, role, display_name)
                VALUES (gen_random_uuid(), $1, $2, $3, 'superadmin', 'Super Administrator')
            `, [superAdminUsername, superAdminEmail, passwordHash]);

            logger.info('Superadmin created successfully', { username: superAdminUsername });
        } else {
            // Update existing superadmin with current env credentials
            const existingUser = existingAdmin.rows[0];
            
            await query(`
                UPDATE users 
                SET username = $1, email = $2, password_hash = $3, display_name = $4, updated_at = CURRENT_TIMESTAMP
                WHERE role = 'superadmin'
            `, [superAdminUsername, superAdminEmail, passwordHash, `Super Administrator (${superAdminUsername})`]);

            logger.info('Superadmin credentials updated from environment', { 
                oldUsername: existingUser.username,
                newUsername: superAdminUsername,
                oldEmail: existingUser.email,
                newEmail: superAdminEmail
            });
        }
    } catch (error) {
        logger.error('Error creating/updating superadmin:', error);
        throw error;
    }
}

async function migrateExistingUsers() {
    try {
        // Check if fav_users table exists and has data
        const existingUsers = await query(`
            SELECT user_uuid, name FROM fav_users 
            WHERE user_uuid NOT IN (SELECT user_uuid FROM users)
        `);

        if (existingUsers.rows.length > 0) {
            logger.info(`Migrating ${existingUsers.rows.length} existing users`);
            
            for (const user of existingUsers.rows) {
                // Generate a default password (user will need to reset it)
                const defaultPassword = 'changeme123';
                const passwordHash = await bcrypt.hash(defaultPassword, 12);
                
                await query(`
                    INSERT INTO users (user_uuid, username, password_hash, role, display_name)
                    VALUES ($1, $2, $3, 'user', $4)
                    ON CONFLICT (user_uuid) DO NOTHING
                `, [user.user_uuid, user.name, passwordHash, user.name]);
            }
            
            logger.info('Existing users migrated successfully');
        }
    } catch (error) {
        logger.error('Error migrating existing users:', error);
        // Don't throw error as this is optional
    }
}

async function createUserActivityLog() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS user_activity_log (
                id SERIAL PRIMARY KEY,
                user_uuid VARCHAR(36) NOT NULL,
                action VARCHAR(100) NOT NULL,
                details JSONB,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS IDX_user_activity_user_uuid ON user_activity_log(user_uuid);
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS IDX_user_activity_created_at ON user_activity_log(created_at);
        `);

        logger.info('User activity log table created successfully');
    } catch (error) {
        logger.error('Error creating user activity log table:', error);
        throw error;
    }
}

async function runMigrations() {
    try {
        logger.info('Starting database migrations...');
        
        await createSessionsTable();
        await createUsersTable();
        await createSuperAdmin();
        await migrateExistingUsers();
        await createUserActivityLog();
        
        logger.info('All migrations completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run migrations if this file is executed directly
if (require.main === module) {
    runMigrations();
}

module.exports = {
    createSessionsTable,
    createUsersTable,
    createSuperAdmin,
    migrateExistingUsers,
    createUserActivityLog,
    runMigrations
};
