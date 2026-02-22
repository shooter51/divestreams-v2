# Plans Mismatch Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the mismatch between plans shown in Create Organization flow and /admin/plans page.

**Architecture:** Replace hardcoded plan options with database-fetched plans from `subscription_plans` table.

**Tech Stack:** React Router loaders, Drizzle ORM, TypeScript

---

## Overview

The Create Organization form has hardcoded "Free" and "Premium" options instead of fetching from the `subscription_plans` database table which has "Free", "Professional", and "Enterprise".

## Root Cause

**File:** `app/routes/admin/tenants.new.tsx` (Lines 238-246)

```tsx
<select id="plan" name="plan" defaultValue="free">
  <option value="free">Free</option>
  <option value="premium">Premium</option>  // ← Hardcoded, doesn't match DB
</select>
```

The admin plans page correctly fetches from database:
- **File:** `app/routes/admin/plans.tsx` (Lines 10-15)

## Implementation Tasks

### Task 1: Add Loader to Fetch Plans

**Files:**
- Modify: `app/routes/admin/tenants.new.tsx`

**Step 1:** Import subscription plans schema
```typescript
import { subscriptionPlans } from "~/lib/db/schema";
```

**Step 2:** Add loader function to fetch active plans
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  await requirePlatformContext(request);

  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(asc(subscriptionPlans.monthlyPrice));

  return { plans };
}
```

**Step 3:** Update component to use loader data
```typescript
const { plans } = useLoaderData<typeof loader>();
```

### Task 2: Replace Hardcoded Select with Dynamic Options

**Files:**
- Modify: `app/routes/admin/tenants.new.tsx` (Lines 238-246)

**Replace:**
```tsx
<select id="plan" name="plan" defaultValue="free">
  <option value="free">Free</option>
  <option value="premium">Premium</option>
</select>
```

**With:**
```tsx
<select id="plan" name="plan" defaultValue={plans[0]?.name || "free"}>
  {plans.map((plan) => (
    <option key={plan.id} value={plan.name}>
      {plan.displayName} - ${(plan.monthlyPrice / 100).toFixed(2)}/mo
    </option>
  ))}
</select>
```

### Task 3: Update Action Handler Type

**Files:**
- Modify: `app/routes/admin/tenants.new.tsx` (Lines 82-88)

**Current (wrong):**
```typescript
plan: plan as "free" | "premium",
```

**Fix:** Remove type assertion or update to accept any plan name:
```typescript
plan: plan,  // Accept any valid plan name from DB
```

### Task 4: Run Typecheck

```bash
npm run typecheck
```

### Task 5: Test in Staging

1. Go to /admin/tenants/new
2. Verify dropdown shows all database plans (Free, Professional, Enterprise)
3. Create a new organization with each plan type
4. Verify subscription is saved correctly
