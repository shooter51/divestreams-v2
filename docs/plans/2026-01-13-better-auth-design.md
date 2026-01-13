# Better Auth Migration Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate DiveStreams from custom auth (broken admin auth + schema-per-tenant) to Better Auth with single-schema architecture and full multi-tenancy support.

**Architecture:** Single PostgreSQL schema with `organization_id` on all tables. Better Auth handles users, sessions, and organizations. Platform admins are members of a special "platform" organization.

**Tech Stack:** Better Auth (already installed), Drizzle ORM, PostgreSQL, Stripe (existing)

---

## Core Architecture Decisions

| Decision | Choice |
|----------|--------|
| Auth library | Better Auth v1.2.0 (installed) |
| Data model | Single schema with `organization_id` |
| Email uniqueness | Globally unique (one account, multiple orgs) |
| Initial features | Email + password only (OAuth/2FA later) |
| Platform admins | "DiveStreams Platform" organization |
| Business data | Single schema (not schema-per-tenant) |
| Signup flow | Self-service with 14-day trial |
| Session duration | 30 days |

---

## Roles & Permissions

### Organization Roles

| Role | Description |
|------|-------------|
| `owner` | Created org or transferred ownership. Full control. One per org. |
| `admin` | Manage team, settings, all operations. Cannot delete org or transfer ownership. |
| `staff` | Day-to-day operations: POS, bookings, customers, equipment. |
| `customer` | View own data only: bookings, rentals, profile. |

### Customer Permissions (Lowest Role)

| Action | Allowed |
|--------|---------|
| View/edit own profile | Yes |
| View own bookings | Yes |
| View own rental history | Yes |
| Book trips (if enabled) | Yes |
| View other customers | No |
| Access POS | No |
| View financials/reports | No |
| Manage equipment/inventory | No |
| Manage tours/trips | No |
| Invite/manage team | No |

### Platform Roles

| Role | Description |
|------|-------------|
| `owner` | Platform owner (you). Full control. |
| `admin` | Platform administrators. Manage all tenants. |
| `viewer` | Read-only access to platform dashboard. |

---

## Database Schema

### Better Auth Tables (Auto-Generated)

```sql
public.user          -- All users (platform + tenant)
public.session       -- Active sessions
public.account       -- OAuth accounts (future)
public.verification  -- Email verification tokens
public.organization  -- Dive shops + "platform" org
public.member        -- User <-> Org relationships with roles
public.invitation    -- Pending org invitations
```

### Business Tables (All with organization_id)

```sql
public.customers        -- organization_id, email, name, phone, certifications...
public.tours            -- organization_id, name, description, price, duration...
public.trips            -- organization_id, tour_id, date, start_time, capacity...
public.bookings         -- organization_id, trip_id, customer_id, status...
public.equipment        -- organization_id, name, category, status, rental_rate...
public.products         -- organization_id, name, sku, price, stock_quantity...
public.transactions     -- organization_id, type, amount, payment_method...
public.boats            -- organization_id, name, capacity, registration...
public.dive_sites       -- organization_id, name, location, max_depth...
public.rentals          -- organization_id, equipment_id, customer_id, status...
public.discount_codes   -- organization_id, code, discount_type, value...
```

### Additional Tables

```sql
public.subscription     -- organization_id, stripe_customer_id, plan, status...
public.access_request   -- For tracking join requests (future use)
public.audit_log        -- organization_id, user_id, action, timestamp (future)
```

---

## Authentication Flows

### New User Signup (Creates Dive Shop)

```
1. User visits divestreams.com/signup
2. Enters: email, password, name
3. Better Auth creates user in public.user
4. Email verification sent (24-48 hour grace period)
5. Onboarding: "Create your dive shop"
6. Enters: shop name, subdomain (validated against blocklist)
7. System creates organization + member (role: owner)
8. Creates subscription record (plan: free, status: trialing, trial_ends: +14 days)
9. Redirect to {subdomain}.divestreams.com/app
10. Session cookie set, user is logged in
```

### Existing User Creates Second Org

```
1. User visits divestreams.com (marketing site)
2. Clicks "Start your dive shop"
3. System detects logged-in user (session cookie)
4. Skips account creation
5. Onboarding: "Create your dive shop"
6. Same flow as steps 6-10 above
```

### Sign In (Existing User)

```
1. User visits {subdomain}.divestreams.com/login
2. Enters email + password
3. Better Auth validates credentials, creates session
4. App checks: is user a member of this org (by subdomain/slug)?
5. Yes → Redirect to /app with appropriate role-based view
6. No → Show "Not a member" screen with join option
```

### Accessing Org You're Not a Member Of

```
1. User signs in at {subdomain}.divestreams.com
2. Valid credentials, session created
3. User is NOT a member of this org
4. Show prompt:
   ┌─────────────────────────────────────────┐
   │ You're not a member of {Shop Name}      │
   │                                         │
   │ Would you like to join as a customer?   │
   │                                         │
   │ [Join as Customer]    [Cancel]          │
   └─────────────────────────────────────────┘
5. Click "Join as Customer"
   → Create member record (role: customer)
   → Redirect to /app (customer view)
```

### Platform Admin Access

```
1. Admin visits admin.divestreams.com/login
2. Same login flow (email + password)
3. App checks: is user a member of "platform" org?
4. Yes → Redirect to /dashboard
5. No → Show "Not a member" with option to join as "viewer"
```

### Password Reset

```
1. User clicks "Forgot password"
2. Enters email address
3. Better Auth sends reset link
4. User clicks link, sets new password
5. Auto-logged in, redirected to app
```

---

## Platform Admin Bootstrap

On first deployment:

```
1. App starts with env var: PLATFORM_ADMIN_EMAIL=admin@divestreams.com
2. Startup check: does "platform" organization exist?
3. No →
   a. Create "platform" organization (slug: "platform", name: "DiveStreams Platform")
   b. Create invitation for PLATFORM_ADMIN_EMAIL (role: owner)
   c. Send invitation email
4. Admin clicks link → creates account → sets password → becomes platform owner
5. Subsequent deployments: "platform" exists, skip bootstrap
```

---

## Organization Management

### Inviting Team Members

```
Settings → Team Management

┌─────────────────────────────────────────────────┐
│ Team Members                                    │
├─────────────────────────────────────────────────┤
│ john@email.com     Owner      [cannot change]   │
│ jane@email.com     Admin      [▼ Change Role]   │
│ bob@email.com      Staff      [▼ Change Role]   │
│ sue@email.com      Customer   [▼ Change Role]   │
├─────────────────────────────────────────────────┤
│ [Invite Team Member]                            │
│ Email: ________  Role: [Staff ▼]  [Send Invite] │
└─────────────────────────────────────────────────┘
```

- **Invite new user:** Email sent → they create account (or sign in) → join with assigned role
- **Change role:** Immediate upgrade/downgrade (except owner)
- **Remove member:** Soft delete membership, user account remains, audit trail preserved

### Organization Switching

```
┌─────────────────────────┐
│ ▼ Blue Reef Diving      │  ← Current org (header dropdown)
├─────────────────────────┤
│   Blue Reef Diving  ✓   │
│   Ocean Adventures      │
│   Acme Scuba            │
└─────────────────────────┘
```

- Dropdown shows all orgs user belongs to
- Click to switch → redirect to that subdomain
- Uses Better Auth's `organization.list()` API

### Owner Transfer

```
1. Current owner: Settings → Team → Transfer Ownership
2. Select existing admin/staff member
3. Confirm with password
4. System sends email to new owner: "Accept ownership of {Shop Name}?"
5. New owner clicks link, confirms
6. Ownership transferred:
   - New owner: role = owner
   - Previous owner: role = admin
```

### Organization Deletion

```
1. Owner: Settings → Danger Zone → Delete Organization
2. Confirm by typing org name
3. Soft delete:
   - Organization marked inactive
   - Subdomain still reserved
   - Data retained for 90 days
4. Warning emails at 30, 60, 80 days
5. After 90 days:
   - Hard delete all data
   - Subdomain released
```

---

## Freemium Model

### Pricing Tiers

| Feature | Free | Premium |
|---------|------|---------|
| Customers | Up to 50 | Unlimited |
| Bookings/month | Up to 20 | Unlimited |
| Tours | Up to 3 | Unlimited |
| POS | No | Yes |
| Equipment rentals | No | Yes |
| Reports/analytics | Basic | Full |
| Team members | Owner only | Unlimited |
| Email notifications | No | Yes |
| Data export | Yes | Yes |
| Custom subdomain | Yes | Yes |

### Trial Period

- 14-day trial with full Premium features
- Trial ends → downgrade to Free tier
- Hitting Free limits → block new (keep existing data accessible)

### Upgrade Flow

```
1. User: Settings → Billing → Upgrade
2. Choose plan:
   - Monthly: $X/month
   - Annual: $Y/year (save 20%)
3. Stripe checkout
4. Instant upgrade on payment success
```

### Hitting Free Tier Limits

- Block new entries (e.g., can't add 51st customer)
- Existing data remains accessible
- Show upgrade prompts throughout UI
- No grace period or overage

---

## Stale Tenant Cleanup (Free Accounts Only)

**Applies to:** Free tier organizations only. Paying customers retained indefinitely.

**Definition of stale:** No logins from any team member.

### Timeline

| Days Inactive | Action |
|---------------|--------|
| 60 days | First warning email to owner |
| 75 days | Second warning email |
| 90 days | Organization deleted (soft delete → 90-day retention → hard delete) |

### Email Content

**First Warning (Day 60):**
> Your dive shop "{Shop Name}" hasn't been accessed in 60 days. Log in to keep your account active, or it will be deleted in 30 days.

**Second Warning (Day 75):**
> Final notice: "{Shop Name}" will be permanently deleted in 15 days unless you log in.

---

## Reserved Subdomains

Block these subdomains from organization creation:

```
admin, www, api, app, static, assets, mail, smtp, ftp, cdn,
auth, login, signup, dashboard, support, help, billing,
status, docs, blog, shop, store, test, staging, dev, demo,
platform, system, root, null, undefined, account, accounts,
settings, config, webhook, webhooks, callback, oauth
```

---

## Email Verification

- **Timing:** 24-48 hour grace period
- **Flow:** User can create account and org immediately
- **Enforcement:** Unverified after 48 hours → account suspended
- **Resume:** Verify email → account reactivated

---

## Data Export

- **Location:** Settings → Data → Export
- **Format:** CSV (one file per table) or JSON
- **Includes:** All organization data (customers, bookings, tours, transactions, etc.)
- **Availability:** All users (Free and Premium)

---

## Migration Plan

### Pre-Migration

1. Delete all existing tenants (confirmed: starting fresh)
2. Remove old schema-per-tenant code
3. Drop tenant_* schemas

### Database Changes

1. Run Better Auth CLI to generate auth tables
2. Create business tables with `organization_id` column
3. Create indexes on `organization_id` for all tables
4. Create subscription table for billing

### Code Changes

1. Remove `lib/auth/admin-auth.server.ts` (custom admin auth)
2. Remove `lib/auth/tenant-auth.server.ts` (schema switching)
3. Configure Better Auth with organization plugin
4. Update all queries: add `WHERE organization_id = ?`
5. Update routing: subdomain → org lookup → context
6. Create org switcher component
7. Create team management UI
8. Update billing to use organization_id

### Environment Variables

```env
# Existing
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# New
PLATFORM_ADMIN_EMAIL=admin@divestreams.com
BETTER_AUTH_SECRET=<generate-secure-secret>
```

---

## Success Criteria

- [ ] Admin can log in at admin.divestreams.com
- [ ] New user can sign up and create dive shop
- [ ] User can log in to their dive shop subdomain
- [ ] User can join existing org as customer
- [ ] Owner can invite team members with roles
- [ ] Owner can change member roles
- [ ] Owner can transfer ownership
- [ ] Owner can delete organization
- [ ] User can switch between multiple orgs
- [ ] Free tier limits enforced
- [ ] Upgrade to Premium works via Stripe
- [ ] Stale free tenant cleanup runs on schedule
- [ ] Data export works for all users
- [ ] Password reset works
- [ ] Sessions last 30 days
