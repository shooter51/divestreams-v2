# Tenant Public Site Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a customizable public-facing website for each tenant with online booking, customer accounts, themes, and custom domain support.

**Architecture:** Integrated routes at `/site` path in existing React Router app. Customer auth separate from staff auth. Themes via CSS variables. Custom domains via Caddy middleware.

**Tech Stack:** React Router v7, Drizzle ORM, PostgreSQL, TypeScript, Tailwind CSS, Stripe, Vitest

**Design Doc:** `docs/plans/2026-01-16-tenant-public-site-design.md`

---

## Task 1: Database Schema - Public Site Tables

**Files:**
- Create: `lib/db/schema/public-site.ts`
- Modify: `lib/db/schema.ts` (add export)

**Step 1: Create public site schema file**

Create `lib/db/schema/public-site.ts`:

```typescript
import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./auth";
import { customers } from "../schema";

// ============================================================================
// CUSTOMER CREDENTIALS (for public site login)
// ============================================================================

export const customerCredentials = pgTable(
  "customer_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    verificationToken: text("verification_token"),
    verificationTokenExpires: timestamp("verification_token_expires"),
    resetToken: text("reset_token"),
    resetTokenExpires: timestamp("reset_token_expires"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("customer_creds_org_idx").on(table.organizationId),
    uniqueIndex("customer_creds_org_email_idx").on(table.organizationId, table.email),
    index("customer_creds_customer_idx").on(table.customerId),
  ]
);

// ============================================================================
// CUSTOMER SESSIONS (for public site auth)
// ============================================================================

export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("customer_sessions_org_idx").on(table.organizationId),
    index("customer_sessions_token_idx").on(table.token),
    index("customer_sessions_expires_idx").on(table.expiresAt),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const customerCredentialsRelations = relations(
  customerCredentials,
  ({ one }) => ({
    organization: one(organization, {
      fields: [customerCredentials.organizationId],
      references: [organization.id],
    }),
    customer: one(customers, {
      fields: [customerCredentials.customerId],
      references: [customers.id],
    }),
  })
);

export const customerSessionsRelations = relations(
  customerSessions,
  ({ one }) => ({
    organization: one(organization, {
      fields: [customerSessions.organizationId],
      references: [organization.id],
    }),
    customer: one(customers, {
      fields: [customerSessions.customerId],
      references: [customers.id],
    }),
  })
);
```

**Step 2: Export from schema.ts**

Add to `lib/db/schema.ts`:

```typescript
export * from "./schema/public-site";
```

**Step 3: Run typecheck**

Run: `npm run typecheck`

**Step 4: Commit**

```bash
git add lib/db/schema/public-site.ts lib/db/schema.ts
git commit -m "feat(public-site): add database schema for customer credentials"
```

---

## Task 2: Schema Modifications - Add Public Flags

**Files:**
- Modify: `lib/db/schema/auth.ts` (add publicSiteSettings to organization)
- Modify: `lib/db/schema.ts` (add isPublic to trips, equipment)
- Modify: `lib/db/schema/training.ts` (add isPublic to courses)

**Step 1: Add publicSiteSettings to organization**

In `lib/db/schema/auth.ts`, add to organization table:

```typescript
customDomain: text("custom_domain"),
publicSiteSettings: jsonb("public_site_settings").$type<{
  enabled: boolean;
  theme: "ocean" | "tropical" | "minimal" | "dark" | "classic";
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  fontFamily: "inter" | "poppins" | "roboto" | "open-sans";
  pages: {
    home: boolean;
    about: boolean;
    trips: boolean;
    courses: boolean;
    equipment: boolean;
    contact: boolean;
    gallery: boolean;
  };
  aboutContent: string | null;
  contactInfo: {
    address: string | null;
    phone: string | null;
    email: string | null;
    hours: string | null;
    mapEmbed: string | null;
  } | null;
}>(),
```

**Step 2: Add isPublic to trips table**

In trips table definition, add:

```typescript
isPublic: boolean("is_public").notNull().default(false),
```

**Step 3: Add isPublic to equipment table**

In equipment table definition, add:

```typescript
isPublic: boolean("is_public").notNull().default(false),
```

**Step 4: Add isPublic to trainingCourses table**

In `lib/db/schema/training.ts`, add to trainingCourses:

```typescript
isPublic: boolean("is_public").notNull().default(false),
```

**Step 5: Add hasAccount to customers table**

In customers table definition, add:

```typescript
hasAccount: boolean("has_account").notNull().default(false),
```

**Step 6: Run typecheck and commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(public-site): add isPublic flags and publicSiteSettings to schema"
```

---

## Task 3: Database Migration

**Step 1: Generate migration**

```bash
npm run db:generate
```

**Step 2: Verify migration file**

Check that migration includes:
- CREATE TABLE customer_credentials
- CREATE TABLE customer_sessions
- ALTER TABLE organization ADD custom_domain, public_site_settings
- ALTER TABLE trips ADD is_public
- ALTER TABLE equipment ADD is_public
- ALTER TABLE training_courses ADD is_public
- ALTER TABLE customers ADD has_account

**Step 3: Commit**

```bash
git add drizzle/
git commit -m "feat(public-site): add migration for public site tables"
```

---

## Task 4: Server Functions - Customer Auth

**Files:**
- Create: `lib/auth/customer-auth.server.ts`
- Create: `tests/unit/lib/auth/customer-auth.server.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi } from "vitest";

describe("Customer Auth Server Functions", () => {
  describe("registerCustomer", () => {
    it("exports registerCustomer function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.registerCustomer).toBe("function");
    });
  });

  describe("loginCustomer", () => {
    it("exports loginCustomer function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.loginCustomer).toBe("function");
    });
  });

  describe("verifyCustomerSession", () => {
    it("exports verifyCustomerSession function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.verifyCustomerSession).toBe("function");
    });
  });

  describe("logoutCustomer", () => {
    it("exports logoutCustomer function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.logoutCustomer).toBe("function");
    });
  });

  describe("requestPasswordReset", () => {
    it("exports requestPasswordReset function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.requestPasswordReset).toBe("function");
    });
  });

  describe("resetPassword", () => {
    it("exports resetPassword function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.resetPassword).toBe("function");
    });
  });

  describe("getCustomerBySession", () => {
    it("exports getCustomerBySession function", async () => {
      const module = await import("../../../../lib/auth/customer-auth.server");
      expect(typeof module.getCustomerBySession).toBe("function");
    });
  });
});
```

**Step 2: Create customer-auth.server.ts**

```typescript
import { db } from "../db";
import { customerCredentials, customerSessions, customers } from "../db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const SESSION_DURATION_DAYS = 30;

export async function registerCustomer(
  organizationId: string,
  data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }
) {
  // Check if email already exists
  const existing = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.email, data.email.toLowerCase())
      )
    );

  if (existing.length > 0) {
    throw new Error("Email already registered");
  }

  // Create customer record
  const [customer] = await db
    .insert(customers)
    .values({
      organizationId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      hasAccount: true,
    })
    .returning();

  // Hash password and create credentials
  const passwordHash = await bcrypt.hash(data.password, 12);
  const verificationToken = randomBytes(32).toString("hex");

  await db.insert(customerCredentials).values({
    organizationId,
    customerId: customer.id,
    email: data.email.toLowerCase(),
    passwordHash,
    verificationToken,
    verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });

  return { customer, verificationToken };
}

export async function loginCustomer(
  organizationId: string,
  email: string,
  password: string
) {
  const [creds] = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.email, email.toLowerCase())
      )
    );

  if (!creds) {
    throw new Error("Invalid email or password");
  }

  const valid = await bcrypt.compare(password, creds.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  // Create session
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(customerSessions).values({
    organizationId,
    customerId: creds.customerId,
    token,
    expiresAt,
  });

  // Update last login
  await db
    .update(customerCredentials)
    .set({ lastLoginAt: new Date() })
    .where(eq(customerCredentials.id, creds.id));

  return { token, expiresAt };
}

export async function verifyCustomerSession(token: string) {
  const [session] = await db
    .select()
    .from(customerSessions)
    .where(eq(customerSessions.token, token));

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    // Session expired, delete it
    await db.delete(customerSessions).where(eq(customerSessions.id, session.id));
    return null;
  }

  return session;
}

export async function getCustomerBySession(token: string) {
  const session = await verifyCustomerSession(token);
  if (!session) {
    return null;
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, session.customerId));

  return customer || null;
}

export async function logoutCustomer(token: string) {
  await db.delete(customerSessions).where(eq(customerSessions.token, token));
}

export async function requestPasswordReset(organizationId: string, email: string) {
  const [creds] = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.email, email.toLowerCase())
      )
    );

  if (!creds) {
    // Don't reveal if email exists
    return null;
  }

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .update(customerCredentials)
    .set({ resetToken, resetTokenExpires })
    .where(eq(customerCredentials.id, creds.id));

  return { resetToken, email: creds.email };
}

export async function resetPassword(
  organizationId: string,
  token: string,
  newPassword: string
) {
  const [creds] = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.resetToken, token)
      )
    );

  if (!creds || !creds.resetTokenExpires || creds.resetTokenExpires < new Date()) {
    throw new Error("Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db
    .update(customerCredentials)
    .set({
      passwordHash,
      resetToken: null,
      resetTokenExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(customerCredentials.id, creds.id));
}

export async function verifyEmail(organizationId: string, token: string) {
  const [creds] = await db
    .select()
    .from(customerCredentials)
    .where(
      and(
        eq(customerCredentials.organizationId, organizationId),
        eq(customerCredentials.verificationToken, token)
      )
    );

  if (!creds || !creds.verificationTokenExpires || creds.verificationTokenExpires < new Date()) {
    throw new Error("Invalid or expired verification token");
  }

  await db
    .update(customerCredentials)
    .set({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(customerCredentials.id, creds.id));
}
```

**Step 3: Run tests and commit**

```bash
npm test tests/unit/lib/auth/customer-auth.server.test.ts
npm run typecheck
git add -A
git commit -m "feat(public-site): add customer auth server functions"
```

---

## Task 5: Server Functions - Public Site Data

**Files:**
- Create: `lib/db/public-site.server.ts`
- Create: `tests/unit/lib/db/public-site.server.test.ts`

**Functions to implement:**
- `getPublicSiteSettings(organizationId)` - Get site settings
- `updatePublicSiteSettings(organizationId, settings)` - Update settings
- `getPublicTrips(organizationId)` - Get trips where isPublic=true
- `getPublicCourses(organizationId)` - Get courses where isPublic=true
- `getPublicEquipment(organizationId)` - Get equipment where isPublic=true
- `getOrganizationByCustomDomain(domain)` - Resolve custom domain to org

**Step 1: Write tests, Step 2: Implement, Step 3: Commit**

---

## Task 6: Public Site Layout

**Files:**
- Create: `app/routes/site/_layout.tsx`

**Key features:**
- Resolve tenant from subdomain or custom domain
- Load public site settings
- Apply theme CSS variables
- Render header/footer with nav
- Check if public site is enabled (404 if not)

---

## Task 7: Public Site Homepage

**Files:**
- Create: `app/routes/site/index.tsx`

**Features:**
- Hero section with image and tagline
- Featured trips/courses grid
- About summary
- Contact info

---

## Task 8: Public Site About Page

**Files:**
- Create: `app/routes/site/about.tsx`

**Features:**
- Rich text content from settings
- Team photos (optional)
- Certifications/affiliations

---

## Task 9: Public Site Trips List

**Files:**
- Create: `app/routes/site/trips/index.tsx`

**Features:**
- Grid of public trips
- Filter by date range
- Trip cards with image, name, price, dates
- Link to detail page

---

## Task 10: Public Site Trip Detail

**Files:**
- Create: `app/routes/site/trips/$tripId.tsx`

**Features:**
- Trip details (description, itinerary, requirements)
- Pricing and availability
- "Book Now" button → booking flow

---

## Task 11: Public Site Courses List

**Files:**
- Create: `app/routes/site/courses/index.tsx`

**Features:**
- Grid of public training courses
- Filter by agency/level
- Course cards with certification info

---

## Task 12: Public Site Course Detail

**Files:**
- Create: `app/routes/site/courses/$courseId.tsx`

**Features:**
- Course description and requirements
- Prerequisites display
- Schedule/sessions available
- "Enroll Now" button → booking flow

---

## Task 13: Public Site Contact Page

**Files:**
- Create: `app/routes/site/contact.tsx`

**Features:**
- Contact form (name, email, message)
- Address and map embed
- Hours of operation
- Phone and email links

---

## Task 14: Customer Registration Page

**Files:**
- Create: `app/routes/site/register.tsx`

**Features:**
- Registration form (name, email, password)
- Password requirements validation
- Terms acceptance checkbox
- Submit → create account → redirect to login

---

## Task 15: Customer Login Page

**Files:**
- Create: `app/routes/site/login.tsx`

**Features:**
- Email/password form
- "Forgot password" link
- Login → create session → redirect to account or booking

---

## Task 16: Customer Account Dashboard

**Files:**
- Create: `app/routes/site/account/_layout.tsx`
- Create: `app/routes/site/account/index.tsx`

**Features:**
- Require customer auth
- Show upcoming bookings
- Show past trips/courses
- Show certifications earned
- Links to profile, bookings, etc.

---

## Task 17: Customer Bookings Page

**Files:**
- Create: `app/routes/site/account/bookings.tsx`

**Features:**
- List all bookings (upcoming and past)
- Booking details (date, status, payment)
- Cancel booking option (if allowed)

---

## Task 18: Customer Profile Page

**Files:**
- Create: `app/routes/site/account/profile.tsx`

**Features:**
- Edit name, email, phone
- Change password
- Emergency contact info
- Certification details

---

## Task 19: Booking Flow - Select

**Files:**
- Create: `app/routes/site/book/$type.$id.tsx`

**Features:**
- Load trip or course details
- Show available dates/sessions
- Select date and party size
- Require login (redirect if not authenticated)
- Continue to payment

---

## Task 20: Booking Flow - Payment

**Files:**
- Create: `app/routes/site/book/$type.$id.payment.tsx`

**Features:**
- Show booking summary
- Stripe Elements for payment
- Process payment via Stripe
- Create booking record
- Redirect to confirmation

---

## Task 21: Booking Confirmation

**Files:**
- Create: `app/routes/site/book/confirmation.$bookingId.tsx`

**Features:**
- Show booking confirmation
- Booking reference number
- What's next instructions
- Link to account bookings

---

## Task 22: Admin - Public Site Settings

**Files:**
- Create: `app/routes/tenant/settings/public-site/index.tsx`

**Features:**
- Enable/disable public site toggle
- General settings (name, tagline)
- Theme selection
- Color customization
- Logo/hero upload
- Page enable/disable toggles

---

## Task 23: Admin - Public Site Content

**Files:**
- Create: `app/routes/tenant/settings/public-site/content.tsx`

**Features:**
- About page content (rich text editor)
- Contact info form
- Gallery management

---

## Task 24: Admin - Custom Domain

**Files:**
- Create: `app/routes/tenant/settings/public-site/domain.tsx`

**Features:**
- Add/remove custom domain
- DNS instructions display
- Domain verification status
- SSL status

---

## Task 25: Theme System

**Files:**
- Create: `app/styles/themes/ocean.css`
- Create: `app/styles/themes/tropical.css`
- Create: `app/styles/themes/minimal.css`
- Create: `app/styles/themes/dark.css`
- Create: `app/styles/themes/classic.css`

**Features:**
- CSS variable definitions per theme
- Typography, colors, spacing
- Component style overrides

---

## Task 26: Custom Domain Middleware

**Files:**
- Modify: `app/entry.server.tsx` or middleware

**Features:**
- Check request hostname
- If not *.divestreams.com, lookup custom domain
- Set organization context for request
- Handle domain not found (404)

---

## Task 27: Freemium Integration

**Files:**
- Modify: Public site routes to check premium status
- Modify: Settings routes to gate public site features

**Features:**
- Free tier: Public site disabled
- Premium tier: Full public site access
- Show upgrade prompts where appropriate

---

## Task 28: Final Integration Test

**Steps:**
1. Run full test suite
2. Manual test of public site flow
3. Test booking end-to-end
4. Test custom domain resolution
5. Verify all premium gates work

```bash
npm run typecheck
npm test
npm run build
```

---

## Implementation Priority

**Phase 1 (MVP):** Tasks 1-7, 14-15, 19-21, 22
- Basic public site with homepage
- Customer registration/login
- Booking flow
- Admin settings

**Phase 2 (Content):** Tasks 8-13, 23
- All content pages
- Courses integration
- Contact form

**Phase 3 (Polish):** Tasks 16-18, 24-27
- Customer account features
- Custom domains
- Themes
- Freemium gates

**Phase 4 (Testing):** Task 28
- Full integration testing
