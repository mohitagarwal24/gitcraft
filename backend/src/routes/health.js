import express from 'express';
import { db } from '../db/index.js';

const router = express.Router();

/**
 * Basic health check
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

/**
 * Readiness probe (checks database connection)
 */
router.get('/health/ready', async (req, res) => {
    const checks = {
        server: 'ok',
        database: 'unknown',
    };

    // Check database
    if (db) {
        try {
            await db.execute('SELECT 1');
            checks.database = 'ok';
        } catch (error) {
            checks.database = 'error';
            return res.status(503).json({
                status: 'not ready',
                checks,
                error: 'Database connection failed',
            });
        }
    } else {
        checks.database = 'not configured';
    }

    res.json({
        status: 'ready',
        checks,
        timestamp: new Date().toISOString(),
    });
});

/**
 * Basic metrics endpoint
 */
router.get('/metrics', async (req, res) => {
    const sessionStore = req.app.locals.sessionStore;
    const repoStore = req.app.locals.repoStore;
    const syncService = req.app.locals.syncService;

    const metrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        sessions: sessionStore ? await sessionStore.count() : 0,
        repositories: repoStore ? repoStore.size : 0,
        syncService: syncService ? syncService.getStatus() : { isRunning: false },
        timestamp: new Date().toISOString(),
    };

    res.json(metrics);
});

export default router;
