/**
 * Structured Logger (pino)
 *
 * Provides structured JSON logging for production and readable output for dev.
 * Use child loggers for domain-specific logging with automatic module context.
 */

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino/file',
    options: { destination: 1 } // stdout
  } : undefined,
  // In production, output JSON for log aggregation
  // In dev, use default pino formatting
});

// Create child loggers for specific domains
export const dbLogger = logger.child({ module: 'db' });
export const authLogger = logger.child({ module: 'auth' });
export const stripeLogger = logger.child({ module: 'stripe' });
export const jobLogger = logger.child({ module: 'jobs' });
export const integrationLogger = logger.child({ module: 'integrations' });
export const emailLogger = logger.child({ module: 'email' });
export const storageLogger = logger.child({ module: 'storage' });
export const redisLogger = logger.child({ module: 'redis' });

export type Logger = pino.Logger;
