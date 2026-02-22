# Plan Limits & Features Enforcement

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace textarea-based features with checkboxes, ensure all plan limits are enforced throughout the product.

**Architecture:** Restructure plan features as defined boolean flags, add missing enforcement checks, read limits from database instead of hardcoded values.

**Tech Stack:** React Router, Drizzle ORM, TypeScript, PostgreSQL JSONB

---

## Current State

### Features Storage (Admin Plans Editor)
- **File:** `app/routes/admin/plans.$id.tsx` (Lines 241-253)
- Uses freeform textarea for features (stored as string array in JSONB)
- No validation, no structure

### Hardcoded Free Tier Limits
- **File:** `lib/auth/org-context.server.ts` (Lines 34-57)
- Bypasses database-defined limits for free tier
- Boolean feature flags hardcoded: `hasPOS`, `hasEquipmentRentals`, `hasAdvancedReports`, `hasEmailNotifications`

## Enforcement Gaps

| Feature | Defined | Enforced | Gap |
|---------|---------|----------|-----|
| Storage (GB) | ✅ DB | ❌ | NOT ENFORCED |
| Advanced Reports | ✅ Hardcoded | ❌ | NOT ENFORCED |
| Email Notifications | ✅ Hardcoded | ❌ | NOT ENFORCED |
| POS | ✅ Hardcoded | ✅ | OK |
| Equipment Rentals | ✅ Hardcoded | ✅ | OK |
| Customers | ✅ DB + Hardcoded | ⚠️ | Hardcoded overrides DB |
| Tours | ✅ DB | ⚠️ | Total vs Monthly mismatch |

---

## Implementation Tasks

### Task 1: Define Feature Schema

**Files:**
- Create: `lib/db/schema/plan-features.ts`

**Step 1:** Define all available features as constants
```typescript
export const PLAN_FEATURES = {
  // Limits (numeric)
  MAX_USERS: "max_users",
  MAX_CUSTOMERS: "max_customers",
  MAX_TOURS_PER_MONTH: "max_tours_per_month",
  MAX_BOOKINGS_PER_MONTH: "max_bookings_per_month",
  STORAGE_GB: "storage_gb",

  // Boolean features
  HAS_POS: "has_pos",
  HAS_EQUIPMENT_RENTALS: "has_equipment_rentals",
  HAS_ADVANCED_REPORTS: "has_advanced_reports",
  HAS_EMAIL_NOTIFICATIONS: "has_email_notifications",
  HAS_API_ACCESS: "has_api_access",
  HAS_CUSTOM_BRANDING: "has_custom_branding",
  HAS_MULTI_LOCATION: "has_multi_location",
  HAS_PRIORITY_SUPPORT: "has_priority_support",
} as const;

export const FEATURE_LABELS: Record<string, string> = {
  [PLAN_FEATURES.HAS_POS]: "Point of Sale",
  [PLAN_FEATURES.HAS_EQUIPMENT_RENTALS]: "Equipment Rentals",
  [PLAN_FEATURES.HAS_ADVANCED_REPORTS]: "Advanced Reports",
  [PLAN_FEATURES.HAS_EMAIL_NOTIFICATIONS]: "Email Notifications",
  [PLAN_FEATURES.HAS_API_ACCESS]: "API Access",
  [PLAN_FEATURES.HAS_CUSTOM_BRANDING]: "Custom Branding",
  [PLAN_FEATURES.HAS_MULTI_LOCATION]: "Multi-Location Support",
  [PLAN_FEATURES.HAS_PRIORITY_SUPPORT]: "Priority Support",
};
```

### Task 2: Update Admin Plans Editor UI

**Files:**
- Modify: `app/routes/admin/plans.$id.tsx`

**Step 1:** Replace textarea with checkbox grid
```tsx
<div className="space-y-4">
  <h4 className="font-medium">Features</h4>
  <div className="grid grid-cols-2 gap-3">
    {Object.entries(FEATURE_LABELS).map(([key, label]) => (
      <label key={key} className="flex items-center gap-2">
        <input
          type="checkbox"
          name={`feature_${key}`}
          defaultChecked={plan?.features?.[key] === true}
          className="rounded"
        />
        <span>{label}</span>
      </label>
    ))}
  </div>
</div>
```

**Step 2:** Update action to parse checkbox values
```typescript
const features: Record<string, boolean> = {};
for (const [key, value] of formData.entries()) {
  if (key.startsWith("feature_")) {
    const featureKey = key.replace("feature_", "");
    features[featureKey] = value === "on";
  }
}
```

### Task 3: Remove Hardcoded Free Tier Limits

**Files:**
- Modify: `lib/auth/org-context.server.ts` (Lines 34-57, 301-310)

**Step 1:** Fetch plan from database instead of hardcoding
```typescript
// Replace hardcoded FREE_TIER_LIMITS with database lookup
const planData = await db
  .select()
  .from(subscriptionPlans)
  .where(eq(subscriptionPlans.name, subscription.plan))
  .limit(1);

const limits = planData[0]?.limits || DEFAULT_FREE_LIMITS;
const features = planData[0]?.features || {};
```

### Task 4: Add Storage Enforcement

**Files:**
- Modify: Upload handlers (find all file upload routes)

**Step 1:** Add storage usage tracking
```typescript
// Before allowing upload, check storage limit
const storageUsed = await calculateTenantStorageUsage(tenantId);
const storageLimit = ctx.limits.storageGb * 1024 * 1024 * 1024; // Convert to bytes

if (storageUsed + fileSize > storageLimit) {
  throw new Response("Storage limit exceeded", { status: 403 });
}
```

### Task 5: Add Advanced Reports Enforcement

**Files:**
- Modify: `app/routes/tenant/reports/index.tsx` (or create if doesn't exist)

**Step 1:** Check feature flag in loader
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  if (!ctx.features.hasAdvancedReports) {
    return { locked: true, reason: "Advanced reports require a paid plan" };
  }

  // ... load reports data
}
```

### Task 6: Add Email Notifications Enforcement

**Files:**
- Modify: Email sending utilities

**Step 1:** Check feature before sending
```typescript
async function sendTenantEmail(ctx: OrgContext, ...args) {
  if (!ctx.features.hasEmailNotifications) {
    console.log("Email notifications disabled for this plan");
    return { sent: false, reason: "feature_disabled" };
  }
  // ... send email
}
```

### Task 7: Fix Usage Calculations

**Files:**
- Modify: `lib/auth/org-context.server.ts` (Lines 312-363)

**Issue:** Tours counted as total, but limit is `toursPerMonth`

**Fix:**
```typescript
// Change from total count to monthly count
const startOfMonth = new Date();
startOfMonth.setDate(1);
startOfMonth.setHours(0, 0, 0, 0);

const [toursThisMonth] = await db
  .select({ count: sql<number>`count(*)` })
  .from(tour)
  .where(
    and(
      eq(tour.organizationId, org.id),
      gte(tour.createdAt, startOfMonth)
    )
  );
```

### Task 8: Run Tests and Typecheck

```bash
npm run typecheck
npm test
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `lib/db/schema/plan-features.ts` | Create | Feature constants and labels |
| `app/routes/admin/plans.$id.tsx` | Modify | Checkbox UI instead of textarea |
| `lib/auth/org-context.server.ts` | Modify | Read from DB, fix calculations |
| `app/routes/tenant/reports/` | Modify | Add advanced reports check |
| Upload handlers | Modify | Add storage enforcement |
| Email utilities | Modify | Add email feature check |
