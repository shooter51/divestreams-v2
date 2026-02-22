# Subscription System Unification

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the two disconnected subscription systems so tenant plan display matches admin plans.

**Architecture:** Add foreign key from `subscription` to `subscription_plans`, update tenant details page to join with plans table.

**Tech Stack:** Drizzle ORM, PostgreSQL, React Router

---

## Overview

There are two separate subscription management systems that are completely disconnected:

1. **Subscription Table** (`subscription.plan`): Stores "free" or "premium"
2. **Subscription Plans Table** (`subscription_plans.name`): Stores "starter", "pro", "enterprise"

This causes the tenant details page to show "premium" while the /admin/plans page shows "Professional", "Enterprise", etc.

---

## Current Architecture

### Subscription Table
**File:** `lib/db/schema/subscription.ts` (Lines 28-51)
```typescript
plan: text("plan").notNull().default("free"),  // Only "free" or "premium"
```

### Subscription Plans Table
**File:** `lib/db/schema.ts` (Lines 69-87)
```typescript
name: text("name").notNull(),  // "starter", "pro", "enterprise"
displayName: text("display_name").notNull(),  // "Starter", "Professional"
```

### No Relationship
- No foreign key between tables
- Plan matching done by string comparison in some places, ignored in others

---

## Implementation Tasks

### Task 1: Add Migration for planId Column

**Files:**
- Create: `drizzle/XXXX_add_subscription_plan_id.sql`

```sql
-- Add planId column to subscription table
ALTER TABLE subscription ADD COLUMN plan_id UUID REFERENCES subscription_plans(id);

-- Create index for faster lookups
CREATE INDEX idx_subscription_plan_id ON subscription(plan_id);

-- Migrate existing data: Map "free" → Free plan, "premium" → first paid plan
UPDATE subscription s
SET plan_id = (
  SELECT id FROM subscription_plans
  WHERE CASE
    WHEN s.plan = 'free' THEN name = 'free' OR monthly_price = 0
    ELSE monthly_price > 0
  END
  ORDER BY monthly_price ASC
  LIMIT 1
);
```

### Task 2: Update Subscription Schema

**Files:**
- Modify: `lib/db/schema/subscription.ts`

**Add planId column:**
```typescript
import { subscriptionPlans } from "./schema";

export const subscription = pgTable("subscription", {
  // ... existing fields
  plan: text("plan").notNull().default("free"),  // Keep for backwards compat
  planId: uuid("plan_id").references(() => subscriptionPlans.id),  // NEW
  // ...
});
```

### Task 3: Update Tenant Details Page Loader

**Files:**
- Modify: `app/routes/admin/tenants.$id.tsx`

**Step 1:** Join subscription with subscription_plans
```typescript
const [subWithPlan] = await db
  .select({
    subscription: subscription,
    plan: subscriptionPlans,
  })
  .from(subscription)
  .leftJoin(subscriptionPlans, eq(subscription.planId, subscriptionPlans.id))
  .where(eq(subscription.organizationId, org.id))
  .limit(1);
```

**Step 2:** Return plan details in loader
```typescript
return {
  // ...
  subscription: subWithPlan?.subscription ? {
    ...subWithPlan.subscription,
    planDetails: subWithPlan.plan,  // Full plan object
  } : null,
};
```

### Task 4: Update Tenant Details Page Display

**Files:**
- Modify: `app/routes/admin/tenants.$id.tsx` (Lines 618-627)

**Current:**
```tsx
<span>{sub?.plan || "free"}</span>
```

**Fix:**
```tsx
<span>{sub?.planDetails?.displayName || sub?.plan || "Free"}</span>
```

### Task 5: Update Plan Dropdown in Tenant Details

**Files:**
- Modify: `app/routes/admin/tenants.$id.tsx` (Lines 440-442)

**Step 1:** Fetch plans in loader
```typescript
const plans = await db
  .select()
  .from(subscriptionPlans)
  .where(eq(subscriptionPlans.isActive, true))
  .orderBy(asc(subscriptionPlans.monthlyPrice));
```

**Step 2:** Replace hardcoded dropdown
```tsx
<select name="planId" defaultValue={sub?.planId || ""}>
  {plans.map((plan) => (
    <option key={plan.id} value={plan.id}>
      {plan.displayName}
    </option>
  ))}
</select>
```

### Task 6: Update Action Handler for Plan Changes

**Files:**
- Modify: `app/routes/admin/tenants.$id.tsx`

**Update subscription with planId:**
```typescript
case "updateSubscription": {
  const planId = formData.get("planId") as string;

  // Get plan name for backwards compat
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);

  await db.update(subscription)
    .set({
      planId: planId,
      plan: plan?.name || "free",  // Keep legacy field updated
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, orgId));

  return { success: true };
}
```

### Task 7: Update Create Organization Flow

**Files:**
- Modify: `app/routes/admin/tenants.new.tsx`

**Update to use planId instead of plan name:**
```typescript
const planId = formData.get("planId") as string;

// Get plan details for legacy field
const [selectedPlan] = await db
  .select()
  .from(subscriptionPlans)
  .where(eq(subscriptionPlans.id, planId))
  .limit(1);

await db.insert(subscription).values({
  organizationId: orgId,
  planId: planId,
  plan: selectedPlan?.name || "free",  // Legacy field
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

### Task 8: Run Migration and Typecheck

```bash
npm run db:generate
npm run db:migrate
npm run typecheck
```

### Task 9: Test End-to-End

1. Create new organization with specific plan
2. Verify tenant details shows correct plan name
3. Change plan from tenant details
4. Verify plan change is reflected
5. Check /admin/plans shows same plan names

---

## Migration Strategy

**Phase 1:** Add `planId` column (nullable), migrate existing data
**Phase 2:** Update all code to use `planId`
**Phase 3:** Make `planId` required, deprecate `plan` column
**Phase 4:** Eventually remove `plan` column

This allows gradual migration without breaking existing functionality.
