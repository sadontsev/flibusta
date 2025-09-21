import cron from 'node-cron';
import DatabaseManager from './DatabaseManager';
import logger from '../utils/logger';
import { MaintenanceTask } from '../types/index';

interface TaskInfo {
    running: boolean;
    lastRun: Date | null;
    nextRun: Date | null;
}

interface TaskStatus {
    [taskName: string]: TaskInfo;
}

class MaintenanceScheduler {
    private dbManager: DatabaseManager;
    private jobs: Map<string, cron.ScheduledTask>;

    constructor() {
        this.dbManager = new DatabaseManager();
        this.jobs = new Map();
    }

    /**
     * Start all scheduled maintenance tasks
     */
    start(): void {
        logger.info('Starting maintenance scheduler...');

        // Daily at 3 AM: Update daily books and ZIP mappings
        this.scheduleTask('daily-update', '0 3 * * *', async () => {
            logger.info('Starting scheduled daily update...');
            try {
                await this.dbManager.updateDailyBooks();
                await this.dbManager.updateZipMappings();
                await this.dbManager.createMissingFilenames();
                logger.info('Scheduled daily update completed successfully');
            } catch (error) {
                logger.error('Scheduled daily update failed:', error);
            }
        });

        // Weekly on Sunday at 4 AM: Update search vectors
        this.scheduleTask('weekly-search-update', '0 4 * * 0', async () => {
            logger.info('Starting scheduled search vectors update...');
            try {
                await this.dbManager.updateSearchVectors();
                logger.info('Scheduled search vectors update completed successfully');
            } catch (error) {
                logger.error('Scheduled search vectors update failed:', error);
            }
        });

        // Every 6 hours: Health check
        this.scheduleTask('health-check', '0 */6 * * *', async () => {
            logger.info('Starting scheduled health check...');
            try {
                const health = await this.dbManager.healthCheck();
                if (!health.healthy) {
                    logger.warn('Health check issues found:', health.issues);
                } else {
                    logger.info('Health check passed');
                }
            } catch (error) {
                logger.error('Scheduled health check failed:', error);
            }
        });

        // Weekly on Saturday at 2 AM: Download fresh SQL and covers
        this.scheduleTask('weekly-refresh', '0 2 * * 6', async () => {
            logger.info('Starting scheduled weekly refresh...');
            try {
                await this.dbManager.downloadSqlFiles();
                await this.dbManager.downloadCoverFiles();
                logger.info('Scheduled weekly refresh completed successfully');
            } catch (error) {
                logger.error('Scheduled weekly refresh failed:', error);
            }
        });

        logger.info(`Maintenance scheduler started with ${this.jobs.size} tasks`);
    }

    /**
     * Stop all scheduled tasks
     */
    stop(): void {
        logger.info('Stopping maintenance scheduler...');
        for (const [name, task] of this.jobs) {
            task.stop();
            logger.info(`Stopped task: ${name}`);
        }
        this.jobs.clear();
        logger.info('Maintenance scheduler stopped');
    }

    /**
     * Schedule a maintenance task
     */
    scheduleTask(name: string, cronExpression: string, taskFunction: () => Promise<void>): void {
        if (this.jobs.has(name)) {
            logger.warn(`Task ${name} already scheduled, skipping`);
            return;
        }

        const task = cron.schedule(cronExpression, taskFunction, {
            scheduled: true,
            timezone: process.env.TZ || 'UTC'
        });

        this.jobs.set(name, task);
        logger.info(`Scheduled task: ${name} (${cronExpression})`);
    }

    /**
     * Manually trigger a specific task
     */
    async runTask(taskName: string): Promise<any> {
        switch (taskName) {
            case 'daily-update':
                await this.dbManager.updateDailyBooks();
                await this.dbManager.updateZipMappings();
                await this.dbManager.createMissingFilenames();
                break;
            
            case 'weekly-search-update':
                await this.dbManager.updateSearchVectors();
                break;
            
            case 'health-check':
                return await this.dbManager.healthCheck();
            
            case 'weekly-refresh':
                await this.dbManager.downloadSqlFiles();
                await this.dbManager.downloadCoverFiles();
                break;
            
            default:
                throw new Error(`Unknown task: ${taskName}`);
        }
    }

    /**
     * Get status of all scheduled tasks
     */
    getStatus(): TaskStatus {
        const status: TaskStatus = {};
        for (const [name, task] of this.jobs) {
            status[name] = {
                running: (task as any).running || false,
                lastRun: (task as any).lastRun || null,
                nextRun: (task as any).nextRun || null
            };
        }
        return status;
    }

    /**
     * Enable/disable a specific task
     */
    toggleTask(taskName: string, enabled: boolean): void {
        const task = this.jobs.get(taskName);
        if (!task) {
            throw new Error(`Task not found: ${taskName}`);
        }

        if (enabled) {
            task.start();
            logger.info(`Enabled task: ${taskName}`);
        } else {
            task.stop();
            logger.info(`Disabled task: ${taskName}`);
        }
    }
}

export default MaintenanceScheduler;