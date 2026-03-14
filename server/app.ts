/**
 * Custom Express server for DiveStreams v2.
 *
 * Replicates @react-router/serve behaviour while adding:
 *  - pino-http request logging
 *  - AsyncLocalStorage request-ID propagation (so every child logger includes requestId)
 */

import crypto from 'node:crypto';
import path from 'node:path';
import { createRequestHandler } from '@react-router/express';
import compression from 'compression';
import express from 'express';
import pinoHttp from 'pino-http';

import { httpLogger, requestContext } from '../lib/logger';

const app = express();

// Match react-router-serve behaviour
app.disable('x-powered-by');
app.use(compression());

// Static assets — long-lived immutable cache for hashed assets
app.use(
  '/assets',
  express.static(path.join(process.cwd(), 'build/client/assets'), {
    immutable: true,
    maxAge: '1y',
  }),
);

// Client build directory
app.use(express.static(path.join(process.cwd(), 'build/client')));

// Public directory — 1-hour cache
app.use(express.static(path.join(process.cwd(), 'public'), { maxAge: '1h' }));

// HTTP request logging via pino-http
app.use(
  pinoHttp({
    logger: httpLogger,
    // Generate a unique request ID for every incoming request
    genReqId: () => crypto.randomUUID(),
    // Store the request ID in AsyncLocalStorage so all child loggers pick it up
    customSuccessMessage: (_req, res) => `${res.statusCode}`,
    // Skip health-check requests to avoid log noise
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
    // Minimal serializers — keeps log lines concise
    serializers: {
      req: (req) => ({ method: req.method, url: req.url, id: req.id }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    // Hook fires for every request; populate AsyncLocalStorage here
    customProps: (req) => {
      const requestId = req.id as string;
      // We cannot use .run() in customProps (not a middleware position),
      // so instead we store the ID in a way the next middleware can pick up.
      // The actual ALS population happens in the dedicated middleware below.
      return { requestId };
    },
  }),
);

// Propagate request ID into AsyncLocalStorage so all downstream loggers include it
app.use((req, _res, next) => {
  const requestId = (req as express.Request & { id?: string }).id ?? crypto.randomUUID();
  requestContext.run({ requestId }, next);
});

// React Router request handler — wrapped so it inherits the ALS context
app.all(
  '*',
  createRequestHandler({
    // build is loaded dynamically at startup; cast required because the
    // type expects the full ServerBuild shape which is resolved at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    build: () => import('../build/server/index.js') as any,
    mode: process.env.NODE_ENV,
  }),
);

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST;

const server = host
  ? app.listen(port, host, onListen)
  : app.listen(port, onListen);

function onListen() {
  console.log(`[custom-server] http://localhost:${port}`);
}

['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.once(signal, () => server?.close(console.error));
});
