# DiveStreams Scale Test Results — 2026-03-12

## Overview

Full scalability test of the DiveStreams multi-tenant SaaS platform on the Test VPS (KVM 4: 4 cores, 16 GB RAM, Hostinger). Tested with 202 tenants (200 scale tenants + demo + tdsla) using a custom Playwright-based load test harness with concurrent browser workers.

## Test Infrastructure

| Component | Details |
|-----------|---------|
| **Test VPS** | Hostinger KVM 4 — 4 vCPUs, 16 GB RAM, 200 GB disk |
| **OS** | Ubuntu 24.04 LTS |
| **Database** | PostgreSQL 16 (Docker container) |
| **App** | Node.js / React Router v7 SSR (Docker container) |
| **Cache** | Redis 7 (Docker container) |
| **Proxy** | Caddy 2 (Docker container, auto SSL) |
| **Tenants** | 202 (each seeded with tours, trips, courses, equipment, gallery, customers) |
| **Codebase** | 127,122 lines of source code |

## Load Test Harness

952 lines of TypeScript across 4 files (`scripts/scale-test/loadtest/`):

- **orchestrator.ts** — tenant discovery, worker spawning, metrics aggregation, graceful shutdown
- **worker.ts** — Playwright headless Chromium, 9-step user flow per session
- **metrics.ts** — aggregation, CSV/NDJSON output, ANSI terminal dashboard
- **types.ts** — shared interfaces

### Session Flow (9 steps per session)

Each worker simulates a visitor browsing a tenant's public site:

1. Homepage (`/site`)
2. Trips listing (`/site/trips`)
3. Trip detail (click first trip link, skip if none)
4. Back (browser back)
5. Courses listing (`/site/courses`)
6. Course detail (click first course link, skip if none)
7. Equipment (`/site/equipment`)
8. Gallery (`/site/gallery`)
9. Contact (`/site/contact`)

Random 0.5–1.5s think time between each step. ~8s of each session is think time.

## Results — Before Resource Tuning

Container resource limits: app 2 GB / 4 CPU, worker 256 MB / 0.5 CPU, Postgres unlimited, Redis unlimited.

| Metric | 10 workers | 20 workers | 25 workers | 30 workers | 40 workers |
|--------|-----------|-----------|-----------|-----------|-----------|
| **Sessions/min** | 40 | 84 | 96 | 106 | 102 |
| **Error rate** | 0% | 0% | 0% | 0% | 0% |
| **Avg session** | 14.4s | 14.6s | 17.3s | 18.6s | 22.4s |
| **p50 step** | 316ms | 346ms | 624ms | 769ms | 1,299ms |
| **p95 step** | 1,041ms | 1,081ms | 1,885ms | 2,280ms | 3,034ms |

### Key observations (pre-tuning)

- **Sweet spot: 20 concurrent users.** Near-linear throughput scaling from 10→20 with negligible latency increase.
- **Degradation starts at 25.** p50 nearly doubles (346→624ms), avg session up 18%.
- **Throughput plateaus at 30–40.** Adding workers beyond 30 doesn't increase throughput — just queues on the server side.
- **Zero errors at all levels.** The app never crashes or returns 5xx, it just gets slower.
- **Slowest steps:** `courses_list` (1,050ms avg), `homepage` (700ms avg), `trips_list` (450ms avg) — all DB-heavy SSR pages.

## Results — After Resource Tuning

Updated container limits: app 4 GB / 3 CPU, Postgres 8 GB / 2 CPU, Redis 1 GB / 0.5 CPU, worker 512 MB / 0.5 CPU.

| Metric | 20 workers | 30 workers | 40 workers | 60 workers |
|--------|-----------|-----------|-----------|-----------|
| **Sessions/min** | 80 | 90 | **134** | 98 |
| **Error rate** | 0% | 0% | 0% | 0% |
| **Avg session** | 15.3s | 17.7s | 22.1s | 27.9s |
| **p50 step** | 355ms | 626ms | 1,088ms | 1,809ms |
| **p95 step** | 1,237ms | 1,993ms | 3,210ms | 4,590ms |

### Key observations (post-tuning)

- **20-worker baseline unchanged.** Resource tuning didn't help at low concurrency (memory was never the bottleneck).
- **Peak throughput improved 31%.** At 40 workers: 134 sessions/min vs 102 before.
- **Throughput collapses at 60.** Drops from 134 to 98 — adding more workers increases context switching overhead.
- **Bottleneck is CPU, not memory.** Containers used <5% of allocated RAM. PostgreSQL and Node.js compete for 4 cores.

## Comparison: Before vs After Resource Tuning at 40 Workers

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Sessions/min | 102 | 134 | **+31%** |
| Avg session | 22.4s | 22.1s | -1% |
| p50 step | 1,299ms | 1,088ms | **-16%** |
| p95 step | 3,034ms | 3,210ms | +6% |

## Bottleneck Analysis

### Primary bottleneck: CPU (4 cores shared)

Evidence:
- Memory barely utilized — app at 157 MB / 4 GB, Postgres at 29 MB / 8 GB
- Slowest steps are query-heavy pages with multi-tenant JOINs filtered by `organization_id`
- Throughput peaks then drops — classic CPU saturation pattern
- Node.js is single-threaded for request handling; SSR + Drizzle query building pegs one core while Postgres uses the others

### Slowest pages (consistent across all test runs)

| Page | Avg response time | Root cause |
|------|------------------|------------|
| `courses_list` | ~1,050ms | 4-table JOIN: training_courses + agency_course_templates + certification_agencies + certification_levels, plus images table lookup |
| `homepage` | ~700ms | Calls both getPublicTrips and getPublicCourses |
| `trips_list` | ~450ms | JOIN: trips + tours, count query |
| `equipment` | ~350ms | Simple filtered query |
| `gallery` | ~300ms | Simple filtered query |
| `contact` | ~300ms | Minimal DB access |

## Mitigation: Redis Caching (implemented, pending deployment)

Added 60-second TTL Redis cache for all public site query functions (PR #574):

- `getPublicTrips` — cached by orgId + page + limit
- `getPublicCourses` — cached by orgId + page + limit + upcomingSessions flag
- `getPublicEquipment` — cached by orgId + page + limit
- `getPublicSiteSettings` — cached by orgId

Expected impact: Within each 60s window, only the first request per tenant per page hits Postgres. With 202 tenants and 40 concurrent workers cycling through them, most requests should be cache hits. This should dramatically reduce DB CPU load and push the degradation breakpoint significantly higher.

Cache invalidation function `invalidatePublicSiteCache(orgId)` is available for tenant content updates.

## Scaling Options (ranked by effort/impact)

| Option | Effort | Expected impact | Cost |
|--------|--------|----------------|------|
| **Redis caching (60s TTL)** | Done | 3-5x improvement at high concurrency | Free |
| **PM2 clustering** (4 Node.js workers) | Low | ~2x throughput (use all 4 cores) | Free |
| **Separate DB to own VPS** | Medium | Eliminates CPU contention between app and Postgres | ~$15/mo |
| **Upgrade to KVM 8** (8 cores / 32 GB) | Low | ~2x capacity | ~$20/mo more |
| **Kubernetes** | High | Horizontal scaling, rolling deploys | Ops complexity |

### Recommendation

The Redis caching (already implemented) should be the first step. If more capacity is needed:
1. Add PM2 clustering (free, significant throughput improvement)
2. Separate Postgres to its own VPS (eliminates the core contention problem)
3. Upgrade VPS plan only if the above aren't sufficient

Kubernetes is premature — the current architecture handles 200+ tenants with 20 concurrent users comfortably, which exceeds likely production load for a dive shop SaaS.

## Container Resource Configuration (current)

| Container | CPU Limit | Memory Limit |
|-----------|----------|-------------|
| app | 3.0 | 4 GB |
| db (postgres) | 2.0 | 8 GB |
| worker | 0.5 | 512 MB |
| zapier-worker | 0.25 | 256 MB |
| redis | 0.5 | 1 GB |
| caddy | unlimited | unlimited |

## Fixes Applied During Testing

1. **`training_courses.image_override` column missing** — migration 0053 created, column added directly to test DB
2. **`agency_course_templates.translations` column missing** — migration 0054 created, column added directly to test DB
3. **Public sites disabled for scale tenants** — bulk SQL UPDATE to enable public site settings
4. **Load test worker timeouts** — fixed steps 3/6 to skip clicking when no trip/course links exist
5. **4 orphaned scale tenants** (scale-001, 002, 003, 010) — deleted and recreated with proper owner accounts

## Raw Data

Metrics output files from each test run stored in `scripts/scale-test/loadtest/`:
- `metrics.csv` — time-series CSV with per-tick aggregates
- `metrics.ndjson` — newline-delimited JSON with full per-session detail
