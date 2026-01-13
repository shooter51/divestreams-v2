# Better Auth Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate DiveStreams from custom auth (broken admin auth + schema-per-tenant) to Better Auth with single-schema architecture and full multi-tenancy support.

**Architecture:** Single PostgreSQL schema with `organization_id` on all tables. Better Auth handles users, sessions, and organizations. Platform admins are members of a special "platform" organization.

**Tech Stack:** Better Auth v1.2.0 (installed), Drizzle ORM, PostgreSQL, Stripe (existing), React Router v7

**Design Doc:** `docs/plans/2026-01-13-better-auth-design.md`

---

## Phase 1: Database Schema Migration

### Task 1.1: Create Better Auth Schema Tables

**Files:**
- Create: `lib/db/schema/auth.ts`
- Modify: `lib/db/schema.ts`

**Step 1: Create auth schema file**

```typescript
// lib/db/schema/auth.ts
import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  index,
} from "drizzle-orm/pg-core";

// Better Auth core tables (public schema)
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("session_user_idx").on(table.userId),
]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("account_user_idx").on(table.userId),
]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Organization tables (Better Auth organization plugin)
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"), // JSON string for extra data
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("organization_slug_idx").on(table.slug),
]);

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("customer"), // owner, admin, staff, customer
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("member_user_idx").on(table.userId),
  index("member_org_idx").on(table.organizationId),
]);

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("staff"),
  status: text("status").notNull().default("pending"), // pending, accepted, expired
  inviterId: text("inviter_id").references(() => user.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("invitation_email_idx").on(table.email),
  index("invitation_org_idx").on(table.organizationId),
]);
```

**Step 2: Run migration to create tables**

```bash
npm run db:generate
npm run db:migrate
```

**Step 3: Verify tables exist**

```bash
npm run db:studio
# Check that user, session, account, verification, organization, member, invitation tables exist
```

**Step 4: Commit**

```bash
git add lib/db/schema/auth.ts lib/db/schema.ts
git commit -m "feat(auth): add Better Auth schema tables"
```

---

### Task 1.2: Create Subscription Table

**Files:**
- Create: `lib/db/schema/subscription.ts`

**Step 1: Create subscription schema**

```typescript
// lib/db/schema/subscription.ts
import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const subscription = pgTable("subscription", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),

  // Plan info
  plan: text("plan").notNull().default("free"), // free, premium
  status: text("status").notNull().default("active"), // trialing, active, past_due, canceled

  // Stripe
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),

  // Trial
  trialEndsAt: timestamp("trial_ends_at"),

  // Billing period
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),

  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("subscription_org_idx").on(table.organizationId),
  index("subscription_stripe_idx").on(table.stripeCustomerId),
]);

// Usage tracking for free tier limits
export const usageTracking = pgTable("usage_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),

  // Current month usage
  month: text("month").notNull(), // YYYY-MM format
  bookingsCount: integer("bookings_count").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("usage_org_month_idx").on(table.organizationId, table.month),
]);
```

**Step 2: Run migration**

```bash
npm run db:generate
npm run db:migrate
```

**Step 3: Commit**

```bash
git add lib/db/schema/subscription.ts
git commit -m "feat(billing): add subscription and usage tracking tables"
```

---

### Task 1.3: Add organization_id to Business Tables

**Files:**
- Modify: `lib/db/schema.ts` - Remove `createTenantSchema`, add organization_id columns

**Step 1: Rewrite schema.ts for single-schema architecture**

Replace the entire `createTenantSchema` function with flat tables that have `organization_id`:

```typescript
// lib/db/schema.ts
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  uuid,
  jsonb,
  date,
  time,
  index,
} from "drizzle-orm/pg-core";
import { organization } from "./schema/auth";

// Re-export auth schema
export * from "./schema/auth";
export * from "./schema/subscription";

// Customers (divers)
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),

  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  dateOfBirth: date("date_of_birth"),

  // Emergency contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),

  // Medical info
  medicalConditions: text("medical_conditions"),
  medications: text("medications"),

  // Certifications
  certifications: jsonb("certifications").$type<{
    agency: string;
    level: string;
    number?: string;
    date?: string;
  }[]>(),

  // Address
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country"),

  // Preferences
  preferredLanguage: text("preferred_language").default("en"),
  marketingOptIn: boolean("marketing_opt_in").default(false),

  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>(),

  // Stats
  totalDives: integer("total_dives").default(0),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
  lastDiveAt: timestamp("last_dive_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("customers_org_idx").on(table.organizationId),
  index("customers_email_idx").on(table.organizationId, table.email),
  index("customers_name_idx").on(table.organizationId, table.lastName, table.firstName),
]);

// Similar pattern for all other tables: boats, diveSites, tours, trips, bookings, equipment, transactions, rentals, products, discountCodes, images
// Each table gets organizationId column and indexes include organizationId
```

**Note:** This is a large file. The full implementation will follow the same pattern for all tables.

**Step 2: Run migration**

```bash
npm run db:generate
npm run db:migrate
```

**Step 3: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat(db): migrate to single-schema with organization_id"
```

---

## Phase 2: Better Auth Configuration

### Task 2.1: Configure Better Auth with Organization Plugin

**Files:**
- Modify: `lib/auth/index.ts`

**Step 1: Update Better Auth configuration**

```typescript
// lib/auth/index.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { db } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // 24-48 hour grace period
    sendResetPassword: async ({ user, url }) => {
      // TODO: Implement email sending
      console.log(`Password reset for ${user.email}: ${url}`);
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session age daily
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10, // Max orgs per user
      creatorRole: "owner",
      memberRoles: ["owner", "admin", "staff", "customer"],
      defaultRole: "customer",
      invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
    }),
  ],

  trustedOrigins: [
    "https://divestreams.com",
    "https://*.divestreams.com",
    "http://localhost:5173",
    "http://*.localhost:5173",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
```

**Step 2: Verify configuration compiles**

```bash
npm run typecheck
```

**Step 3: Commit**

```bash
git add lib/auth/index.ts
git commit -m "feat(auth): configure Better Auth with organization plugin"
```

---

### Task 2.2: Create Auth API Routes

**Files:**
- Create: `app/routes/api/auth.$.tsx`

**Step 1: Create auth API handler**

```typescript
// app/routes/api/auth.$.tsx
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { auth } from "../../../lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  return auth.handler(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return auth.handler(request);
}
```

**Step 2: Verify route works**

```bash
npm run dev
# Test: curl http://localhost:5173/api/auth/session
```

**Step 3: Commit**

```bash
git add app/routes/api/auth.$.tsx
git commit -m "feat(auth): add Better Auth API route handler"
```

---

### Task 2.3: Create Auth Client

**Files:**
- Create: `lib/auth/client.ts`

**Step 1: Create client-side auth helpers**

```typescript
// lib/auth/client.ts
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  plugins: [organizationClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
} = authClient;
```

**Step 2: Commit**

```bash
git add lib/auth/client.ts
git commit -m "feat(auth): add Better Auth client helpers"
```

---

## Phase 3: Auth Middleware & Context

### Task 3.1: Create Organization Context Helper

**Files:**
- Create: `lib/auth/org-context.server.ts`

**Step 1: Create org context helper**

```typescript
// lib/auth/org-context.server.ts
import { redirect } from "react-router";
import { auth } from "./index";
import { db } from "../db";
import { organization, member, subscription, usageTracking } from "../db/schema";
import { eq, and } from "drizzle-orm";

// Free tier limits
export const FREE_TIER_LIMITS = {
  customers: 50,
  bookingsPerMonth: 20,
  tours: 3,
  teamMembers: 1, // owner only
  hasPOS: false,
  hasEquipmentRentals: false,
  hasAdvancedReports: false,
  hasEmailNotifications: false,
};

export type OrgContext = {
  user: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"];
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["session"];
  org: typeof organization.$inferSelect;
  membership: typeof member.$inferSelect;
  subscription: typeof subscription.$inferSelect;
  limits: typeof FREE_TIER_LIMITS;
  usage: {
    customers: number;
    tours: number;
    bookingsThisMonth: number;
  };
  canAddCustomer: boolean;
  canAddTour: boolean;
  canAddBooking: boolean;
  isPremium: boolean;
};

// Get subdomain from request
export function getSubdomainFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const host = url.hostname;

  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0];
    }
    return null;
  }

  const parts = host.split(".");
  if (parts.length >= 3 && parts[0] !== "www") {
    return parts[0];
  }
  return null;
}

// Check if on admin subdomain
export function isAdminSubdomain(request: Request): boolean {
  const subdomain = getSubdomainFromRequest(request);
  return subdomain === "admin";
}

// Get organization context for tenant routes
export async function getOrgContext(request: Request): Promise<OrgContext | null> {
  const subdomain = getSubdomainFromRequest(request);
  if (!subdomain || subdomain === "admin") {
    return null;
  }

  // Get session
  const sessionResult = await auth.api.getSession({ headers: request.headers });
  if (!sessionResult) {
    return null;
  }

  // Get organization by slug
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return null;
  }

  // Get membership
  const [membership] = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.organizationId, org.id),
        eq(member.userId, sessionResult.user.id)
      )
    )
    .limit(1);

  if (!membership) {
    return null;
  }

  // Get subscription
  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, org.id))
    .limit(1);

  const isPremium = sub?.plan === "premium" && sub?.status === "active";
  const limits = isPremium
    ? { ...FREE_TIER_LIMITS, customers: Infinity, bookingsPerMonth: Infinity, tours: Infinity, teamMembers: Infinity, hasPOS: true, hasEquipmentRentals: true, hasAdvancedReports: true, hasEmailNotifications: true }
    : FREE_TIER_LIMITS;

  // Get usage counts
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  // TODO: Implement actual count queries

  const usage = {
    customers: 0, // TODO: COUNT from customers table
    tours: 0, // TODO: COUNT from tours table
    bookingsThisMonth: 0, // TODO: COUNT from usageTracking
  };

  return {
    user: sessionResult.user,
    session: sessionResult.session,
    org,
    membership,
    subscription: sub || {
      id: "",
      organizationId: org.id,
      plan: "free",
      status: "active",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      trialEndsAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    limits,
    usage,
    canAddCustomer: usage.customers < limits.customers,
    canAddTour: usage.tours < limits.tours,
    canAddBooking: usage.bookingsThisMonth < limits.bookingsPerMonth,
    isPremium,
  };
}

// Require org context - redirect to login if not authenticated
export async function requireOrgContext(request: Request): Promise<OrgContext> {
  const context = await getOrgContext(request);

  if (!context) {
    const subdomain = getSubdomainFromRequest(request);
    if (!subdomain) {
      throw redirect("https://divestreams.com");
    }
    throw redirect("/login");
  }

  return context;
}

// Require specific role
export function requireRole(context: OrgContext, roles: string[]): void {
  if (!roles.includes(context.membership.role)) {
    throw new Response("Forbidden", { status: 403 });
  }
}

// Require premium for feature
export function requirePremium(context: OrgContext, feature: string): void {
  if (!context.isPremium) {
    throw new Response(`Premium required for ${feature}`, { status: 403 });
  }
}
```

**Step 2: Commit**

```bash
git add lib/auth/org-context.server.ts
git commit -m "feat(auth): add organization context helper with freemium limits"
```

---

### Task 3.2: Create Platform Admin Context Helper

**Files:**
- Create: `lib/auth/platform-context.server.ts`

**Step 1: Create platform admin context helper**

```typescript
// lib/auth/platform-context.server.ts
import { redirect } from "react-router";
import { auth } from "./index";
import { db } from "../db";
import { organization, member } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { isAdminSubdomain } from "./org-context.server";

const PLATFORM_ORG_SLUG = "platform";

export type PlatformContext = {
  user: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"];
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["session"];
  membership: typeof member.$inferSelect;
  isOwner: boolean;
  isAdmin: boolean;
};

// Get platform admin context
export async function getPlatformContext(request: Request): Promise<PlatformContext | null> {
  if (!isAdminSubdomain(request)) {
    return null;
  }

  const sessionResult = await auth.api.getSession({ headers: request.headers });
  if (!sessionResult) {
    return null;
  }

  // Get platform organization
  const [platformOrg] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, PLATFORM_ORG_SLUG))
    .limit(1);

  if (!platformOrg) {
    return null;
  }

  // Get membership
  const [membership] = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.organizationId, platformOrg.id),
        eq(member.userId, sessionResult.user.id)
      )
    )
    .limit(1);

  if (!membership) {
    return null;
  }

  return {
    user: sessionResult.user,
    session: sessionResult.session,
    membership,
    isOwner: membership.role === "owner",
    isAdmin: membership.role === "owner" || membership.role === "admin",
  };
}

// Require platform admin context
export async function requirePlatformContext(request: Request): Promise<PlatformContext> {
  const context = await getPlatformContext(request);

  if (!context) {
    throw redirect("/login");
  }

  return context;
}

// Require platform admin role
export function requirePlatformAdmin(context: PlatformContext): void {
  if (!context.isAdmin) {
    throw new Response("Forbidden - Admin access required", { status: 403 });
  }
}
```

**Step 2: Commit**

```bash
git add lib/auth/platform-context.server.ts
git commit -m "feat(auth): add platform admin context helper"
```

---

## Phase 4: UI Components

### Task 4.1: Create Upgrade Prompt Component

**Files:**
- Create: `app/components/UpgradePrompt.tsx`

**Step 1: Create component**

```typescript
// app/components/UpgradePrompt.tsx
import { Link } from "react-router";

type Props = {
  feature: string;
  currentCount?: number;
  limit?: number;
  variant?: "banner" | "inline" | "overlay";
};

export function UpgradePrompt({ feature, currentCount, limit, variant = "banner" }: Props) {
  const message = limit !== undefined && currentCount !== undefined
    ? `You've reached ${currentCount}/${limit} ${feature} on the Free plan`
    : `${feature} is a Premium feature`;

  if (variant === "overlay") {
    return (
      <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
        <div className="text-center p-8 max-w-md">
          <div className="text-4xl mb-4">*</div>
          <h3 className="text-xl font-semibold mb-2">Premium Feature</h3>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/settings/billing"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Upgrade Now
            </Link>
            <Link
              to="/settings/billing"
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
        <p className="text-amber-800 text-sm mb-2">{message}</p>
        <Link
          to="/settings/billing"
          className="text-amber-600 hover:text-amber-700 text-sm font-medium underline"
        >
          Upgrade to Premium
        </Link>
      </div>
    );
  }

  // Banner (default)
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Upgrade to Premium</p>
          <p className="text-sm text-blue-100">{message}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/settings/billing"
            className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50"
          >
            Upgrade Now
          </Link>
          <Link
            to="/settings/billing"
            className="px-4 py-2 border border-white/50 rounded-lg text-white hover:bg-white/10"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/components/UpgradePrompt.tsx
git commit -m "feat(ui): add UpgradePrompt component for freemium"
```

---

### Task 4.2: Create Organization Switcher Component

**Files:**
- Create: `app/components/OrgSwitcher.tsx`

**Step 1: Create component**

```typescript
// app/components/OrgSwitcher.tsx
import { useState } from "react";
import { organization } from "../../lib/auth/client";

type Org = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

type Props = {
  currentOrg: Org;
  userOrgs: Org[];
};

export function OrgSwitcher({ currentOrg, userOrgs }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSwitch = (slug: string) => {
    // Redirect to the org's subdomain
    const protocol = window.location.protocol;
    const host = window.location.host;

    // Replace current subdomain with new one
    let newHost: string;
    if (host.includes("localhost")) {
      const parts = host.split(".");
      parts[0] = slug;
      newHost = parts.join(".");
    } else {
      const parts = host.split(".");
      parts[0] = slug;
      newHost = parts.join(".");
    }

    window.location.href = `${protocol}//${newHost}/app`;
  };

  if (userOrgs.length <= 1) {
    return (
      <div className="px-3 py-2 font-medium text-gray-900">
        {currentOrg.name}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
      >
        {currentOrg.logo && (
          <img src={currentOrg.logo} alt="" className="w-6 h-6 rounded" />
        )}
        <span className="font-medium">{currentOrg.name}</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border z-20">
            {userOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.slug)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
                  org.id === currentOrg.id ? "bg-blue-50" : ""
                }`}
              >
                {org.logo ? (
                  <img src={org.logo} alt="" className="w-8 h-8 rounded" />
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-sm font-medium">
                    {org.name[0]}
                  </div>
                )}
                <span className="flex-1 text-left font-medium">{org.name}</span>
                {org.id === currentOrg.id && (
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/components/OrgSwitcher.tsx
git commit -m "feat(ui): add OrgSwitcher component for multi-org support"
```

---

## Phase 5: Update Tenant Routes (Freemium Enforcement)

### Task 5.1: Update Customers Route

**Files:**
- Modify: `app/routes/tenant/customers/index.tsx`

**Step 1: Add org context and freemium check to loader**

```typescript
// In loader function
import { requireOrgContext, type OrgContext } from "../../../../lib/auth/org-context.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Get customers for this org
  const customerList = await db
    .select()
    .from(customers)
    .where(eq(customers.organizationId, ctx.org.id))
    .orderBy(customers.lastName, customers.firstName);

  return {
    customers: customerList,
    canAddCustomer: ctx.canAddCustomer,
    usage: ctx.usage.customers,
    limit: ctx.limits.customers,
    isPremium: ctx.isPremium,
  };
}
```

**Step 2: Add freemium UI to component**

```typescript
// In component
import { UpgradePrompt } from "../../../components/UpgradePrompt";

export default function CustomersPage() {
  const { customers, canAddCustomer, usage, limit, isPremium } = useLoaderData<typeof loader>();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          {!isPremium && (
            <p className="text-sm text-gray-500">{usage}/{limit} customers</p>
          )}
        </div>
        {canAddCustomer ? (
          <Link to="new" className="btn-primary">Add Customer</Link>
        ) : (
          <button disabled className="btn-primary opacity-50 cursor-not-allowed">
            Add Customer (Limit Reached)
          </button>
        )}
      </div>

      {!canAddCustomer && (
        <div className="mb-6">
          <UpgradePrompt feature="customers" currentCount={usage} limit={limit} />
        </div>
      )}

      {/* Rest of component */}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/routes/tenant/customers/index.tsx
git commit -m "feat(freemium): add customer limits to customers page"
```

---

### Task 5.2: Update Tours Route

**Files:**
- Modify: `app/routes/tenant/tours/index.tsx`

Apply same pattern as Task 5.1:
- Add org context to loader
- Return `canAddTour`, `usage.tours`, `limits.tours`, `isPremium`
- Add freemium UI with UpgradePrompt when at limit

---

### Task 5.3: Update Bookings Route

**Files:**
- Modify: `app/routes/tenant/bookings/index.tsx`

Apply same pattern:
- Add org context to loader
- Return `canAddBooking`, `usage.bookingsThisMonth`, `limits.bookingsPerMonth`, `isPremium`
- Show monthly count (X/20)
- Block new bookings at limit

---

### Task 5.4: Update POS Route (Premium Overlay)

**Files:**
- Modify: `app/routes/tenant/pos/index.tsx`

**Step 1: Add premium check**

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  if (!ctx.isPremium) {
    // Return minimal data for premium overlay
    return { isPremium: false };
  }

  // Return full POS data
  return { isPremium: true, /* ...other data */ };
}
```

**Step 2: Add premium overlay**

```typescript
export default function POSPage() {
  const { isPremium, ...data } = useLoaderData<typeof loader>();

  return (
    <div className="relative">
      {!isPremium && (
        <UpgradePrompt feature="Point of Sale" variant="overlay" />
      )}
      {/* POS content */}
    </div>
  );
}
```

---

### Task 5.5: Update Equipment Rentals Route (Premium Overlay)

**Files:**
- Modify: `app/routes/tenant/equipment/index.tsx`

Same pattern as POS - show premium overlay if not premium.

---

### Task 5.6: Update Reports Route (Premium Lock)

**Files:**
- Modify: `app/routes/tenant/reports/index.tsx`

**Step 1: Add premium check**

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Basic stats available to all
  const basicStats = { /* ... */ };

  // Advanced reports only for premium
  let advancedReports = null;
  if (ctx.isPremium) {
    advancedReports = { /* ... */ };
  }

  return { isPremium: ctx.isPremium, basicStats, advancedReports };
}
```

**Step 2: Blur/lock advanced reports**

Show basic stats to all. Advanced reports section gets blur effect with upgrade CTA for free users.

---

### Task 5.7: Update Team/Settings Route (Premium Lock)

**Files:**
- Modify: `app/routes/tenant/settings/team.tsx`

**Step 1: Hide invite for free users**

```typescript
export default function TeamPage() {
  const { members, isPremium, canInvite } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Team Members</h1>

      {isPremium ? (
        <Link to="invite">Invite Team Member</Link>
      ) : (
        <div className="p-4 bg-gray-50 rounded border">
          <p className="text-gray-600">Upgrade to Premium to add team members</p>
          <Link to="/settings/billing" className="text-blue-600">Upgrade Now</Link>
        </div>
      )}

      {/* Members list */}
    </div>
  );
}
```

---

### Task 5.8: Update All Remaining Tenant Routes

Apply org context pattern to all remaining routes:
- `app/routes/tenant/dashboard.tsx`
- `app/routes/tenant/boats/index.tsx`
- `app/routes/tenant/dive-sites/index.tsx`
- `app/routes/tenant/trips/index.tsx`
- `app/routes/tenant/calendar.tsx`
- `app/routes/tenant/discounts.tsx`
- `app/routes/tenant/products.tsx`
- `app/routes/tenant/settings/index.tsx`
- `app/routes/tenant/settings/profile.tsx`
- `app/routes/tenant/settings/billing.tsx`
- `app/routes/tenant/settings/integrations.tsx`

Each route needs:
1. Import `requireOrgContext`
2. Call `requireOrgContext(request)` in loader
3. Pass org context data to component
4. Apply freemium restrictions as per design doc

---

## Phase 6: Auth Routes

### Task 6.1: Create New Login Route

**Files:**
- Modify: `app/routes/auth/login.tsx`

Replace custom auth with Better Auth:

```typescript
// app/routes/auth/login.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, useActionData, useNavigation, Form } from "react-router";
import { auth } from "../../../lib/auth";
import { getSubdomainFromRequest } from "../../../lib/auth/org-context.server";

export const meta: MetaFunction = () => [{ title: "Sign In - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if already logged in
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) {
    return redirect("/app");
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
    });

    if (result.error) {
      return { error: result.error.message };
    }

    // Set session cookie and redirect
    return redirect("/app", {
      headers: result.headers,
    });
  } catch (error) {
    return { error: "Invalid email or password" };
  }
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">Sign In</h1>

        {actionData?.error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </Form>

        <div className="mt-4 text-center text-sm">
          <a href="/forgot-password" className="text-blue-600 hover:underline">
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 6.2: Create Signup Route

**Files:**
- Create: `app/routes/marketing/signup.tsx`

Create signup flow that:
1. Creates user account
2. Creates organization
3. Creates subscription (free, trialing for 14 days)
4. Redirects to subdomain

---

### Task 6.3: Create Password Reset Routes

**Files:**
- Modify: `app/routes/auth/forgot-password.tsx`
- Modify: `app/routes/auth/reset-password.tsx`

Integrate with Better Auth password reset flow.

---

## Phase 7: Admin Routes

### Task 7.1: Update Admin Login

**Files:**
- Modify: `app/routes/admin/login.tsx`

Replace custom admin auth with Better Auth + platform org check.

---

### Task 7.2: Update Admin Dashboard

**Files:**
- Modify: `app/routes/admin/index.tsx`

Use `requirePlatformContext` instead of `requireAdmin`.

---

### Task 7.3: Create Platform Bootstrap Script

**Files:**
- Create: `scripts/bootstrap-platform.ts`

Script to create "platform" organization and send invitation to PLATFORM_ADMIN_EMAIL on first run.

---

## Phase 8: Cleanup

### Task 8.1: Remove Old Auth Files

**Files:**
- Delete: `lib/auth/admin-auth.server.ts`
- Delete: `lib/auth/tenant-auth.server.ts` (keep subdomain helper if needed)

---

### Task 8.2: Update Environment Variables

**Files:**
- Modify: `docker-compose.yml`
- Create: `.env.example`

Add:
```env
BETTER_AUTH_SECRET=<generate-secure-secret>
PLATFORM_ADMIN_EMAIL=admin@divestreams.com
```

Remove:
```env
ADMIN_PASSWORD
```

---

## Phase 9: Background Jobs

### Task 9.1: Create Stale Tenant Cleanup Job

**Files:**
- Create: `lib/jobs/stale-tenant-cleanup.ts`

Job that:
1. Finds free-tier orgs with no login activity > 60 days
2. Sends warning emails at 60, 75 days
3. Soft-deletes at 90 days
4. Hard-deletes after 180 days (90-day retention)

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
- [ ] Free tier limits enforced on ALL pages
- [ ] Upgrade to Premium works via Stripe
- [ ] Stale free tenant cleanup runs on schedule
- [ ] Data export works for all users
- [ ] Password reset works
- [ ] Sessions last 30 days
