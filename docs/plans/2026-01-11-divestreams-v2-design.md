# DiveStreams V2 - Architecture Design

**Date:** January 11, 2026
**Status:** Approved
**Type:** Greenfield rebuild

---

## Overview

Multi-tenant dive shop and dive tour management SaaS platform. Self-service model targeting English-speaking markets (US, UK, Australia, Caribbean, Southeast Asia).

**Key decisions:**
- Fresh start - no customers to migrate, no legacy constraints
- Cherry-pick useful code from v1, leave the rest behind
- Optimized for VPS deployment, not cloud-native

---

## Business Model

| Aspect | Decision |
|--------|----------|
| Model | Self-service SaaS (like Shopify) |
| Signup | Free 14-day trial, no credit card required |
| Target | Single-location dive shops, tour operators, training centers |
| Market | English-first (i18n deferred) |

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Remix | Built for traditional servers, better forms, keeps React |
| **UI** | React + shadcn/ui + Tailwind | Reuse v1 components |
| **Database** | PostgreSQL | Schema-per-tenant isolation |
| **ORM** | Drizzle | Type-safe, lightweight |
| **Auth** | Better Auth | Multi-tenant native, flexible |
| **Sessions** | Redis | Stateless app nodes |
| **Jobs** | BullMQ (Redis) | Background processing |
| **Payments** | Stripe | Subscriptions + tenant payments |
| **Email** | Nodemailer | Transactional email |
| **Storage** | MinIO | S3-compatible file storage |
| **Reverse Proxy** | Caddy | Auto-SSL, load balancing |
| **Process Manager** | PM2 | Clustering, zero-downtime deploys |

---

## Architecture

### High-Level

```
┌─────────────────────────────────────────────────────────────────┐
│                         LOAD BALANCER                           │
│                    (Caddy - auto SSL, reverse proxy)            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   App Node 1  │ │   App Node 2  │ │   App Node N  │
│   (Remix)     │ │   (Remix)     │ │   (Remix)     │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SHARED SERVICES                          │
├──────────────────┬──────────────────┬───────────────────────────┤
│   PostgreSQL     │     Redis        │        MinIO              │
│   (schemas)      │   (sessions,     │     (file storage)        │
│                  │    cache, jobs)  │                           │
└──────────────────┴──────────────────┴───────────────────────────┘
```

### Tenant Routing

Tenants access via subdomain: `{subdomain}.divestreams.com`

1. Request hits Caddy
2. Caddy routes `*.divestreams.com` to app nodes
3. App extracts subdomain from host header
4. Looks up tenant in `public.tenants`
5. Sets PostgreSQL `search_path` to tenant schema
6. All queries scoped to tenant automatically

---

## Multi-Tenancy

### Schema-Per-Tenant

```
database: divestreams
├── public                    # Shared tables
│   ├── tenants
│   ├── subscription_plans
│   └── global_settings
│
├── tenant_belize_diving      # Tenant schema
│   ├── users
│   ├── customers
│   ├── bookings
│   └── ...
│
└── tenant_[subdomain]        # Pattern
```

### Benefits

- **Data isolation** - Impossible to leak across tenants
- **Per-tenant backup** - `pg_dump -n tenant_xyz`
- **GDPR deletion** - `DROP SCHEMA tenant_xyz CASCADE`
- **Performance** - Move heavy tenants to dedicated DB later
- **Simpler queries** - No `WHERE tenant_id = ?` everywhere

### Provisioning

```typescript
async function provisionTenant(input: SignupInput) {
  // 1. Create tenant record in public.tenants
  // 2. CREATE SCHEMA tenant_{subdomain}
  // 3. Run migrations against new schema
  // 4. Seed default data
  // 5. Create owner user account
  // 6. Send welcome email
}
```

---

## Database Schema

### Public Schema (shared)

```typescript
tenants: {
  id: uuid
  subdomain: string           // unique
  name: string
  schema_name: string
  status: enum                // active, trial, suspended, cancelled
  plan_id: uuid
  trial_ends_at: timestamp
  billing_email: string
  stripe_customer_id: string
  stripe_subscription_id: string
  settings: jsonb             // timezone, currency
  created_at: timestamp
}

subscription_plans: {
  id: uuid
  name: string                // Starter, Pro, Enterprise
  price_monthly: decimal
  price_yearly: decimal
  stripe_price_id_monthly: string
  stripe_price_id_yearly: string
  limits: jsonb
  features: string[]
}
```

### Tenant Schema (per tenant)

**Core entities:**
- `users` - Staff accounts (owner, admin, manager, staff, instructor)
- `customers` - Customer profiles
- `bookings` - Tour/course bookings
- `tours` - Tours and dive trips
- `courses` - Training courses
- `schedules` - Tour/course schedules

**Operations:**
- `products` - Inventory items
- `equipment` - Rental equipment
- `rentals` - Equipment rental records
- `service_orders` - Repairs

**Financial:**
- `transactions` - POS transactions
- `payments` - Payment records
- `invoices` - Invoices

**Air fills:**
- `air_cards` - Prepaid fill cards
- `air_card_packages` - Package definitions
- `tank_fills` - Fill records

**Supporting:**
- `certifications` - Customer diving certifications
- `documents` - Waivers, signed docs
- `audit_logs` - Security audit trail

---

## Authentication & Authorization

### User Types

```typescript
// Staff (in tenant schema)
tenant_users: {
  id: uuid
  email: string
  password_hash: string
  role: enum              // owner, admin, manager, staff, instructor
  permissions: string[]   // granular overrides
  is_active: boolean
}

// Customers (separate, optional auth)
customers: {
  id: uuid
  email: string
  password_hash: string   // nullable
  // ... customer fields
}
```

### Role Permissions

```typescript
const ROLES = {
  owner: ['*'],
  admin: ['*', '-billing.delete_tenant'],
  manager: [
    'dashboard.*', 'booking.*', 'customer.*',
    'pos.*', 'inventory.*', 'report.view',
  ],
  staff: [
    'dashboard.view', 'booking.view', 'booking.create',
    'booking.checkin', 'customer.view', 'pos.sale',
  ],
  instructor: [
    'dashboard.view', 'booking.view', 'booking.checkin',
    'course.roster', 'customer.view', 'certification.create',
  ],
}
```

### Session Management

- Sessions stored in Redis (stateless app nodes)
- Contains: userId, tenantId, schemaName, role, permissions
- 7-day expiry with rolling extension
- Secure, httpOnly, sameSite cookies

---

## Project Structure

```
divestreams-v2/
├── app/
│   ├── routes/
│   │   ├── _public.tsx                 # Marketing layout
│   │   ├── _public._index.tsx          # Landing page
│   │   ├── _public.login.tsx
│   │   ├── _public.signup.tsx
│   │   │
│   │   ├── _tenant.tsx                 # Tenant layout
│   │   ├── _tenant._index.tsx          # Tenant homepage
│   │   ├── _tenant.tours.tsx
│   │   ├── _tenant.book.$slug.tsx
│   │   │
│   │   ├── _tenant.portal.tsx          # Customer portal
│   │   ├── _tenant.portal.bookings.tsx
│   │   │
│   │   ├── _tenant.admin.tsx           # Admin layout
│   │   ├── _tenant.admin._index.tsx    # Dashboard
│   │   ├── _tenant.admin.bookings.tsx
│   │   ├── _tenant.admin.customers.tsx
│   │   ├── _tenant.admin.pos.tsx
│   │   ├── _tenant.admin.inventory.tsx
│   │   ├── _tenant.admin.equipment.tsx
│   │   ├── _tenant.admin.tours.tsx
│   │   ├── _tenant.admin.courses.tsx
│   │   ├── _tenant.admin.fill-station.tsx
│   │   ├── _tenant.admin.invoices.tsx
│   │   ├── _tenant.admin.reports.tsx
│   │   ├── _tenant.admin.settings.tsx
│   │   │
│   │   └── api.webhooks.stripe.tsx
│   │
│   ├── entry.client.tsx
│   ├── entry.server.tsx
│   └── root.tsx
│
├── lib/
│   ├── db/
│   │   ├── schema.ts
│   │   ├── tenant.server.ts
│   │   └── queries/
│   ├── auth/
│   ├── stripe/
│   ├── email/
│   ├── jobs/
│   └── validation/
│
├── components/
│   ├── ui/                    # shadcn/ui
│   ├── pos/
│   ├── booking/
│   ├── admin/
│   └── shared/
│
├── hooks/
├── types/
│
├── public/
├── drizzle/                   # Migrations
│
├── scripts/
│   ├── tenant-create.ts
│   └── seed.ts
│
├── docker-compose.yml         # Local dev services
├── ecosystem.config.js        # PM2 config
├── Caddyfile
└── package.json
```

---

## V1 Feature Scope

### Must Have (MVP)

| Module | Features |
|--------|----------|
| **Dashboard** | Today's bookings, stats, alerts |
| **Bookings** | CRUD, check-in, payment status |
| **Tours** | CRUD, schedules, capacity, pricing |
| **Courses** | CRUD, schedules, roster |
| **Customers** | CRUD, search, history |
| **Certifications** | Add, verify, expiry tracking |
| **POS** | Cart, products, cash/card, receipts |
| **Inventory** | Products, stock levels, alerts |
| **Equipment** | Catalog, rentals, check-in/out |
| **Air Cards** | Packages, fill station, balances |
| **Invoices** | Create, send, track |
| **Reports** | Sales, bookings, daily close |
| **Settings** | Business info, timezone, branding |

### Deferred to V2

| Module | Rationale |
|--------|-----------|
| Loyalty program | Complex, low initial value |
| Gift cards | Nice-to-have |
| OTA integrations | Each channel is custom work |
| QuickBooks sync | Integration complexity |
| SMS conversations | Ongoing cost complexity |
| Review management | Not core operations |
| Offline mode | Architecture ready, defer implementation |
| Advanced reports | Basic first |

### V1 Success Criteria

> A single-location dive shop can run their entire operation - tours, courses, walk-in sales, rentals, fills - without needing any other software.

---

## Pricing

| Plan | Monthly | Yearly | Limits |
|------|---------|--------|--------|
| **Starter** | $49 | $490 | 2 staff, 200 bookings/mo |
| **Pro** | $99 | $990 | 5 staff, 1000 bookings/mo |
| **Enterprise** | $199 | $1,990 | Unlimited |

### Feature Gating

```typescript
const PLAN_FEATURES = {
  starter: ['core'],
  pro: ['core', 'service-orders', 'waivers', 'customer-portal'],
  enterprise: ['core', 'service-orders', 'waivers', 'customer-portal',
               'api-access', 'multi-location', 'custom-branding'],
}
```

---

## Deployment

### Single VPS (Initial)

- 8GB RAM, 4 vCPU (~$15/mo Hostinger KVM2)
- Caddy (reverse proxy, auto-SSL)
- PM2 cluster (3 Node processes)
- PostgreSQL, Redis, MinIO

### Scaling Path

| Stage | Tenants | Setup |
|-------|---------|-------|
| Launch | 1-50 | Single VPS, 8GB |
| Growth | 50-200 | Single VPS, 16GB |
| Scale | 200-500 | 2 VPS (app) + 1 VPS (DB) |
| Enterprise | 500+ | Multiple app VPS + DB cluster |

### CI/CD

- GitHub Actions: test → build → deploy
- SSH deploy to VPS
- PM2 rolling restart (zero-downtime)
- Backward-compatible migrations

---

## Security

### Multi-Tenant Isolation

1. **Schema isolation** - Primary protection
2. **Connection-level** - SET search_path per request
3. **Session validation** - Verify tenant access
4. **Audit logging** - Track sensitive operations

### Authentication

- Bcrypt password hashing
- Rate limiting (5 attempts / 15 min)
- Secure session cookies (httpOnly, sameSite, secure)
- HTTPS enforced (Caddy auto-SSL)

### Data Protection

- PII encryption at rest (AES-256-GCM)
- Per-tenant encryption keys
- Daily automated backups
- GDPR-compliant deletion (DROP SCHEMA)

---

## Code Reuse from V1

### Cherry-pick (copy to new repo)

| Source | Destination | Notes |
|--------|-------------|-------|
| `components/ui/*` | `components/ui/` | shadcn/ui direct copy |
| `components/pos/*` | `components/pos/` | POS components |
| `components/admin/*` | `components/admin/` | Admin UI components |
| `lib/stripe/*` | `lib/stripe/` | Payment logic |
| `lib/email/*` | `lib/email/` | Email templates |
| `lib/validation.ts` | `lib/validation/` | Zod schemas |
| `lib/pdf/*` | `lib/pdf/` | PDF generation |
| `hooks/*` | `hooks/` | React hooks |
| `types/*` | `types/` | TypeScript types |

### Leave behind

- Next.js App Router structure
- NextAuth configuration
- PowerSync / offline sync
- `tenant_id` column pattern
- Loyalty, OTA, QBO modules (rebuild when needed)

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Project setup | 2 days | Remix scaffold, structure, tooling |
| Database & auth | 3 days | Schema-per-tenant, Better Auth |
| Core components | 3 days | Migrate UI components |
| Bookings module | 3 days | Tours, courses, schedules, bookings |
| POS module | 2 days | Cart, checkout, receipts |
| Customers module | 2 days | CRUD, certifications |
| Equipment & fills | 2 days | Rentals, air cards |
| Signup & billing | 2 days | Trial, Stripe subscriptions |
| Polish & testing | 3 days | QA, bug fixes, deploy |
| **Total** | **~3 weeks** | Launchable MVP |

---

## References

- V1 codebase: `/Users/tomgibson/DiveStreams/DiveStreams/`
- V1 gap analysis: `DiveStreams/docs/GAP-ANALYSIS.md`
- DiveShop360 (competitor): https://diveshop360.com

---

*Design approved: January 11, 2026*
