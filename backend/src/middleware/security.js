import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

/**
 * Rate limiting configuration
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Stricter rate limiting for auth endpoints
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 requests per 15 minutes
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true,
});

/**
 * Webhook rate limiting
 */
export const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 webhooks per minute
    message: 'Too many webhook requests',
});

/**
 * Security headers middleware
 */
export const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
});

/**
 * CORS configuration
 */
export const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL || 'http://localhost:3000',
            'http://localhost:3000', // Always allow localhost in development
        ];

        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
};

/**
 * Request logging middleware
 */
export function requestLogger(logger) {
    return (req, res, next) => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            const logData = {
                method: req.method,
                url: req.url,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip,
            };

            if (res.statusCode >= 400) {
                logger.warn('Request completed with error', logData);
            } else {
                logger.info('Request completed', logData);
            }
        });

        next();
    };
}

/**
 * Input validation middleware
 */
export function validateInput(schema) {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.details.map((d) => d.message),
            });
        }
        next();
    };
}
