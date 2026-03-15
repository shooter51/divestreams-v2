import { Registry, collectDefaultMetrics, Histogram, Counter, Gauge } from 'prom-client';

export const registry = new Registry();
registry.setDefaultLabels({ app: 'divestreams', env: process.env.NODE_ENV || 'development' });
collectDefaultMetrics({ register: registry });

// HTTP metrics (used by the custom server)
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

// Business metrics
export const bookingsCreatedTotal = new Counter({
  name: 'bookings_created_total',
  help: 'Total bookings created',
  labelNames: ['organization_id', 'channel'],
  registers: [registry],
});

export const paymentsProcessedTotal = new Counter({
  name: 'payments_processed_total',
  help: 'Total payments processed',
  labelNames: ['organization_id', 'status'],
  registers: [registry],
});

// Queue metrics
export const jobsProcessedTotal = new Counter({
  name: 'jobs_processed_total',
  help: 'Total background jobs processed',
  labelNames: ['queue', 'status'],
  registers: [registry],
});

export const queueDepth = new Gauge({
  name: 'queue_depth',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue'],
  registers: [registry],
});
