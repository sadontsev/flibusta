import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import cors from 'cors';
import path from 'path';
import logger from './utils/logger';

// Import converted TypeScript routes
import sessionRoutes from './routes/session';
import booksRoutes from './routes/books';
import authorsRoutes from './routes/authors';
import genresRoutes from './routes/genres';
import seriesRoutes from './routes/series';
import favoritesRoutes from './routes/favorites';
import authRoutes from './routes/auth';          // Now TypeScript
import { initializeSession, addUserToLocals } from './middleware/sessionMiddleware';

// Import JavaScript routes (complex business logic, to be converted later)
const filesRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');   // Still JavaScript
const AutomatedUpdateService = require('./services/AutomatedUpdateService');
const MaintenanceScheduler = require('./scripts/MaintenanceScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Create the PostgreSQL session store
const PostgreSQLStore = pgSession(session);

// Basic middleware
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    store: new PostgreSQLStore({
        conObject: {
            host: process.env.DB_HOST || 'postgres',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'flibusta',
            user: process.env.DB_USER || 'flibusta',
            password: process.env.DB_PASSWORD || 'flibusta'
        },
        tableName: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to false for development
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
        sameSite: 'lax'
    }
}));

// Initialize sessions for all requests
app.use(initializeSession);
app.use(addUserToLocals);

// Static files
app.use('/static', express.static('public'));
app.use('/bootstrap', express.static('public/bootstrap'));
app.use('/css', express.static('public/css'));
app.use('/js', express.static('public/js'));
app.use('/fonts', express.static('public/fonts'));
app.use('/webfonts', express.static('public/webfonts'));

// API Routes
app.use('/api/books', booksRoutes);
app.use('/api/authors', authorsRoutes);
app.use('/api/genres', genresRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/session', sessionRoutes);

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve the main application
app.get('/', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve the login page
app.get('/login', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Serve the debug page
app.get('/debug', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, '../public/debug.html'));
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Error handling middleware
// const { errorHandler } = require('./middleware/errorHandler');
// app.use(errorHandler);

// 404 handler
// const { notFoundHandler } = require('./middleware/notFoundHandler');
// app.use(notFoundHandler);

// Initialize automated update service
const automatedUpdateService = new AutomatedUpdateService();

// Initialize maintenance scheduler
let maintenanceScheduler: typeof MaintenanceScheduler | null = null;
if (process.env.ENABLE_MAINTENANCE_SCHEDULER === 'true') {
    maintenanceScheduler = new MaintenanceScheduler();
}

// Initialize superadmin user (moved require to where it's used)

// Start server
app.listen(PORT, async () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
    
    try {
        // Initialize superadmin user first
        const { initSuperadmin } = require('./database/init-superadmin');
        await initSuperadmin();
        logger.info('Superadmin user initialized successfully');
        
        // Then initialize automated update service
        await automatedUpdateService.initialize();
        logger.info('Automated update service started successfully');
        
        // Start maintenance scheduler if enabled
        if (maintenanceScheduler) {
            maintenanceScheduler.start();
            logger.info('Maintenance scheduler started successfully');
        }
    } catch (error) {
        logger.error('Failed to initialize services:', error);
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await automatedUpdateService.stop();
    if (maintenanceScheduler) {
        maintenanceScheduler.stop();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await automatedUpdateService.stop();
    if (maintenanceScheduler) {
        maintenanceScheduler.stop();
    }
    process.exit(0);
});
