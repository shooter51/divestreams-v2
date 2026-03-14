/**
 * Structured Logger (pino)
 *
 * Provides structured JSON logging for production and readable output for dev.
 * Use child loggers for domain-specific logging with automatic module context.
 *
 * Request ID propagation: every log line automatically includes `requestId`
 * when emitted inside an AsyncLocalStorage context set up by server/app.ts.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import pino from 'pino';

// ---------------------------------------------------------------------------
// Request context — populated per-request by server/app.ts
// ---------------------------------------------------------------------------

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

// ---------------------------------------------------------------------------
// Base logger
// ---------------------------------------------------------------------------

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino/file',
    options: { destination: 1 } // stdout
  } : undefined,
  // Automatically merge requestId into every log line when available
  mixin() {
    const requestId = requestContext.getStore()?.requestId;
    return requestId ? { requestId } : {};
  },
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

// HTTP access log child — used by pino-http in server/app.ts
export const httpLogger = logger.child({ module: 'http' });

export type Logger = pino.Logger;
