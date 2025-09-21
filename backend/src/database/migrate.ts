import { query } from './connection';
import logger from '../utils/logger';
import bcrypt from 'bcryptjs';

interface MigrationResult {
    success: boolean;
    message: string;
    errors?: string[];
}

async function createSessionsTable(): Promise<void> {
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

async function createUsersTable(): Promise<void> {
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
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        `);

        logger.info('Users table created successfully');
    } catch (error) {
        logger.error('Error creating users table:', error);
        throw error;
    }
}

async function createFavoritesTable(): Promise<void> {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS favorites (
                id SERIAL PRIMARY KEY,
                user_uuid VARCHAR(36) NOT NULL REFERENCES users(user_uuid) ON DELETE CASCADE,
                book_id VARCHAR(50) NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_uuid, book_id)
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_uuid);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_favorites_book ON favorites(book_id);
        `);

        logger.info('Favorites table created successfully');
    } catch (error) {
        logger.error('Error creating favorites table:', error);
        throw error;
    }
}

async function createBookMappingsTable(): Promise<void> {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS book_mappings (
                id SERIAL PRIMARY KEY,
                book_id VARCHAR(50) NOT NULL,
                zip_file VARCHAR(255) NOT NULL,
                internal_path VARCHAR(500) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(book_id, zip_file)
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_book_mappings_book_id ON book_mappings(book_id);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_book_mappings_zip_file ON book_mappings(zip_file);
        `);

        logger.info('Book mappings table created successfully');
    } catch (error) {
        logger.error('Error creating book mappings table:', error);
        throw error;
    }
}

async function createUpdateHistoryTable(): Promise<void> {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS update_history (
                id SERIAL PRIMARY KEY,
                update_type VARCHAR(50) NOT NULL,
                status VARCHAR(20) NOT NULL,
                started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                duration INTEGER, -- in seconds
                records_processed INTEGER DEFAULT 0,
                records_updated INTEGER DEFAULT 0,
                records_failed INTEGER DEFAULT 0,
                error_message TEXT,
                details JSONB,
                triggered_by VARCHAR(50) DEFAULT 'system'
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_update_history_type ON update_history(update_type);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_update_history_status ON update_history(status);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_update_history_started_at ON update_history(started_at);
        `);

        logger.info('Update history table created successfully');
    } catch (error) {
        logger.error('Error creating update history table:', error);
        throw error;
    }
}

async function createUpdateSchedulesTable(): Promise<void> {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS update_schedules (
                id SERIAL PRIMARY KEY,
                schedule_type VARCHAR(50) UNIQUE NOT NULL,
                cron_expression VARCHAR(100) NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT true,
                description TEXT,
                last_run TIMESTAMP,
                next_run TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_update_schedules_type ON update_schedules(schedule_type);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_update_schedules_enabled ON update_schedules(enabled);
        `);

        logger.info('Update schedules table created successfully');
    } catch (error) {
        logger.error('Error creating update schedules table:', error);
        throw error;
    }
}

async function createSearchVectorsColumn(): Promise<void> {
    try {
        // Add search vector column to libbook table for full-text search
        await query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE libbook ADD COLUMN search_vector tsvector;
                EXCEPTION
                    WHEN duplicate_column THEN 
                        -- Column already exists, do nothing
                END;
            END $$;
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_libbook_search_vector ON libbook USING gin(search_vector);
        `);

        logger.info('Search vectors column added successfully');
    } catch (error) {
        logger.error('Error adding search vectors column:', error);
        throw error;
    }
}

async function runMigrations(): Promise<MigrationResult> {
    const errors: string[] = [];
    
    try {
        logger.info('🚀 Starting database migrations...');

        await createSessionsTable();
        await createUsersTable();
        await createFavoritesTable();
        await createBookMappingsTable();
        await createUpdateHistoryTable();
        await createUpdateSchedulesTable();
        await createSearchVectorsColumn();

        logger.info('✅ All migrations completed successfully');
        
        return {
            success: true,
            message: 'All migrations completed successfully'
        };
    } catch (error) {
        const errorMessage = `Migration failed: ${(error as Error).message}`;
        logger.error(errorMessage);
        errors.push(errorMessage);
        
        return {
            success: false,
            message: 'Some migrations failed',
            errors
        };
    }
}

// Run if called directly
if (require.main === module) {
    runMigrations()
        .then((result) => {
            if (result.success) {
                console.log(`🎉 ${result.message}`);
                process.exit(0);
            } else {
                console.error(`💥 ${result.message}`);
                if (result.errors) {
                    result.errors.forEach(error => console.error(`  - ${error}`));
                }
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('💥 Migration script failed:', error);
            process.exit(1);
        });
}

export default runMigrations;