import express, { Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { ExtendedRequest } from '../types';
// Note: These services are still in JS, using require for now
const UpdateService = require('../services/UpdateService');
const { requireAuth, requireRole, requireAdmin } = require('../middleware/auth');
const DatabaseManager = require('../scripts/DatabaseManager');
const MaintenanceScheduler = require('../scripts/MaintenanceScheduler');
const AutomatedUpdateService = require('../services/AutomatedUpdateService');

const router = express.Router();

const updateService = new UpdateService();
const automatedUpdateService = new AutomatedUpdateService();
const dbManager = new DatabaseManager();

// Global maintenance scheduler instance
let maintenanceScheduler: any = null;

// Get admin dashboard data
router.get('/dashboard', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Get basic statistics
        const { query } = require('../database/connection');
        
        const [userCount, bookCount, authorCount, genreCount] = await Promise.all([
            query('SELECT COUNT(*) as count FROM users'),
            query('SELECT COUNT(*) as count FROM libbook WHERE deleted = \'0\''),
            query('SELECT COUNT(*) as count FROM libavtorname'),
            query('SELECT COUNT(*) as count FROM libgenre')
        ]);

        // Get recent users
        const recentUsers = await query(`
            SELECT user_uuid, username, email, role, display_name, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 10
        `);

        // Get system status
        const updateStatus = await updateService.getUpdateStatus();
        
        // Get automated update statistics
        const updateStats = await automatedUpdateService.getUpdateStats();
        const schedules = await automatedUpdateService.getSchedules();
        const lastDailyUpdate = await automatedUpdateService.getLastSuccessfulUpdate('daily_books');

        res.json({
            success: true,
            data: {
                stats: {
                    users: parseInt(userCount.rows[0]?.count || 0),
                    books: parseInt(bookCount.rows[0]?.count || 0),
                    authors: parseInt(authorCount.rows[0]?.count || 0),
                    genres: parseInt(genreCount.rows[0]?.count || 0),
                    downloads: 0 // Placeholder for future implementation
                },
                users: recentUsers.rows || [],
                updateStatus: updateStatus,
                automatedUpdates: {
                    stats: updateStats,
                    schedules: schedules,
                    lastDailyUpdate: lastDailyUpdate
                }
            }
        });
    } catch (error) {
        console.error('Error getting admin dashboard data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get update status
router.get('/updates/status', requireAuth, requireAdmin, async (req, res) => {
    try {
        const status = await updateService.getUpdateStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting update status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update SQL files
router.post('/updates/sql', requireAuth, requireAdmin, async (req, res) => {
    try {
        console.log('Starting SQL files update...');
        const results = await updateService.updateSqlFiles();
        
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        
        res.json({
            success: true,
            data: {
                results,
                summary: {
                    total: results.length,
                    success: successCount,
                    errors: errorCount
                }
            }
        });
    } catch (error) {
        console.error('Error updating SQL files:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update daily books
router.post('/updates/daily', requireAuth, requireAdmin, async (req, res) => {
    try {
        console.log('Starting daily books update...');
        const results = await updateService.updateDailyBooks();
        
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        
        res.json({
            success: true,
            data: {
                results,
                summary: {
                    total: results.length,
                    success: successCount,
                    errors: errorCount
                }
            }
        });
    } catch (error) {
        console.error('Error updating daily books:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update covers
router.post('/updates/covers', requireAuth, requireAdmin, async (req, res) => {
    try {
        console.log('Starting covers update...');
        const results = await updateService.updateCovers();
        
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        
        res.json({
            success: true,
            data: {
                results,
                summary: {
                    total: results.length,
                    success: successCount,
                    errors: errorCount
                }
            }
        });
    } catch (error) {
        console.error('Error updating covers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update book mappings
router.post('/updates/mappings', requireAuth, requireAdmin, async (req, res) => {
    try {
        console.log('Starting book mappings update...');
        const result = await updateService.updateBookMappings();
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error updating book mappings:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Full system update (all components)
router.post('/updates/full', requireAuth, requireAdmin, async (req, res) => {
    try {
        console.log('Starting full system update...');
        
        const results = {
            sql: null,
            daily: null,
            covers: null,
            mappings: null
        };
        
        // Update SQL files
        try {
            results.sql = await updateService.updateSqlFiles();
        } catch (error) {
            results.sql = { error: error.message };
        }
        
        // Update daily books
        try {
            results.daily = await updateService.updateDailyBooks();
        } catch (error) {
            results.daily = { error: error.message };
        }
        
        // Update covers
        try {
            results.covers = await updateService.updateCovers();
        } catch (error) {
            results.covers = { error: error.message };
        }
        
        // Update book mappings
        try {
            results.mappings = await updateService.updateBookMappings();
        } catch (error) {
            results.mappings = { error: error.message };
        }
        
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Error during full system update:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get available daily files
router.get('/updates/daily/list', requireAuth, requireAdmin, async (req, res) => {
    try {
        const dailyFiles = await updateService.getDailyFileList();
        res.json({
            success: true,
            data: dailyFiles
        });
    } catch (error) {
        console.error('Error getting daily files list:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get users list
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { query } = require('../database/connection');
        
        const users = await query(`
            SELECT user_uuid as id, username, email, role, display_name, is_active, created_at
            FROM users 
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            data: users.rows || []
        });
    } catch (error) {
        console.error('Error getting users list:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Automated Update Management Endpoints

// Get automated update history
router.get('/automated/history', requireAuth, requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const updateType = req.query.type;
        
        let history;
        if (updateType) {
            history = await automatedUpdateService.getUpdateHistoryByType(updateType, limit);
        } else {
            history = await automatedUpdateService.getUpdateHistory(limit);
        }

        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Error getting automated update history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get automated update statistics
router.get('/automated/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
        const stats = await automatedUpdateService.getUpdateStats();
        const schedules = await automatedUpdateService.getSchedules();

        res.json({
            success: true,
            data: {
                stats: stats,
                schedules: schedules
            }
        });
    } catch (error) {
        console.error('Error getting automated update stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get automated update schedules
router.get('/automated/schedules', requireAuth, requireAdmin, async (req, res) => {
    try {
        const schedules = await automatedUpdateService.getSchedules();

        res.json({
            success: true,
            data: schedules
        });
    } catch (error) {
        console.error('Error getting automated update schedules:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Enable automated update schedule
router.post('/automated/schedules/:type/enable', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { type } = req.params;
        await automatedUpdateService.enableSchedule(type);

        res.json({
            success: true,
            message: `Automated update ${type} enabled successfully`
        });
    } catch (error) {
        console.error('Error enabling automated update schedule:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Disable automated update schedule
router.post('/automated/schedules/:type/disable', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { type } = req.params;
        await automatedUpdateService.disableSchedule(type);

        res.json({
            success: true,
            message: `Automated update ${type} disabled successfully`
        });
    } catch (error) {
        console.error('Error disabling automated update schedule:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update automated update schedule cron expression
router.put('/automated/schedules/:type/cron', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { type } = req.params;
        const { cronExpression } = req.body;
        
        if (!cronExpression) {
            return res.status(400).json({
                success: false,
                error: 'Cron expression is required'
            });
        }

        await automatedUpdateService.updateScheduleCron(type, cronExpression);

        res.json({
            success: true,
            message: `Automated update ${type} schedule updated successfully`
        });
    } catch (error) {
        console.error('Error updating automated update schedule:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Manually trigger automated update
router.post('/automated/trigger/:type', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { type } = req.params;
        
        // Run the update asynchronously
        automatedUpdateService.runScheduledUpdate(type).catch(error => {
            console.error(`Manual trigger for ${type} failed:`, error);
        });

        res.json({
            success: true,
            message: `Automated update ${type} triggered successfully`
        });
    } catch (error) {
        console.error('Error triggering automated update:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// === NEW MANAGEMENT ENDPOINTS ===

// Get enhanced database statistics
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
        const stats = await dbManager.getDatabaseStats();
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('Error getting database stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Perform database health check
router.get('/health', requireAuth, requireAdmin, async (req, res) => {
    try {
        const health = await dbManager.healthCheck();
        res.json({
            success: true,
            healthy: health.healthy,
            issues: health.issues
        });
    } catch (error) {
        console.error('Error performing health check:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Download SQL files
router.post('/download-sql', requireAuth, requireAdmin, async (req, res) => {
    try {
        await dbManager.downloadSqlFiles();
        res.json({
            success: true,
            message: 'SQL files downloaded successfully'
        });
    } catch (error) {
        console.error('Error downloading SQL files:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Download cover files
router.post('/download-covers', requireAuth, requireAdmin, async (req, res) => {
    try {
        await dbManager.downloadCoverFiles();
        res.json({
            success: true,
            message: 'Cover files downloaded successfully'
        });
    } catch (error) {
        console.error('Error downloading cover files:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update ZIP mappings
router.post('/update-zip-mappings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await dbManager.updateZipMappings();
        res.json({
            success: true,
            message: 'ZIP mappings updated successfully',
            mappingsCount: result.mappingsCount
        });
    } catch (error) {
        console.error('Error updating ZIP mappings:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update search vectors
router.post('/update-search-vectors', requireAuth, requireAdmin, async (req, res) => {
    try {
        await dbManager.updateSearchVectors();
        res.json({
            success: true,
            message: 'Search vectors updated successfully'
        });
    } catch (error) {
        console.error('Error updating search vectors:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create missing filenames
router.post('/create-missing-filenames', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await dbManager.createMissingFilenames();
        res.json({
            success: true,
            message: 'Missing filename entries created successfully',
            created: result.created
        });
    } catch (error) {
        console.error('Error creating missing filenames:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start maintenance scheduler
router.post('/scheduler/start', requireAuth, requireAdmin, async (req, res) => {
    try {
        if (maintenanceScheduler) {
            return res.status(400).json({
                success: false,
                error: 'Maintenance scheduler is already running'
            });
        }

        maintenanceScheduler = new MaintenanceScheduler();
        maintenanceScheduler.start();

        res.json({
            success: true,
            message: 'Maintenance scheduler started successfully'
        });
    } catch (error) {
        console.error('Error starting maintenance scheduler:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Stop maintenance scheduler
router.post('/scheduler/stop', requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!maintenanceScheduler) {
            return res.status(400).json({
                success: false,
                error: 'Maintenance scheduler is not running'
            });
        }

        maintenanceScheduler.stop();
        maintenanceScheduler = null;

        res.json({
            success: true,
            message: 'Maintenance scheduler stopped successfully'
        });
    } catch (error) {
        console.error('Error stopping maintenance scheduler:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get scheduler status
router.get('/scheduler/status', requireAuth, requireAdmin, async (req, res) => {
    try {
        if (!maintenanceScheduler) {
            return res.json({
                success: true,
                running: false,
                tasks: {}
            });
        }

        const status = maintenanceScheduler.getStatus();
        res.json({
            success: true,
            running: true,
            tasks: status
        });
    } catch (error) {
        console.error('Error getting scheduler status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Manually run a specific maintenance task
router.post('/scheduler/run/:taskName', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { taskName } = req.params;
        
        if (!maintenanceScheduler) {
            return res.status(400).json({
                success: false,
                error: 'Maintenance scheduler is not running'
            });
        }

        const result = await maintenanceScheduler.runTask(taskName);
        res.json({
            success: true,
            message: `Task ${taskName} executed successfully`,
            result: result
        });
    } catch (error) {
        console.error(`Error running task ${req.params.taskName}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Toggle a specific maintenance task
router.post('/scheduler/toggle/:taskName', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { taskName } = req.params;
        const { enabled } = req.body;
        
        if (!maintenanceScheduler) {
            return res.status(400).json({
                success: false,
                error: 'Maintenance scheduler is not running'
            });
        }

        maintenanceScheduler.toggleTask(taskName, enabled);
        res.json({
            success: true,
            message: `Task ${taskName} ${enabled ? 'enabled' : 'disabled'} successfully`
        });
    } catch (error) {
        console.error(`Error toggling task ${req.params.taskName}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Perform full setup
router.post('/full-setup', requireAuth, requireAdmin, async (req, res) => {
    try {
        // This is a long-running operation, consider using a job queue in production
        logger.info('Starting full setup via API...');
        
        // Download SQL files
        await dbManager.downloadSqlFiles();
        
        // Download covers
        await dbManager.downloadCoverFiles();
        
        // Update daily books (using existing automated service)
        await automatedUpdateService.runScheduledUpdate('daily_books');
        
        // Update ZIP mappings
        const zipResult = await dbManager.updateZipMappings();
        
        // Create missing filenames
        const filenameResult = await dbManager.createMissingFilenames();
        
        // Update search vectors
        await dbManager.updateSearchVectors();

        res.json({
            success: true,
            message: 'Full setup completed successfully',
            results: {
                zipMappings: zipResult.mappingsCount,
                createdFilenames: filenameResult.created
            }
        });
    } catch (error) {
        logger.error('Full setup failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
