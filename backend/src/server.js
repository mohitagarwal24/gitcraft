import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Database
import { db, testConnection, closeConnection } from './db/index.js';
import { createTables, migrateFromJSON } from './db/migrations.js';

// Stores
import SessionStore from './storage/sessionStore.js';
import RepositoryStore from './storage/repoStore.js';

// Services
import ContinuousSyncService from './services/continuousSync.js';

// Middleware
import { securityHeaders, corsOptions, apiLimiter, requestLogger } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';

// Routes
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhook.js';
import syncRoutes from './routes/sync.js';
import healthRoutes from './routes/health.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust first proxy (Render, Railway, etc.) for correct IP detection in rate limiting
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Initialize stores
const sessionStore = new SessionStore();
const repoStore = new RepositoryStore();
let syncService = null;

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));

// Request logging
app.use(requestLogger(logger));

// Rate limiting
app.use('/api', apiLimiter);

// Webhook route needs raw body
app.use('/webhook', express.raw({ type: 'application/json' }));

// Other routes use JSON parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make stores and services available to routes
app.locals.sessionStore = sessionStore;
app.locals.repoStore = repoStore;
app.locals.syncService = null; // Will be set after initialization

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/webhook', webhookRoutes);
app.use('/sync', syncRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

/**
 * Initialize database
 */
async function initializeDatabase() {
  if (!db) {
    logger.warn('Database not configured. Using file-based storage.');
    return false;
  }

  try {
    logger.info('Testing database connection...');
    const connected = await testConnection();

    if (!connected) {
      logger.warn('Database connection failed. Falling back to file storage.');
      return false;
    }

    logger.info('Creating database tables...');
    await createTables();

    logger.info('Migrating data from JSON files...');
    await migrateFromJSON();

    logger.info('✅ Database initialized successfully');
    return true;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    logger.warn('Falling back to file storage');
    return false;
  }
}

/**
 * Start server with async initialization
 */
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize session store
    logger.info('Initializing session store...');
    await sessionStore.cleanup(); // Clean expired sessions on startup

    // Initialize repository store
    logger.info('Initializing repository store...');
    await repoStore.initialize();

    // Start continuous sync service
    logger.info('Starting continuous sync service...');

    // Build config map from repoStore for sync service
    const repoConfigs = new Map();
    for (const [repoFullName, config] of repoStore.repos.entries()) {
      if (config.githubToken && config.craftMcpUrl) {
        repoConfigs.set(repoFullName, {
          githubToken: config.githubToken,
          craftMcpUrl: config.craftMcpUrl
        });
      }
    }

    syncService = new ContinuousSyncService(repoConfigs);
    app.locals.syncService = syncService;
    syncService.start();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info('');
      logger.info('╔════════════════════════════════════════════════════════════════╗');
      logger.info('║                                                                ║');
      logger.info('║               🚀 GitCraft Backend Server                       ║');
      logger.info('║                                                                ║');
      logger.info('╚════════════════════════════════════════════════════════════════╝');
      logger.info('');
      logger.info(`📡 Server: http://localhost:${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      logger.info(`💾 Database: ${db ? 'PostgreSQL ✅' : 'File-based 📁'}`);
      logger.info(`📊 Connected Repos: ${repoStore.size}`);
      logger.info(`🔄 Auto-Sync: ${syncService.isRunning ? 'ACTIVE ✅' : 'INACTIVE ⏸️'}`);
      logger.info('');
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);

  try {
    // Stop sync service
    if (syncService) {
      syncService.stop();
    }

    // Close database connection
    await closeConnection();

    logger.info('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();

export default app;


