import logger from '../utils/logger.js';

/**
 * Global error handler middleware
 */
export function errorHandler(err, req, res, next) {
    // Log the error
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';

    res.status(err.status || 500).json({
        error: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack }),
    });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 404 handler
 */
export function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'Not found',
        path: req.url,
    });
}
