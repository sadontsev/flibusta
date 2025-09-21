const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');

// Import routes
const booksRoutes = require('./routes/books');
const authorsRoutes = require('./routes/authors');
const genresRoutes = require('./routes/genres');
const seriesRoutes = require('./routes/series');
const filesRoutes = require('./routes/files');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const AutomatedUpdateService = require('./services/AutomatedUpdateService');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    store: new pgSession({
        conObject: {
            host: process.env.DB_HOST || 'postgres',
            port: process.env.DB_PORT || 5432,
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
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    }
}));

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
app.use('/api/files', filesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve the login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Serve the debug page
app.get('/debug', (req, res) => {
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

// Initialize superadmin user
const { initSuperadmin } = require('./database/init-superadmin');

// Start server
app.listen(PORT, async () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
    
    try {
        // Initialize superadmin user first
        await initSuperadmin();
        logger.info('Superadmin user initialized successfully');
        
        // Then initialize automated update service
        await automatedUpdateService.initialize();
        logger.info('Automated update service started successfully');
    } catch (error) {
        logger.error('Failed to initialize services:', error);
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await automatedUpdateService.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await automatedUpdateService.stop();
    process.exit(0);
});
