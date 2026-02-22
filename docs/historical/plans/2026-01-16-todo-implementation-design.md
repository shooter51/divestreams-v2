# TODO Implementation Design

**Date:** 2026-01-16
**Status:** Approved
**Scope:** Dashboard statistics, password reset, Stripe billing wiring

## Overview

Address 9 TODO items across 3 independent workstreams, suitable for parallel agent execution.

## Workstreams

### Agent 1: Dashboard Statistics

**Goal:** Replace hardcoded zeros with real database counts.

**File:** `lib/auth/org-context.server.ts`

**Changes:**
```typescript
// Replace lines 279-282 with actual queries
const customerCount = await db
  .select({ count: count() })
  .from(schema.customers)
  .then(r => r[0]?.count ?? 0);

const tourCount = await db
  .select({ count: count() })
  .from(schema.tours)
  .then(r => r[0]?.count ?? 0);

const startOfMonth = new Date();
startOfMonth.setDate(1);
startOfMonth.setHours(0, 0, 0, 0);

const bookingCount = await db
  .select({ count: count() })
  .from(schema.bookings)
  .where(gte(schema.bookings.createdAt, startOfMonth))
  .then(r => r[0]?.count ?? 0);
```

**Error Handling:**
- Schema doesn't exist → return 0
- DB query fails → log error, return 0

---

### Agent 2: Password Reset

**Goal:** Implement Better Auth password reset with built-in email plugin.

**Files:**
- `lib/auth/index.ts` - Add email sending config
- `app/routes/auth/forgot-password.tsx` - Call real API
- `app/routes/auth/reset-password.tsx` - Call real API

**Changes to lib/auth/index.ts:**
```typescript
import { sendEmail } from "../email";

export const auth = betterAuth({
  // ... existing config
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your DiveStreams password",
        html: `
          <p>Hi ${user.name || "there"},</p>
          <p>Click the link below to reset your password:</p>
          <p><a href="${url}">${url}</a></p>
          <p>This link expires in 1 hour.</p>
        `,
      });
    },
  },
});
```

**Changes to forgot-password.tsx action:**
```typescript
await auth.api.forgetPassword({
  body: { email, redirectTo: "/auth/reset-password" },
});
```

**Changes to reset-password.tsx action:**
```typescript
await auth.api.resetPassword({
  body: { token, newPassword },
});
```

**Error Handling:**
- SMTP not configured → log warning, token still stored
- Invalid token → return user-friendly error

---

### Agent 3: Stripe Billing Wiring

**Goal:** Connect billing page to existing Stripe helper functions.

**File:** `app/routes/tenant/settings/billing.tsx`

**Existing helpers in `lib/stripe/index.ts`:**
- `createCheckoutSession()` - for subscribe/upgrade
- `cancelSubscription()` - for cancel
- `createBillingPortalSession()` - for update-payment
- `createSetupSession()` - for add-payment

**Changes:**
```typescript
// intent: "subscribe"
const session = await createCheckoutSession(org.id, planId, billingPeriod, successUrl, cancelUrl);
if (session?.url) return redirect(session.url);

// intent: "cancel"
const success = await cancelSubscription(org.id);
if (success) return { cancelled: true };

// intent: "update-payment"
const session = await createBillingPortalSession(org.id, returnUrl);
if (session?.url) return redirect(session.url);

// intent: "add-payment"
const session = await createSetupSession(org.id, returnUrl);
if (session?.url) return redirect(session.url);
```

**Error Handling:**
- No Stripe key → return "Stripe not configured"
- API error → return Stripe's error message

---

## Testing Strategy

Each agent verifies their changes:

| Agent | Verification |
|-------|--------------|
| Dashboard Stats | typecheck, org-context loads |
| Password Reset | typecheck, form submission test |
| Stripe Billing | typecheck, billing page loads |

No new E2E tests required - existing page load tests provide coverage.

## Parallel Execution

All three workstreams are independent:
- No shared file modifications
- No data dependencies
- Can run simultaneously via parallel agents

```
┌─────────────────┬─────────────────┬─────────────────┐
│    Agent 1      │    Agent 2      │    Agent 3      │
│  Dashboard      │  Password       │    Stripe       │
│  Statistics     │  Reset          │    Billing      │
├─────────────────┼─────────────────┼─────────────────┤
│ org-context.ts  │ lib/auth/       │ billing.tsx     │
│                 │ forgot-password │                 │
│                 │ reset-password  │                 │
└─────────────────┴─────────────────┴─────────────────┘
```
