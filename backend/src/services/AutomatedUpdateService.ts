import * as cron from 'node-cron';
import { query } from '../database/connection';
import UpdateService from './UpdateService';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { 
  UpdateScheduleRecord, 
  UpdateHistoryRecord, 
  UpdateStatsRecord, 
  UpdateResult 
} from '../types/index';

class AutomatedUpdateService {
    private static _instance: AutomatedUpdateService | null = null;
    private updateService: any; // Will be properly typed when UpdateService is converted
    private scheduler: Map<string, cron.ScheduledTask> | null;
    private isInitialized: boolean;

    private constructor() {
        this.updateService = new UpdateService();
        this.scheduler = null;
        this.isInitialized = false;
    }

    static getInstance(): AutomatedUpdateService {
        if (!this._instance) {
            this._instance = new AutomatedUpdateService();
        }
        return this._instance;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        
        try {
            // Create database tables if they don't exist
            await this.createTables();
            
            // Initialize the scheduler
            await this.startScheduler();
            
            this.isInitialized = true;
            logger.info('Automated update service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize automated update service:', error);
            throw error;
        }
    }

    async createTables(): Promise<void> {
        try {
            const updateHistorySQL = await fs.readFile(
                path.join(__dirname, '../../sql/update_history.sql'), 
                'utf8'
            );
            
            await query(updateHistorySQL);
            logger.info('Update history tables created/verified');
        } catch (error: any) {
            // Log the error but don't throw if it's just duplicate objects
            if (error.code === '42710' || error.message?.includes('already exists')) {
                logger.info('Update tables already exist, continuing...');
            } else {
                logger.error('Error creating update tables:', error);
                throw error;
            }
        }
    }

    async startScheduler(): Promise<void> {
        try {
            // Get all enabled schedules from database
            const schedules = await this.getSchedules();
            
            // Stop existing scheduler if running
            if (this.scheduler) {
                this.scheduler.forEach(task => task.stop());
            }
            
            // Create new scheduler
            this.scheduler = new Map();
            
            // Schedule each update type
            for (const schedule of schedules) {
                if (schedule.enabled) {
                    this.scheduleUpdate(schedule);
                }
            }
            
            logger.info(`Scheduled ${schedules.length} automated updates`);
        } catch (error) {
            logger.error('Error starting scheduler:', error);
            throw error;
        }
    }

    scheduleUpdate(schedule: UpdateScheduleRecord): void {
        try {
            const task = cron.schedule(schedule.cron_expression, async () => {
                logger.info(`Running scheduled update: ${schedule.update_type}`);
                await this.runScheduledUpdate(schedule.update_type);
            }, {
                scheduled: true,
                timezone: "UTC"
            });
            
            this.scheduler?.set(schedule.update_type, task);
            logger.info(`Scheduled ${schedule.update_type} with cron: ${schedule.cron_expression}`);
        } catch (error) {
            logger.error(`Error scheduling ${schedule.update_type}:`, error);
        }
    }

    async runScheduledUpdate(updateType: string): Promise<void> {
        const startTime = new Date();
        let updateRecord: UpdateHistoryRecord | null = null;
        
        try {
            // Create update record
            updateRecord = await this.createUpdateRecord(updateType, 'running');
            
            // Update last_run in schedule
            await this.updateScheduleLastRun(updateType);
            
            // Run the actual update
            let result: UpdateResult | UpdateResult[] | Record<string, UpdateResult[]>;
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
            const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
            const stats = this.calculateStats(result);
            
            // Update record with success
            await this.updateUpdateRecord(updateRecord.id, {
                status: 'success',
                completed_at: new Date(),
                duration_seconds: duration,
                processed_files: stats.processed,
                successful_files: stats.successful,
                failed_files: stats.failed,
                operation_details: result as Record<string, unknown>
            });
            
            logger.info(`Scheduled update ${updateType} completed successfully in ${duration}s`);
            
        } catch (error: any) {
            logger.error(`Scheduled update ${updateType} failed:`, error);
            
            if (updateRecord) {
                const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
                await this.updateUpdateRecord(updateRecord.id, {
                    status: 'error',
                    completed_at: new Date(),
                    duration_seconds: duration,
                    error_message: error.message
                });
            }
        }
    }

    async runFullUpdate(): Promise<Record<string, UpdateResult[]>> {
        const results: Record<string, UpdateResult[]> = {};
        
        // Run all updates in sequence
        results.sql_files = await this.updateService.updateSqlFiles();
        results.daily_books = await this.updateService.updateDailyBooks();
        results.covers = await this.updateService.updateCovers();
        results.mappings = await this.updateService.updateBookMappings();
        
        return results;
    }

    calculateStats(result: any): { processed: number; successful: number; failed: number } {
        let processed = 0;
        let successful = 0;
        let failed = 0;
        
        if (Array.isArray(result)) {
            processed = result.length;
            successful = result.filter((r: any) => r.status === 'success').length;
            failed = result.filter((r: any) => r.status === 'error').length;
        } else if (result && typeof result === 'object') {
            // Handle full update results
            Object.values(result).forEach((subResult: any) => {
                if (Array.isArray(subResult)) {
                    processed += subResult.length;
                    successful += subResult.filter((r: any) => r.status === 'success').length;
                    failed += subResult.filter((r: any) => r.status === 'error').length;
                }
            });
        }
        
        return { processed, successful, failed };
    }

    async createUpdateRecord(updateType: string, status: string): Promise<UpdateHistoryRecord> {
        const result = await query(
            'INSERT INTO update_history (update_type, status) VALUES ($1, $2) RETURNING *',
            [updateType, status]
        );
        return result.rows[0] as UpdateHistoryRecord;
    }

    async updateUpdateRecord(id: number, updates: Partial<UpdateHistoryRecord>): Promise<void> {
        const fields = Object.keys(updates);
        const values = Object.values(updates);
        const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
        
        await query(
            `UPDATE update_history SET ${setClause} WHERE id = $1`,
            [id, ...values]
        );
    }

    async updateScheduleLastRun(updateType: string): Promise<void> {
        await query(
            'UPDATE update_schedule SET last_run = NOW(), next_run = NOW() + INTERVAL \'1 day\' WHERE update_type = $1',
            [updateType]
        );
    }

    async getSchedules(): Promise<UpdateScheduleRecord[]> {
        const result = await query('SELECT * FROM update_schedule ORDER BY update_type');
        return result.rows as UpdateScheduleRecord[];
    }

    async getUpdateHistory(limit: number = 50): Promise<UpdateHistoryRecord[]> {
        const result = await query(
            `SELECT * FROM update_history 
             ORDER BY started_at DESC 
             LIMIT $1`,
            [limit]
        );
        return result.rows as UpdateHistoryRecord[];
    }

    async getUpdateHistoryByType(updateType: string, limit: number = 20): Promise<UpdateHistoryRecord[]> {
        const result = await query(
            `SELECT * FROM update_history 
             WHERE update_type = $1 
             ORDER BY started_at DESC 
             LIMIT $2`,
            [updateType, limit]
        );
        return result.rows as UpdateHistoryRecord[];
    }

    async getLastSuccessfulUpdate(updateType: string): Promise<UpdateHistoryRecord | null> {
        const result = await query(
            `SELECT * FROM update_history 
             WHERE update_type = $1 AND status = 'success' 
             ORDER BY started_at DESC 
             LIMIT 1`,
            [updateType]
        );
        return (result.rows[0] as UpdateHistoryRecord) || null;
    }

    async getUpdateStats(): Promise<UpdateStatsRecord[]> {
        const result = await query(`
            SELECT 
                update_type,
                COUNT(*) as total_runs,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_runs,
                COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_runs,
                MAX(started_at) as last_run,
                AVG(duration_seconds) as avg_duration,
                SUM(successful_files) as total_files_successful,
                SUM(failed_files) as total_files_failed
            FROM update_history 
            GROUP BY update_type
            ORDER BY update_type
        `);
        return result.rows as UpdateStatsRecord[];
    }

    async enableSchedule(updateType: string): Promise<void> {
        await query(
            'UPDATE update_schedule SET enabled = true WHERE update_type = $1',
            [updateType]
        );
        await this.startScheduler(); // Restart scheduler with new settings
    }

    async disableSchedule(updateType: string): Promise<void> {
        await query(
            'UPDATE update_schedule SET enabled = false WHERE update_type = $1',
            [updateType]
        );
        await this.startScheduler(); // Restart scheduler with new settings
    }

    async updateScheduleCron(updateType: string, cronExpression: string): Promise<void> {
        await query(
            'UPDATE update_schedule SET cron_expression = $1 WHERE update_type = $2',
            [cronExpression, updateType]
        );
        await this.startScheduler(); // Restart scheduler with new settings
    }

    async stop(): Promise<void> {
        if (this.scheduler) {
            this.scheduler.forEach(task => task.stop());
            this.scheduler = null;
        }
        this.isInitialized = false;
        logger.info('Automated update service stopped');
    }
}

export default AutomatedUpdateService;