/**
 * Structured Logger
 * 
 * Provides consistent logging across the application.
 * In production, this can be upgraded to pino for JSON logging.
 * 
 * Usage:
 *   import { logger } from '~/lib/utils/logger';
 *   logger.info({ userId, action: 'login' }, 'User logged in');
 *   logger.error({ error, context: 'stripe' }, 'Payment failed');
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface Logger {
  debug(context: LogContext, message: string): void;
  debug(message: string): void;
  info(context: LogContext, message: string): void;
  info(message: string): void;
  warn(context: LogContext, message: string): void;
  warn(message: string): void;
  error(context: LogContext, message: string): void;
  error(message: string): void;
  child(bindings: LogContext): Logger;
}

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as LogLevel;

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

function formatMessage(level: LogLevel, context: LogContext | string, message?: string): string {
  const timestamp = new Date().toISOString();
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (typeof context === 'string') {
    // Simple message without context
    if (isProduction) {
      return JSON.stringify({ timestamp, level, msg: context });
    }
    return `[${timestamp}] ${level.toUpperCase()}: ${context}`;
  }
  
  // Message with context
  if (isProduction) {
    return JSON.stringify({ timestamp, level, msg: message, ...context });
  }
  
  const contextStr = Object.keys(context).length > 0 
    ? ` ${JSON.stringify(context)}` 
    : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
}

function createLogger(bindings: LogContext = {}): Logger {
  const log = (level: LogLevel, contextOrMsg: LogContext | string, message?: string) => {
    if (!shouldLog(level)) return;
    
    const mergedContext = typeof contextOrMsg === 'object' 
      ? { ...bindings, ...contextOrMsg }
      : bindings;
    
    const finalMsg = typeof contextOrMsg === 'string' ? contextOrMsg : message;
    const output = formatMessage(level, Object.keys(mergedContext).length > 0 ? mergedContext : (finalMsg || ''), finalMsg);
    
    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  };

  return {
    debug: (contextOrMsg: LogContext | string, message?: string) => log('debug', contextOrMsg, message),
    info: (contextOrMsg: LogContext | string, message?: string) => log('info', contextOrMsg, message),
    warn: (contextOrMsg: LogContext | string, message?: string) => log('warn', contextOrMsg, message),
    error: (contextOrMsg: LogContext | string, message?: string) => log('error', contextOrMsg, message),
    child: (childBindings: LogContext) => createLogger({ ...bindings, ...childBindings }),
  };
}

export const logger = createLogger();

// Pre-configured loggers for common modules
export const authLogger = logger.child({ module: 'auth' });
export const dbLogger = logger.child({ module: 'db' });
export const stripeLogger = logger.child({ module: 'stripe' });
export const integrationLogger = logger.child({ module: 'integrations' });
