# DiveStreams V2

Multi-tenant SaaS platform for dive shop and tour management. Features booking management, POS system, customer CRM, equipment rentals, and accounting integrations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Caddy (Reverse Proxy)                  │
│              *.divestreams.app → tenant routing             │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  React Router v7 (SSR)                      │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │ Marketing│  │  Tenant  │  │   Site   │  │  Admin   │  │
│   │  Routes  │  │  Routes  │  │  Routes  │  │  Routes  │  │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Shared Services                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐   │
│  │  Auth   │  │   DB    │  │ Stripe  │  │ Integrations│   │
│  │(Better) │  │(Drizzle)│  │Webhooks │  │ (QB, Xero)  │   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│           PostgreSQL (Shared Schema Multi-Tenant)           │
│              All tables filtered by organization_id         │
└─────────────────────────────────────────────────────────────┘
```

## Stack

- **Framework:** React Router v7 (Remix)
- **Database:** PostgreSQL (shared-schema multi-tenant)
- **ORM:** Drizzle
- **Auth:** Better Auth with organization plugin
- **UI:** React + shadcn/ui + Tailwind CSS
- **Payments:** Stripe Connect
- **Jobs:** BullMQ + Redis
- **Deployment:** VPS (Caddy + PM2)

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL and Redis (Docker)
docker compose up -d

# Run migrations
npm run db:migrate

# Create a test tenant
npm run tenant:create -- --subdomain=demo --name="Demo Shop"

# Start dev server
npm run dev
```

Access at: `http://demo.localhost:5173`

## Project Structure

```
divestreams-v2/
├── app/
│   ├── routes/              # React Router routes
│   ├── components/          # React components
│   └── root.tsx            # Root layout
├── lib/
│   ├── db/                  # Database schema & queries
│   ├── auth/                # Authentication
│   ├── stripe/              # Payment processing
│   ├── email/               # Email templates
│   ├── jobs/                # Background jobs
│   └── validation/          # Zod schemas
├── scripts/                 # CLI scripts
├── drizzle/                 # Migrations
└── docs/
    ├── plans/              # Architecture design
    └── infrastructure/     # VPS documentation
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Secret for session encryption (32+ chars) |
| `BETTER_AUTH_URL` | Yes | Base URL for auth (e.g., `https://divestreams.app`) |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `REDIS_URL` | No | Redis URL for job queue (defaults to localhost) |
| `INTEGRATION_ENCRYPTION_KEY` | Prod | Encryption key for OAuth tokens |
| `SMTP_HOST` | No | SMTP server for emails |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASSWORD` | No | SMTP password |
| `S3_BUCKET` | No | S3 bucket for file uploads |
| `S3_REGION` | No | AWS region |

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run typecheck    # TypeScript check
npm run test         # Run tests
npm run db:studio    # Open Drizzle Studio
npm run db:migrate   # Run migrations
npm run tenant:create # Create new tenant
npm run worker       # Start background job worker
```

## Testing

### Unit Tests (Vitest)
```bash
npm test                        # Run all unit tests
npm test -- --watch            # Watch mode
npm test -- --coverage         # With coverage report
npm test -- tests/unit/auth    # Test specific folder
```

### E2E Tests (Playwright)
```bash
npm run test:e2e               # Run all E2E tests
npm run test:e2e:ui            # Interactive UI mode
npm run test:e2e -- --debug    # Debug mode
```

### Test Structure
```
tests/
├── unit/           # Vitest unit tests
│   ├── lib/        # Library function tests
│   └── components/ # Component tests
├── integration/    # API integration tests
└── e2e/           # Playwright E2E tests
    ├── workflow/   # User workflow tests
    └── *.page.ts   # Page objects
```

## Documentation

- [Architecture Design](docs/plans/2026-01-11-divestreams-v2-design.md)
- [VPS Infrastructure](docs/infrastructure/VPS-INFRASTRUCTURE.md)

## Deployment

```bash
# SSH to VPS
ssh root@72.62.166.128

# Navigate to project
cd /var/www/divestreams.com

# Pull and rebuild
git pull origin main
npm install
npm run build

# Restart
pm2 restart divestreams
```
