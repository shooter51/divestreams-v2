# DiveStreams V2

Multi-tenant dive shop management SaaS platform.

## Stack

- **Framework:** React Router v7 (Remix)
- **Database:** PostgreSQL (schema-per-tenant)
- **ORM:** Drizzle
- **Auth:** Better Auth
- **UI:** React + shadcn/ui + Tailwind CSS
- **Payments:** Stripe
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
