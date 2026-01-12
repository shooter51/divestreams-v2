# Admin Dashboard Design

## Overview

Platform admin dashboard for managing tenants and subscription plans in DiveStreams SaaS.

## Access

- URL: `admin.divestreams.com`
- Authentication: Simple password protection via `ADMIN_PASSWORD` environment variable
- Session: Signed cookie, 24-hour expiry

## Routes

```
admin.divestreams.com/
├── /login          → Password form
├── /               → Tenant list (dashboard)
├── /tenants/new    → Create tenant
├── /tenants/:id    → View/edit tenant
├── /plans          → List subscription plans
├── /plans/:id      → Edit plan
```

## Authentication Flow

1. User visits any admin route
2. `requireAdmin()` checks for valid `admin_session` cookie
3. If missing/invalid, redirect to `/login`
4. Login form validates password against `ADMIN_PASSWORD` env var
5. On success, set signed cookie and redirect to `/`
6. Logout clears cookie

## Tenant Management

### List View (`/`)
- Table: Subdomain, Name, Email, Plan, Status, Created, Actions
- Status badges: trialing (blue), active (green), past_due (yellow), canceled (red)
- Quick actions: Edit, Toggle Active, Delete
- Search filter by subdomain/name/email
- "Create Tenant" button

### Create/Edit Form (`/tenants/new`, `/tenants/:id`)
Fields:
- Subdomain (create only, immutable after)
- Name, Email, Phone
- Timezone (dropdown), Currency (dropdown)
- Plan (dropdown from subscription_plans)
- Subscription Status (trialing/active/past_due/canceled)
- Trial Ends At (date picker)
- Active (toggle)

Actions:
- Save
- Delete (edit page only, with confirmation)
- "Login as Tenant" link (opens subdomain in new tab)

## Subscription Plan Management

### List View (`/plans`)
- Table: Name, Display Name, Monthly Price, Yearly Price, Active, Actions
- Toggle active/inactive
- "Add Plan" button

### Edit Form (`/plans/:id`)
Fields:
- Name (internal slug)
- Display Name
- Monthly Price (dollars, stored as cents)
- Yearly Price
- Stripe Price IDs (monthly/yearly)
- Features (textarea, one per line)
- Limits: Users, Customers, Tours/Month, Storage GB
- Active (toggle)

Note: Plans cannot be deleted, only deactivated.

## Files to Create

```
app/routes/admin/
├── login.tsx
├── layout.tsx
├── index.tsx
├── tenants.new.tsx
├── tenants.$id.tsx
├── plans.tsx
├── plans.$id.tsx

lib/auth/
├── admin-auth.server.ts
```

## Environment Variables

```
ADMIN_PASSWORD=secure-password-here
```

## Styling

- Reuse existing Tailwind classes
- Sidebar navigation: Dashboard, Tenants, Plans, Logout
- Consistent with tenant app design
