import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { query } from '../database/connection';
import logger from '../utils/logger';
import UpdateService from '../services/UpdateService';
import AutomatedUpdateService from '../services/AutomatedUpdateService';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import CoverCacheService from '../services/CoverCacheService';

const router = express.Router();

const updateService = new UpdateService();
const automatedUpdateService = AutomatedUpdateService.getInstance();

// Get admin dashboard data
router.get('/dashboard', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Get basic statistics
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
                    users: parseInt((userCount.rows[0] as any)?.count || '0'),
                    books: parseInt((bookCount.rows[0] as any)?.count || '0'),
                    authors: parseInt((authorCount.rows[0] as any)?.count || '0'),
                    genres: parseInt((genreCount.rows[0] as any)?.count || '0'),
                    downloads: 0
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
        logger.error('Error getting admin dashboard data:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Get update status (lightweight, for polling)
router.get('/updates/status', requireAuth, requireAdmin, async (req, res) => {
    try {
        const updateStatus = await updateService.getUpdateStatus();
        res.json({ success: true, data: updateStatus });
    } catch (error) {
        logger.error('Error getting update status:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// Start an update asynchronously so UI can poll progress
router.post('/updates/run/:type', requireAuth, requireAdmin, async (req, res) => {
    try {
        const type = (req.params as { type?: string }).type as string;
        const allowed = new Set(['sql','daily','covers','mappings','full']);
        if (!type || !allowed.has(type)) {
            res.status(400).json({ success: false, error: 'Invalid update type' });
            return;
        }

        const status = await updateService.getUpdateStatus();
        if (status.isRunning) {
            res.status(409).json({ success: false, error: 'Another update is already running' });
            return;
        }

        // Fire and forget
        (async () => {
            try {
                if (type === 'sql') await updateService.updateSqlFiles();
                else if (type === 'daily') await updateService.updateDailyBooks();
                else if (type === 'covers') await updateService.updateCovers();
                else if (type === 'mappings') await updateService.updateBookMappings();
                else if (type === 'full') {
                    // Sequential full run
                    try { await updateService.updateSqlFiles(); } catch (e) { logger.error('Full run: SQL error', e); }
                    try { await updateService.updateDailyBooks(); } catch (e) { logger.error('Full run: daily error', e); }
                    try { await updateService.updateCovers(); } catch (e) { logger.error('Full run: covers error', e); }
                    try { await updateService.updateBookMappings(); } catch (e) { logger.error('Full run: mappings error', e); }
                }
            } catch (err) {
                logger.error(`Async update ${type} failed:`, err);
            }
        })();

        res.json({ success: true, data: { started: true, type } });
    } catch (error) {
        logger.error('Error starting async update:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// Update SQL files
router.post('/updates/sql', requireAuth, requireAdmin, async (req, res) => {
    try {
        logger.info('Starting SQL files update...');
        const results = await updateService.updateSqlFiles();
        
        const successCount = results.filter((r: any) => r.status === 'success').length;
        const errorCount = results.filter((r: any) => r.status === 'error').length;
        
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
        logger.error('Error updating SQL files:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Update daily books
router.post('/updates/daily', requireAuth, requireAdmin, async (req, res) => {
    try {
        logger.info('Starting daily books update...');
        const results = await updateService.updateDailyBooks();
        
        const successCount = results.filter((r: any) => r.status === 'success').length;
        const errorCount = results.filter((r: any) => r.status === 'error').length;
        
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
        logger.error('Error updating daily books:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Update covers
router.post('/updates/covers', requireAuth, requireAdmin, async (req, res) => {
    try {
        logger.info('Starting covers update...');
        const results = await updateService.updateCovers();
        
        const successCount = results.filter((r: any) => r.status === 'success').length;
        const errorCount = results.filter((r: any) => r.status === 'error').length;
        
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
        logger.error('Error updating covers:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Trigger covers precache job (on-demand)
router.post('/covers/precache', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { limit, mode } = req.body || {};
        const result = await CoverCacheService.precacheAll({ limit: Number(limit) || 500, mode });
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Error precaching covers:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// Schedule missing cover for a specific book
router.post('/covers/schedule/:bookId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const bookId = parseInt((req.params as any).bookId);
        CoverCacheService.schedule(bookId);
        res.json({ success: true, data: { scheduled: true, bookId } });
    } catch (error) {
        logger.error('Error scheduling cover:', error);
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// Covers cache stats
router.get('/covers/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
        res.json({ success: true, data: CoverCacheService.getStats() });
    } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// Update book mappings
router.post('/updates/mappings', requireAuth, requireAdmin, async (req, res) => {
    try {
        logger.info('Starting book mappings update...');
        const result = await updateService.updateBookMappings();
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Error updating book mappings:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Full system update (all components)
router.post('/updates/full', requireAuth, requireAdmin, async (req, res) => {
    try {
        logger.info('Starting full system update...');
        
        const results = {
            sql: null as any,
            daily: null as any,
            covers: null as any,
            mappings: null as any
        };
        
        // Update SQL files
        try {
            results.sql = await updateService.updateSqlFiles();
        } catch (error) {
            results.sql = { error: (error as Error).message };
        }
        
        // Update daily books
        try {
            results.daily = await updateService.updateDailyBooks();
        } catch (error) {
            results.daily = { error: (error as Error).message };
        }
        
        // Update covers
        try {
            results.covers = await updateService.updateCovers();
        } catch (error) {
            results.covers = { error: (error as Error).message };
        }
        
        // Update book mappings
        try {
            results.mappings = await updateService.updateBookMappings();
        } catch (error) {
            results.mappings = { error: (error as Error).message };
        }
        
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        logger.error('Error during full system update:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
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
        logger.error('Error getting daily file list:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Get users list
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
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
        logger.error('Error getting users list:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Create new user (admin can create users)
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { username, password, email, display_name, role = 'user' } = req.body;
        
        // Validate required fields
        if (!username || !password) {
            res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
            return;
        }

        if (username.length < 3) {
            res.status(400).json({
                success: false,
                error: 'Username must be at least 3 characters'
            });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
            return;
        }

        // Check if user already exists
        // Cast $2 to text to avoid Postgres "could not determine data type of parameter $2" when email is NULL
        const existingUser = await query(`
            SELECT user_uuid
            FROM users
            WHERE username = $1
               OR (COALESCE($2::text, '') <> '' AND email = $2::text)
        `, [username, email ?? null]);

        if (existingUser.rows.length > 0) {
            res.status(400).json({
                success: false,
                error: 'User with this username or email already exists'
            });
            return;
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const userUuid = uuidv4();

        // Create user
        await query(`
            INSERT INTO users (user_uuid, username, email, password_hash, role, display_name, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [userUuid, username, email || null, passwordHash, role, display_name || null, true]);

        // Get created user
        const newUser = await query(`
            SELECT user_uuid, username, email, role, is_active, display_name, created_at
            FROM users WHERE user_uuid = $1
        `, [userUuid]);

        logger.info('New user created by admin', { 
            username: username,
            role: role,
            createdBy: (req as any).user.username
        });

        res.status(201).json({
            success: true,
            data: newUser.rows[0],
            message: 'User created successfully'
        });
    } catch (error) {
        logger.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Automated Update Management Endpoints

// Get automated update history
router.get('/automated/history', requireAuth, requireAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const updateType = req.query.type as string;
        
        let history: any[];
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
        logger.error('Error getting automated update history:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
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
        logger.error('Error getting automated update stats:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
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
        logger.error('Error getting automated update schedules:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Enable automated update schedule
router.post('/automated/schedules/:type/enable', requireAuth, requireAdmin, async (req, res) => {
    try {
        const type = (req.params as { type?: string }).type;
        if (!type) {
            res.status(400).json({ success: false, error: 'Type is required' });
            return;
        }
        await automatedUpdateService.enableSchedule(type);

        res.json({
            success: true,
            message: `Automated update ${type} enabled successfully`
        });
    } catch (error) {
        logger.error('Error enabling automated update schedule:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Disable automated update schedule
router.post('/automated/schedules/:type/disable', requireAuth, requireAdmin, async (req, res) => {
    try {
        const type = (req.params as { type?: string }).type;
        if (!type) {
            res.status(400).json({ success: false, error: 'Type is required' });
            return;
        }
        await automatedUpdateService.disableSchedule(type);

        res.json({
            success: true,
            message: `Automated update ${type} disabled successfully`
        });
    } catch (error) {
        logger.error('Error disabling automated update schedule:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Update automated update schedule cron expression
router.put('/automated/schedules/:type/cron', requireAuth, requireAdmin, async (req, res) => {
    try {
        const type = (req.params as { type?: string }).type;
        const cronExpression = (req.body as { cronExpression?: string }).cronExpression;
        if (!type) {
            res.status(400).json({ success: false, error: 'Type is required' });
            return;
        }
        if (!cronExpression || typeof cronExpression !== 'string') {
            res.status(400).json({ success: false, error: 'Cron expression is required' });
            return;
        }

        await automatedUpdateService.updateScheduleCron(type, cronExpression);

        res.json({
            success: true,
            message: `Automated update ${type} schedule updated successfully`
        });
    } catch (error) {
        logger.error('Error updating automated update schedule:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Manually trigger automated update
router.post('/automated/trigger/:type', requireAuth, requireAdmin, async (req, res) => {
    try {
        const type = (req.params as { type?: string }).type;
        if (!type) {
            res.status(400).json({ success: false, error: 'Type is required' });
            return;
        }
        // Run the update asynchronously
        automatedUpdateService.runScheduledUpdate(type).catch((error: Error) => {
            logger.error(`Manual trigger for ${type} failed:`, error);
        });

        res.json({
            success: true,
            message: `Automated update ${type} triggered successfully`
        });
    } catch (error) {
        logger.error('Error triggering automated update:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

export default router;