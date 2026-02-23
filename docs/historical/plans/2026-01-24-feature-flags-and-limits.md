# Feature Flags & Plan Limits Implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement database-driven feature flags and quantity limits with upgrade prompts and enforcement.

**Architecture:** Features and limits stored in `subscription_plans` JSON columns. Checked at layout level via React context. Protected routes redirect with upgrade modal. Dashboard shows usage with warnings at 80%.

**Tech Stack:** React Router, Drizzle ORM, React Context, PostgreSQL JSONB

---

## Feature Flags

| Feature Flag | Key | Routes Protected |
|--------------|-----|------------------|
| Tours & Bookings | `has_tours_bookings` | `/tenant/tours/*`, `/tenant/bookings/*` |
| Equipment & Boats | `has_equipment_boats` | `/tenant/equipment/*`, `/tenant/boats/*` |
| Training | `has_training` | `/tenant/training/*` |
| POS | `has_pos` | `/tenant/pos/*` |
| Public Site | `has_public_site` | `/tenant/settings/public-site*`, `/site/*` |
| Advanced Notifications | `has_advanced_notifications` | `/tenant/settings/notifications.tsx` |
| Integrations | `has_integrations` | `/tenant/settings/integrations/*` |
| API Access | `has_api_access` | Future API routes |

## Plan Feature Matrix

|  | Free | Starter | Pro | Enterprise |
|--|------|---------|-----|------------|
| Tours & Bookings | ✅ | ✅ | ✅ | ✅ |
| Equipment & Boats | ❌ | ✅ | ✅ | ✅ |
| Training | ❌ | ❌ | ✅ | ✅ |
| POS | ❌ | ❌ | ✅ | ✅ |
| Public Site | ❌ | ✅ | ✅ | ✅ |
| Advanced Notifications | ❌ | ❌ | ✅ | ✅ |
| Integrations | ❌ | ❌ | ❌ | ✅ |
| API Access | ❌ | ❌ | ❌ | ✅ |

## Plan Limits Matrix

| Limit | Free | Starter | Pro | Enterprise |
|-------|------|---------|-----|------------|
| Team Members | 1 | 3 | 10 | Unlimited |
| Customers | 50 | 500 | 5,000 | Unlimited |
| Tours/month | 5 | 25 | 100 | Unlimited |
| Storage (GB) | 0.5 | 5 | 25 | 100 |

## Enforcement Behavior

- **Features:** Locked nav items show lock icon. Clicking opens upgrade modal. Direct URL access redirects to dashboard with upgrade modal.
- **Limits:** Warning shown at 80%. Hard block at 100%. Dashboard shows usage breakdown. Contextual warnings on create forms.

---

## Implementation Tasks

### Task 1: Update Plan Features Constants

**Files:**
- Modify: `lib/plan-features.ts`

**Step 1:** Replace existing feature constants with new ones

```typescript
export const PLAN_FEATURES = {
  HAS_TOURS_BOOKINGS: "has_tours_bookings",
  HAS_EQUIPMENT_BOATS: "has_equipment_boats",
  HAS_TRAINING: "has_training",
  HAS_POS: "has_pos",
  HAS_PUBLIC_SITE: "has_public_site",
  HAS_ADVANCED_NOTIFICATIONS: "has_advanced_notifications",
  HAS_INTEGRATIONS: "has_integrations",
  HAS_API_ACCESS: "has_api_access",
} as const;

export type PlanFeatureKey = (typeof PLAN_FEATURES)[keyof typeof PLAN_FEATURES];

export const FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  has_tours_bookings: "Tours & Bookings",
  has_equipment_boats: "Equipment & Boats",
  has_training: "Training Management",
  has_pos: "Point of Sale",
  has_public_site: "Public Website",
  has_advanced_notifications: "Advanced Notifications",
  has_integrations: "Integrations",
  has_api_access: "API Access",
};

export const FEATURE_UPGRADE_INFO: Record<PlanFeatureKey, {
  title: string;
  description: string;
  requiredPlan: string;
}> = {
  has_tours_bookings: {
    title: "Tours & Bookings",
    description: "Create tours, manage trips, and accept bookings from customers.",
    requiredPlan: "Free",
  },
  has_equipment_boats: {
    title: "Equipment & Boats",
    description: "Manage your dive equipment inventory and boat fleet.",
    requiredPlan: "Starter",
  },
  has_training: {
    title: "Training Management",
    description: "Run certification courses with student tracking and scheduling.",
    requiredPlan: "Pro",
  },
  has_pos: {
    title: "Point of Sale",
    description: "Process sales, manage products, and track transactions.",
    requiredPlan: "Pro",
  },
  has_public_site: {
    title: "Public Website",
    description: "Your own branded website for customers to browse and book.",
    requiredPlan: "Starter",
  },
  has_advanced_notifications: {
    title: "Advanced Notifications",
    description: "Automated email reminders, booking confirmations, and more.",
    requiredPlan: "Pro",
  },
  has_integrations: {
    title: "Integrations",
    description: "Connect with Zapier, QuickBooks, and other business tools.",
    requiredPlan: "Enterprise",
  },
  has_api_access: {
    title: "API Access",
    description: "Build custom integrations with our REST API.",
    requiredPlan: "Enterprise",
  },
};
```

**Step 2:** Add default feature configurations per tier

```typescript
export const DEFAULT_PLAN_FEATURES: Record<string, Record<PlanFeatureKey, boolean>> = {
  free: {
    has_tours_bookings: true,
    has_equipment_boats: false,
    has_training: false,
    has_pos: false,
    has_public_site: false,
    has_advanced_notifications: false,
    has_integrations: false,
    has_api_access: false,
  },
  starter: {
    has_tours_bookings: true,
    has_equipment_boats: true,
    has_training: false,
    has_pos: false,
    has_public_site: true,
    has_advanced_notifications: false,
    has_integrations: false,
    has_api_access: false,
  },
  pro: {
    has_tours_bookings: true,
    has_equipment_boats: true,
    has_training: true,
    has_pos: true,
    has_public_site: true,
    has_advanced_notifications: true,
    has_integrations: false,
    has_api_access: false,
  },
  enterprise: {
    has_tours_bookings: true,
    has_equipment_boats: true,
    has_training: true,
    has_pos: true,
    has_public_site: true,
    has_advanced_notifications: true,
    has_integrations: true,
    has_api_access: true,
  },
};
```

**Step 3:** Add limits types and defaults

```typescript
export interface PlanLimits {
  users: number;        // -1 = unlimited
  customers: number;
  toursPerMonth: number;
  storageGb: number;
}

export const DEFAULT_PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { users: 1, customers: 50, toursPerMonth: 5, storageGb: 0.5 },
  starter: { users: 3, customers: 500, toursPerMonth: 25, storageGb: 5 },
  pro: { users: 10, customers: 5000, toursPerMonth: 100, storageGb: 25 },
  enterprise: { users: -1, customers: -1, toursPerMonth: -1, storageGb: 100 },
};

export const LIMIT_WARNING_THRESHOLD = 0.8;

export const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  users: "Team Members",
  customers: "Customers",
  toursPerMonth: "Tours per Month",
  storageGb: "Storage",
};
```

**Step 4:** Update PlanFeaturesObject interface

```typescript
export interface PlanFeaturesObject {
  has_tours_bookings?: boolean;
  has_equipment_boats?: boolean;
  has_training?: boolean;
  has_pos?: boolean;
  has_public_site?: boolean;
  has_advanced_notifications?: boolean;
  has_integrations?: boolean;
  has_api_access?: boolean;
}
```

**Step 5:** Run typecheck

```bash
npm run typecheck
```

**Step 6:** Commit

```bash
git add lib/plan-features.ts
git commit -m "feat: update plan features and limits constants"
```

---

### Task 2: Create Features Context

**Files:**
- Create: `lib/features-context.tsx`

**Step 1:** Create the context file

```typescript
import { createContext, useContext } from "react";
import type { PlanFeatureKey, PlanFeaturesObject, PlanLimits } from "./plan-features";
import { DEFAULT_PLAN_FEATURES, DEFAULT_PLAN_LIMITS } from "./plan-features";

export interface FeaturesContextValue {
  features: PlanFeaturesObject;
  limits: PlanLimits;
  planName: string;
}

export const FeaturesContext = createContext<FeaturesContextValue | null>(null);

export function useFeatures(): FeaturesContextValue {
  const ctx = useContext(FeaturesContext);
  if (!ctx) {
    // Return free tier defaults if no context (shouldn't happen in normal use)
    return {
      features: DEFAULT_PLAN_FEATURES.free,
      limits: DEFAULT_PLAN_LIMITS.free,
      planName: "Free",
    };
  }
  return ctx;
}

export function useHasFeature(feature: PlanFeatureKey): boolean {
  const { features } = useFeatures();
  return features[feature] ?? false;
}

export function usePlanLimits(): PlanLimits {
  const { limits } = useFeatures();
  return limits;
}
```

**Step 2:** Run typecheck

```bash
npm run typecheck
```

**Step 3:** Commit

```bash
git add lib/features-context.tsx
git commit -m "feat: create features context for plan access"
```

---

### Task 3: Create Server-Side Helpers

**Files:**
- Create: `lib/usage.server.ts`
- Create: `lib/require-feature.server.ts`

**Step 1:** Create usage.server.ts

```typescript
import { db } from "./db";
import { customers, tours, member } from "./db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import type { PlanLimits } from "./plan-features";
import { LIMIT_WARNING_THRESHOLD } from "./plan-features";

export interface UsageStats {
  users: number;
  customers: number;
  toursPerMonth: number;
  storageGb: number;
}

export async function getUsage(organizationId: string): Promise<UsageStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [userCount, customerCount, tourCount] = await Promise.all([
    db.select({ count: count() }).from(member).where(eq(member.organizationId, organizationId)),
    db.select({ count: count() }).from(customers).where(eq(customers.organizationId, organizationId)),
    db.select({ count: count() }).from(tours).where(
      and(
        eq(tours.organizationId, organizationId),
        gte(tours.createdAt, startOfMonth)
      )
    ),
  ]);

  // Storage calculation would need file tracking - placeholder for now
  const storageGb = 0;

  return {
    users: userCount[0]?.count ?? 0,
    customers: customerCount[0]?.count ?? 0,
    toursPerMonth: tourCount[0]?.count ?? 0,
    storageGb,
  };
}

export interface LimitCheck {
  allowed: boolean;
  warning: boolean;
  percent: number;
  current: number;
  limit: number;
  remaining: number;
}

export function checkLimit(current: number, limit: number): LimitCheck {
  if (limit === -1) {
    return { allowed: true, warning: false, percent: 0, current, limit, remaining: -1 };
  }
  const percent = Math.round((current / limit) * 100);
  return {
    allowed: current < limit,
    warning: (current / limit) >= LIMIT_WARNING_THRESHOLD,
    percent,
    current,
    limit,
    remaining: Math.max(0, limit - current),
  };
}

export function checkAllLimits(usage: UsageStats, limits: PlanLimits): Record<keyof PlanLimits, LimitCheck> {
  return {
    users: checkLimit(usage.users, limits.users),
    customers: checkLimit(usage.customers, limits.customers),
    toursPerMonth: checkLimit(usage.toursPerMonth, limits.toursPerMonth),
    storageGb: checkLimit(usage.storageGb, limits.storageGb),
  };
}
```

**Step 2:** Create require-feature.server.ts

```typescript
import { redirect } from "react-router";
import type { PlanFeatureKey, PlanFeaturesObject, PlanLimits } from "./plan-features";
import { getUsage } from "./usage.server";

export function requireFeature(
  features: PlanFeaturesObject,
  feature: PlanFeatureKey
): void {
  if (!features[feature]) {
    throw redirect(`/tenant/dashboard?upgrade=${feature}`);
  }
}

export async function requireLimit(
  organizationId: string,
  limitType: keyof PlanLimits,
  limits: PlanLimits
): Promise<{ current: number; limit: number; remaining: number }> {
  const usage = await getUsage(organizationId);
  const current = usage[limitType];
  const limit = limits[limitType];

  if (limit !== -1 && current >= limit) {
    throw redirect(`/tenant/dashboard?limit_exceeded=${limitType}`);
  }

  return {
    current,
    limit,
    remaining: limit === -1 ? -1 : limit - current,
  };
}
```

**Step 3:** Run typecheck

```bash
npm run typecheck
```

**Step 4:** Commit

```bash
git add lib/usage.server.ts lib/require-feature.server.ts
git commit -m "feat: add usage tracking and feature/limit enforcement helpers"
```

---

### Task 4: Create Upgrade Modal Component

**Files:**
- Create: `app/components/upgrade-modal.tsx`

**Step 1:** Create the modal component

```tsx
import { Link } from "react-router";
import type { PlanFeatureKey } from "~/lib/plan-features";
import { FEATURE_UPGRADE_INFO, LIMIT_LABELS } from "~/lib/plan-features";

interface UpgradeModalProps {
  feature?: PlanFeatureKey | null;
  limitType?: string | null;
  onClose: () => void;
}

export function UpgradeModal({ feature, limitType, onClose }: UpgradeModalProps) {
  if (!feature && !limitType) return null;

  let title: string;
  let description: string;
  let requiredPlan: string;

  if (feature && FEATURE_UPGRADE_INFO[feature]) {
    const info = FEATURE_UPGRADE_INFO[feature];
    title = info.title;
    description = info.description;
    requiredPlan = info.requiredPlan;
  } else if (limitType) {
    const limitLabel = LIMIT_LABELS[limitType as keyof typeof LIMIT_LABELS] ?? limitType;
    title = `${limitLabel} Limit Reached`;
    description = `You've reached your plan's limit for ${limitLabel.toLowerCase()}. Upgrade to add more.`;
    requiredPlan = "a higher plan";
  } else {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="text-center">
          {/* Lock icon */}
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="mt-2 text-gray-600">{description}</p>
          <p className="mt-4 text-sm font-medium text-gray-900">
            Upgrade to {requiredPlan} to unlock this feature
          </p>

          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Maybe Later
            </button>
            <Link
              to="/tenant/settings/billing"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              View Plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2:** Run typecheck

```bash
npm run typecheck
```

**Step 3:** Commit

```bash
git add app/components/upgrade-modal.tsx
git commit -m "feat: create upgrade modal component"
```

---

### Task 5: Update Tenant Layout with Feature Gating

**Files:**
- Modify: `app/routes/tenant/layout.tsx`

**Step 1:** Update loader to fetch features and limits

Add to existing loader:
```typescript
import { FeaturesContext } from "~/lib/features-context";
import { DEFAULT_PLAN_FEATURES, DEFAULT_PLAN_LIMITS } from "~/lib/plan-features";
import type { PlanFeaturesObject, PlanLimits } from "~/lib/plan-features";

// In loader, after getting tenant/subscription:
const features: PlanFeaturesObject = subscription?.plan?.features ?? DEFAULT_PLAN_FEATURES.free;
const limits: PlanLimits = subscription?.plan?.limits ?? DEFAULT_PLAN_LIMITS.free;
const planName = subscription?.plan?.displayName ?? "Free";

return {
  // ...existing return values,
  features,
  limits,
  planName,
};
```

**Step 2:** Define nav items with feature requirements

```typescript
const NAV_ITEMS = [
  { to: "/tenant/dashboard", label: "Dashboard", icon: HomeIcon, feature: null },
  { to: "/tenant/calendar", label: "Calendar", icon: CalendarIcon, feature: null },
  { to: "/tenant/bookings", label: "Bookings", icon: BookingIcon, feature: "has_tours_bookings" as const },
  { to: "/tenant/tours", label: "Tours", icon: TourIcon, feature: "has_tours_bookings" as const },
  { to: "/tenant/customers", label: "Customers", icon: UsersIcon, feature: null },
  { to: "/tenant/equipment", label: "Equipment", icon: EquipmentIcon, feature: "has_equipment_boats" as const },
  { to: "/tenant/boats", label: "Boats", icon: BoatIcon, feature: "has_equipment_boats" as const },
  { to: "/tenant/training", label: "Training", icon: TrainingIcon, feature: "has_training" as const },
  { to: "/tenant/pos", label: "POS", icon: POSIcon, feature: "has_pos" as const },
];

const SETTINGS_NAV_ITEMS = [
  { to: "/tenant/settings/public-site", label: "Public Site", feature: "has_public_site" as const },
  { to: "/tenant/settings/notifications", label: "Notifications", feature: "has_advanced_notifications" as const },
  { to: "/tenant/settings/integrations", label: "Integrations", feature: "has_integrations" as const },
];
```

**Step 3:** Update nav rendering to show locked items

```tsx
const [upgradeFeature, setUpgradeFeature] = useState<PlanFeatureKey | null>(null);

// In nav rendering:
{NAV_ITEMS.map((item) => {
  const hasAccess = !item.feature || features[item.feature];

  return hasAccess ? (
    <NavLink key={item.to} to={item.to} className={navLinkClass}>
      <item.icon className="w-5 h-5" />
      <span>{item.label}</span>
    </NavLink>
  ) : (
    <button
      key={item.to}
      onClick={() => setUpgradeFeature(item.feature)}
      className={`${navLinkClass} opacity-50 cursor-pointer`}
    >
      <LockClosedIcon className="w-4 h-4" />
      <span>{item.label}</span>
    </button>
  );
})}
```

**Step 4:** Wrap outlet with FeaturesContext.Provider

```tsx
<FeaturesContext.Provider value={{ features, limits, planName }}>
  <Outlet />
</FeaturesContext.Provider>

{upgradeFeature && (
  <UpgradeModal
    feature={upgradeFeature}
    onClose={() => setUpgradeFeature(null)}
  />
)}
```

**Step 5:** Run typecheck

```bash
npm run typecheck
```

**Step 6:** Commit

```bash
git add app/routes/tenant/layout.tsx
git commit -m "feat: add feature gating to tenant navigation"
```

---

### Task 6: Update Dashboard with Usage Display

**Files:**
- Modify: `app/routes/tenant/dashboard.tsx`

**Step 1:** Update loader to fetch usage stats

```typescript
import { getUsage, checkAllLimits } from "~/lib/usage.server";
import { DEFAULT_PLAN_LIMITS } from "~/lib/plan-features";

// In loader:
const usage = await getUsage(tenant.organizationId);
const limits = subscription?.plan?.limits ?? DEFAULT_PLAN_LIMITS.free;
const limitChecks = checkAllLimits(usage, limits);

return {
  // ...existing,
  usage,
  limits,
  limitChecks,
  planName: subscription?.plan?.displayName ?? "Free",
};
```

**Step 2:** Handle upgrade params from redirects

```tsx
import { useSearchParams, useNavigate } from "react-router";
import { UpgradeModal } from "~/components/upgrade-modal";

// In component:
const [searchParams] = useSearchParams();
const navigate = useNavigate();
const upgradeFeature = searchParams.get("upgrade");
const limitExceeded = searchParams.get("limit_exceeded");

const handleCloseModal = () => {
  navigate("/tenant/dashboard", { replace: true });
};
```

**Step 3:** Create UsageCard component

```tsx
function UsageCard({ usage, limits, limitChecks, planName }) {
  const items = [
    { key: "users", label: "Team Members", suffix: "" },
    { key: "customers", label: "Customers", suffix: "" },
    { key: "toursPerMonth", label: "Tours this month", suffix: "" },
    { key: "storageGb", label: "Storage", suffix: " GB" },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Usage — {planName} Plan</h3>
        <Link to="/tenant/settings/billing" className="text-blue-600 text-sm hover:underline">
          Upgrade
        </Link>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const check = limitChecks[item.key];
          const isUnlimited = check.limit === -1;

          return (
            <div key={item.key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{item.label}</span>
                <span className={check.warning ? "text-amber-600 font-medium" : "text-gray-900"}>
                  {check.current}{item.suffix} / {isUnlimited ? "∞" : `${check.limit}${item.suffix}`}
                </span>
              </div>
              {!isUnlimited && (
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      check.warning ? "bg-amber-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(check.percent, 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 4:** Add UsageCard and UpgradeModal to dashboard

```tsx
// In the dashboard grid:
<UsageCard
  usage={usage}
  limits={limits}
  limitChecks={limitChecks}
  planName={planName}
/>

{/* Upgrade modal from redirects */}
{(upgradeFeature || limitExceeded) && (
  <UpgradeModal
    feature={upgradeFeature as PlanFeatureKey}
    limitType={limitExceeded}
    onClose={handleCloseModal}
  />
)}
```

**Step 5:** Run typecheck

```bash
npm run typecheck
```

**Step 6:** Commit

```bash
git add app/routes/tenant/dashboard.tsx
git commit -m "feat: add usage display and upgrade modal to dashboard"
```

---

### Task 7: Update Admin Plans Editor

**Files:**
- Modify: `app/routes/admin/plans.$id.tsx`

**Step 1:** Update form to use new feature checkboxes

Replace existing features textarea with:
```tsx
import { PLAN_FEATURES, FEATURE_LABELS } from "~/lib/plan-features";

<fieldset className="space-y-3">
  <legend className="font-medium">Feature Access</legend>
  <div className="grid grid-cols-2 gap-3">
    {Object.entries(PLAN_FEATURES).map(([key, value]) => (
      <label key={value} className="flex items-center gap-2">
        <input
          type="checkbox"
          name={`feature_${value}`}
          defaultChecked={plan.features?.[value] ?? false}
          className="rounded border-gray-300"
        />
        <span className="text-sm">{FEATURE_LABELS[value]}</span>
      </label>
    ))}
  </div>
</fieldset>
```

**Step 2:** Add limits inputs

```tsx
<fieldset className="space-y-4 mt-6">
  <legend className="font-medium">Plan Limits</legend>
  <p className="text-sm text-gray-500">Use -1 for unlimited</p>
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-sm text-gray-600">Team Members</label>
      <input
        type="number"
        name="limit_users"
        defaultValue={plan.limits?.users ?? 1}
        min={-1}
        className="mt-1 w-full border rounded px-3 py-2"
      />
    </div>
    <div>
      <label className="block text-sm text-gray-600">Customers</label>
      <input
        type="number"
        name="limit_customers"
        defaultValue={plan.limits?.customers ?? 50}
        min={-1}
        className="mt-1 w-full border rounded px-3 py-2"
      />
    </div>
    <div>
      <label className="block text-sm text-gray-600">Tours per Month</label>
      <input
        type="number"
        name="limit_tours_per_month"
        defaultValue={plan.limits?.toursPerMonth ?? 5}
        min={-1}
        className="mt-1 w-full border rounded px-3 py-2"
      />
    </div>
    <div>
      <label className="block text-sm text-gray-600">Storage (GB)</label>
      <input
        type="number"
        name="limit_storage_gb"
        defaultValue={plan.limits?.storageGb ?? 0.5}
        min={0}
        step={0.5}
        className="mt-1 w-full border rounded px-3 py-2"
      />
    </div>
  </div>
</fieldset>
```

**Step 3:** Update action to parse features and limits

```typescript
import { PLAN_FEATURES } from "~/lib/plan-features";
import type { PlanFeaturesObject, PlanLimits } from "~/lib/plan-features";

// In action:
const features: PlanFeaturesObject = {};
for (const [, value] of Object.entries(PLAN_FEATURES)) {
  features[value] = formData.get(`feature_${value}`) === "on";
}

const limits: PlanLimits = {
  users: parseInt(formData.get("limit_users") as string) || 1,
  customers: parseInt(formData.get("limit_customers") as string) || 50,
  toursPerMonth: parseInt(formData.get("limit_tours_per_month") as string) || 5,
  storageGb: parseFloat(formData.get("limit_storage_gb") as string) || 0.5,
};

await db.update(subscriptionPlans)
  .set({
    // ...other fields,
    features,
    limits,
  })
  .where(eq(subscriptionPlans.id, planId));
```

**Step 4:** Run typecheck

```bash
npm run typecheck
```

**Step 5:** Commit

```bash
git add app/routes/admin/plans.$id.tsx
git commit -m "feat: update admin plans editor with new features and limits"
```

---

### Task 8: Add Feature Guards to Protected Routes

**Files:**
- Modify: `app/routes/tenant/pos.tsx`
- Modify: `app/routes/tenant/training/index.tsx` (or layout)
- Modify: `app/routes/tenant/equipment/index.tsx`
- Modify: `app/routes/tenant/boats/index.tsx`
- Modify: `app/routes/tenant/settings/integrations.tsx`
- Modify: `app/routes/tenant/settings/notifications.tsx`

**Step 1:** Add requireFeature to POS loader

```typescript
import { requireFeature } from "~/lib/require-feature.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, features } = await requireTenantContext(request);
  requireFeature(features, "has_pos");
  // ... rest of loader
}
```

**Step 2:** Add requireFeature to training routes

```typescript
requireFeature(features, "has_training");
```

**Step 3:** Add requireFeature to equipment routes

```typescript
requireFeature(features, "has_equipment_boats");
```

**Step 4:** Add requireFeature to boats routes

```typescript
requireFeature(features, "has_equipment_boats");
```

**Step 5:** Add requireFeature to integrations

```typescript
requireFeature(features, "has_integrations");
```

**Step 6:** Add requireFeature to notifications

```typescript
requireFeature(features, "has_advanced_notifications");
```

**Step 7:** Run typecheck

```bash
npm run typecheck
```

**Step 8:** Commit

```bash
git add app/routes/tenant/pos.tsx app/routes/tenant/training app/routes/tenant/equipment app/routes/tenant/boats app/routes/tenant/settings/integrations.tsx app/routes/tenant/settings/notifications.tsx
git commit -m "feat: add feature guards to protected routes"
```

---

### Task 9: Add Limit Checks to Create Routes

**Files:**
- Modify: `app/routes/tenant/customers/new.tsx`
- Modify: `app/routes/tenant/tours/new.tsx`
- Modify: `app/routes/tenant/settings/team.tsx`

**Step 1:** Add limit check to customers/new.tsx loader

```typescript
import { requireLimit } from "~/lib/require-feature.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, limits } = await requireTenantContext(request);
  const { remaining, limit } = await requireLimit(tenant.organizationId, "customers", limits);
  return { remaining, limit };
}
```

**Step 2:** Add contextual warning to form

```tsx
const { remaining, limit } = useLoaderData<typeof loader>();
const isNearLimit = limit !== -1 && remaining <= Math.ceil(limit * 0.2);

// In form:
{isNearLimit && (
  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
    <p className="text-amber-800 text-sm">
      {remaining} of {limit} customers remaining.{" "}
      <Link to="/tenant/settings/billing" className="underline font-medium">
        Upgrade for more
      </Link>
    </p>
  </div>
)}
```

**Step 3:** Add limit check to tours/new.tsx

```typescript
const { remaining, limit } = await requireLimit(tenant.organizationId, "toursPerMonth", limits);
```

**Step 4:** Add limit check to settings/team.tsx for invites

```typescript
const { remaining, limit } = await requireLimit(tenant.organizationId, "users", limits);
```

**Step 5:** Run typecheck

```bash
npm run typecheck
```

**Step 6:** Commit

```bash
git add app/routes/tenant/customers/new.tsx app/routes/tenant/tours/new.tsx app/routes/tenant/settings/team.tsx
git commit -m "feat: add limit checks to create routes"
```

---

### Task 10: Create Database Migration

**Files:**
- Create: `drizzle/0017_feature_flags_and_limits.sql`

**Step 1:** Create migration file

```sql
-- Update existing plans with new feature structure and limits
-- This replaces old feature format with new boolean flags

UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": false, "has_training": false, "has_pos": false, "has_public_site": false, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false}'::jsonb,
  limits = '{"users": 1, "customers": 50, "toursPerMonth": 5, "storageGb": 0.5}'::jsonb
WHERE name = 'free';

UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": false, "has_pos": false, "has_public_site": true, "has_advanced_notifications": false, "has_integrations": false, "has_api_access": false}'::jsonb,
  limits = '{"users": 3, "customers": 500, "toursPerMonth": 25, "storageGb": 5}'::jsonb
WHERE name = 'starter';

UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": true, "has_pos": true, "has_public_site": true, "has_advanced_notifications": true, "has_integrations": false, "has_api_access": false}'::jsonb,
  limits = '{"users": 10, "customers": 5000, "toursPerMonth": 100, "storageGb": 25}'::jsonb
WHERE name = 'pro';

UPDATE subscription_plans SET
  features = '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": true, "has_pos": true, "has_public_site": true, "has_advanced_notifications": true, "has_integrations": true, "has_api_access": true}'::jsonb,
  limits = '{"users": -1, "customers": -1, "toursPerMonth": -1, "storageGb": 100}'::jsonb
WHERE name = 'enterprise';
```

**Step 2:** Commit

```bash
git add drizzle/0017_feature_flags_and_limits.sql
git commit -m "feat: add migration for feature flags and limits"
```

---

### Task 11: Run Full Typecheck and Tests

**Step 1:** Run typecheck

```bash
npm run typecheck
```

**Step 2:** Run tests

```bash
npm test
```

**Step 3:** Fix any failing tests

**Step 4:** Commit fixes if any

```bash
git add -A
git commit -m "fix: address typecheck and test failures"
```

---

### Task 12: Deploy and Test End-to-End

**Step 1:** Push to staging

```bash
git push origin staging
```

**Step 2:** Run migration on staging database

**Step 3:** Test scenarios:
1. Log in as free tier tenant - verify only Tours & Bookings accessible
2. Click locked nav item - verify upgrade modal appears
3. Try to access /tenant/pos directly - verify redirect to dashboard with modal
4. Check dashboard - verify usage card shows stats
5. Create customers until near limit - verify warning appears
6. Log in to admin - verify plan editor shows new checkboxes and limit inputs
7. Edit a plan's features - verify changes affect tenant access

---

## Summary

This implementation provides:
- 8 feature flags controlling access to major features
- 4 quantity limits with 80% warning threshold
- Database-driven configuration editable by admins
- Upgrade modal UX for blocked features
- Dashboard usage display with visual progress bars
- Contextual warnings on create forms near limits
- Route-level protection for direct URL access
