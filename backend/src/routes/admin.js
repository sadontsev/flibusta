const express = require('express');
const { requireAuth, requireRole, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const UpdateService = require('../services/UpdateService');
const updateService = new UpdateService();
const AutomatedUpdateService = require('../services/AutomatedUpdateService');
const automatedUpdateService = new AutomatedUpdateService();

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

module.exports = router;
