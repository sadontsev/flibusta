const cron = require('node-cron');
const { query } = require('../database/connection');
const UpdateService = require('./UpdateService');

class AutomatedUpdateService {
    constructor() {
        this.updateService = new UpdateService();
        this.scheduler = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Create database tables if they don't exist
            await this.createTables();
            
            // Initialize the scheduler
            await this.startScheduler();
            
            this.isInitialized = true;
            console.log('Automated update service initialized successfully');
        } catch (error) {
            console.error('Failed to initialize automated update service:', error);
            throw error;
        }
    }

    async createTables() {
        try {
            const updateHistorySQL = await require('fs').promises.readFile(
                require('path').join(__dirname, '../../sql/update_history.sql'), 
                'utf8'
            );
            
            await query(updateHistorySQL);
            console.log('Update history tables created/verified');
        } catch (error) {
            console.error('Error creating update tables:', error);
            throw error;
        }
    }

    async startScheduler() {
        try {
            // Get all enabled schedules from database
            const schedules = await this.getSchedules();
            
            // Stop existing scheduler if running
            if (this.scheduler) {
                this.scheduler.stop();
            }
            
            // Create new scheduler
            this.scheduler = cron.getTasks();
            
            // Schedule each update type
            for (const schedule of schedules) {
                if (schedule.enabled) {
                    this.scheduleUpdate(schedule);
                }
            }
            
            console.log(`Scheduled ${schedules.length} automated updates`);
        } catch (error) {
            console.error('Error starting scheduler:', error);
            throw error;
        }
    }

    scheduleUpdate(schedule) {
        try {
            cron.schedule(schedule.cron_expression, async () => {
                console.log(`Running scheduled update: ${schedule.update_type}`);
                await this.runScheduledUpdate(schedule.update_type);
            }, {
                scheduled: true,
                timezone: "UTC"
            });
            
            console.log(`Scheduled ${schedule.update_type} with cron: ${schedule.cron_expression}`);
        } catch (error) {
            console.error(`Error scheduling ${schedule.update_type}:`, error);
        }
    }

    async runScheduledUpdate(updateType) {
        const startTime = new Date();
        let updateRecord = null;
        
        try {
            // Create update record
            updateRecord = await this.createUpdateRecord(updateType, 'running');
            
            // Update last_run in schedule
            await this.updateScheduleLastRun(updateType);
            
            // Run the actual update
            let result;
            switch (updateType) {
                case 'daily_books':
                    result = await this.updateService.updateDailyBooks();
                    break;
                case 'sql_files':
                    result = await this.updateService.updateSqlFiles();
                    break;
                case 'covers':
                    result = await this.updateService.updateCovers();
                    break;
                case 'mappings':
                    result = await this.updateService.updateBookMappings();
                    break;
                case 'full':
                    result = await this.runFullUpdate();
                    break;
                default:
                    throw new Error(`Unknown update type: ${updateType}`);
            }
            
            // Calculate statistics
            const duration = Math.floor((new Date() - startTime) / 1000);
            const stats = this.calculateStats(result);
            
            // Update record with success
            await this.updateUpdateRecord(updateRecord.id, {
                status: 'success',
                completed_at: new Date(),
                duration_seconds: duration,
                files_processed: stats.processed,
                files_successful: stats.successful,
                files_failed: stats.failed,
                details: result
            });
            
            console.log(`Scheduled update ${updateType} completed successfully in ${duration}s`);
            
        } catch (error) {
            console.error(`Scheduled update ${updateType} failed:`, error);
            
            if (updateRecord) {
                const duration = Math.floor((new Date() - startTime) / 1000);
                await this.updateUpdateRecord(updateRecord.id, {
                    status: 'error',
                    completed_at: new Date(),
                    duration_seconds: duration,
                    error_message: error.message
                });
            }
        }
    }

    async runFullUpdate() {
        const results = {};
        
        // Run all updates in sequence
        results.sql_files = await this.updateService.updateSqlFiles();
        results.daily_books = await this.updateService.updateDailyBooks();
        results.covers = await this.updateService.updateCovers();
        results.mappings = await this.updateService.updateBookMappings();
        
        return results;
    }

    calculateStats(result) {
        let processed = 0;
        let successful = 0;
        let failed = 0;
        
        if (Array.isArray(result)) {
            processed = result.length;
            successful = result.filter(r => r.status === 'success').length;
            failed = result.filter(r => r.status === 'error').length;
        } else if (result && typeof result === 'object') {
            // Handle full update results
            Object.values(result).forEach(subResult => {
                if (Array.isArray(subResult)) {
                    processed += subResult.length;
                    successful += subResult.filter(r => r.status === 'success').length;
                    failed += subResult.filter(r => r.status === 'error').length;
                }
            });
        }
        
        return { processed, successful, failed };
    }

    async createUpdateRecord(updateType, status) {
        const result = await query(
            'INSERT INTO update_history (update_type, status) VALUES ($1, $2) RETURNING id',
            [updateType, status]
        );
        return result.rows[0];
    }

    async updateUpdateRecord(id, updates) {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
        
        await query(
            `UPDATE update_history SET ${setClause} WHERE id = $1`,
            [id, ...values]
        );
    }

    async updateScheduleLastRun(updateType) {
        await query(
            'UPDATE update_schedule SET last_run = NOW(), next_run = NOW() + INTERVAL \'1 day\' WHERE update_type = $1',
            [updateType]
        );
    }

    async getSchedules() {
        const result = await query('SELECT * FROM update_schedule ORDER BY update_type');
        return result.rows;
    }

    async getUpdateHistory(limit = 50) {
        const result = await query(
            `SELECT * FROM update_history 
             ORDER BY started_at DESC 
             LIMIT $1`,
            [limit]
        );
        return result.rows;
    }

    async getUpdateHistoryByType(updateType, limit = 20) {
        const result = await query(
            `SELECT * FROM update_history 
             WHERE update_type = $1 
             ORDER BY started_at DESC 
             LIMIT $2`,
            [updateType, limit]
        );
        return result.rows;
    }

    async getLastSuccessfulUpdate(updateType) {
        const result = await query(
            `SELECT * FROM update_history 
             WHERE update_type = $1 AND status = 'success' 
             ORDER BY started_at DESC 
             LIMIT 1`,
            [updateType]
        );
        return result.rows[0] || null;
    }

    async getUpdateStats() {
        const result = await query(`
            SELECT 
                update_type,
                COUNT(*) as total_runs,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_runs,
                COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_runs,
                MAX(started_at) as last_run,
                AVG(duration_seconds) as avg_duration,
                SUM(files_successful) as total_files_successful,
                SUM(files_failed) as total_files_failed
            FROM update_history 
            GROUP BY update_type
            ORDER BY update_type
        `);
        return result.rows;
    }

    async enableSchedule(updateType) {
        await query(
            'UPDATE update_schedule SET enabled = true WHERE update_type = $1',
            [updateType]
        );
        await this.startScheduler(); // Restart scheduler with new settings
    }

    async disableSchedule(updateType) {
        await query(
            'UPDATE update_schedule SET enabled = false WHERE update_type = $1',
            [updateType]
        );
        await this.startScheduler(); // Restart scheduler with new settings
    }

    async updateScheduleCron(updateType, cronExpression) {
        await query(
            'UPDATE update_schedule SET cron_expression = $1 WHERE update_type = $2',
            [cronExpression, updateType]
        );
        await this.startScheduler(); // Restart scheduler with new settings
    }

    async stop() {
        if (this.scheduler) {
            cron.getTasks().forEach(task => task.stop());
            this.scheduler = null;
        }
        this.isInitialized = false;
        console.log('Automated update service stopped');
    }
}

module.exports = AutomatedUpdateService;
