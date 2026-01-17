# Tenant Public Site - Design Document

**Date:** 2026-01-16
**Status:** Approved
**Author:** Claude (with Tom Gibson)

## Overview

A customizable public-facing website for each dive shop tenant, allowing them to showcase their business, display trips/courses, and accept online bookings with customer accounts.

## Goals

1. Provide each tenant with a professional public website
2. Enable online bookings with integrated payment (Stripe direct, POS optional)
3. Support custom domains for branding
4. Minimize content management overhead via selective data sync

## Architecture

### Approach: Integrated Routes in React Router

The public site lives within the existing React Router application as new routes under the `/site` path:

```
demo.divestreams.com/site          → Public homepage
demo.divestreams.com/site/about    → About page
demo.divestreams.com/site/trips    → Trip listings
demo.divestreams.com/site/courses  → Course listings (training module)
demo.divestreams.com/site/book/:id → Booking flow
demo.divestreams.com/site/login    → Customer account login
demo.divestreams.com/site/account  → Customer dashboard
```

### Why This Approach

- Single codebase - reuse components, booking logic, auth
- Real-time data - changes appear immediately
- Booking integration is trivial (same app)
- Custom domains handled at Caddy level
- Familiar tech stack

### Custom Domains

- Shop adds custom domain in Settings (e.g., `www.oceandive.com`)
- DNS instructions provided (CNAME to `demo.divestreams.com`)
- Caddy handles SSL via Let's Encrypt
- Middleware checks hostname, routes to correct tenant's `/site`

## Pages & Content

### Configurable Pages

| Page | Content Source | Default |
|------|---------------|---------|
| Home | Hero image, tagline, featured trips/courses | Enabled |
| About | Rich text from settings | Enabled |
| Trips | Trips marked "public" in admin | Enabled |
| Courses | Training courses marked "public" | Enabled (if training active) |
| Equipment | Equipment rentals/sales marked "public" | Optional |
| Contact | Hours, location, contact form | Enabled |
| Gallery | Photos uploaded to gallery | Optional |

### Content Editing

Via Settings form in admin panel:
- `Settings > Public Site > General` - Site name, tagline, logo, theme
- `Settings > Public Site > About` - About page content (rich text editor)
- `Settings > Public Site > Contact` - Hours, address, phone, email, map embed
- `Settings > Public Site > Appearance` - Theme selection, colors, fonts

### Data Sync (Selective)

- Each trip/course/equipment item has an `isPublic` toggle
- Only items marked public appear on the public site
- Pricing, availability, descriptions pulled from existing data

## Customer Accounts

### Authentication

- Email/password registration or magic link login
- Separate from staff auth (different session cookie)
- Customer data stored in existing `customers` table with `hasAccount: true` flag
- Password hash stored in new `customerCredentials` table

### Customer Dashboard (`/site/account`)

- Upcoming bookings
- Past trips/courses
- Certifications earned (from training module)
- Saved payment methods
- Profile settings

## Booking Flow

### Without POS (Default)

```
Browse Trips/Courses → Select Date → Create Account (if new) →
Enter Details → Pay via Stripe → Confirmation Email
```

### Payment Options

1. **Direct Stripe** (default) - Customer pays online, shop receives via Stripe Connect
2. **POS Integration** (optional) - If enabled, booking creates a POS transaction for in-store payment

### Data Relationships

- Online booking creates entry in `bookings` table (existing)
- Links to `customers` table (existing)
- If training course, creates `trainingEnrollments` entry
- Payment recorded in `payments` table or via Stripe webhooks

## Themes & Appearance

### Theme System

- 5-6 pre-built themes (Ocean Blue, Tropical, Minimal, Dark, etc.)
- Each theme defines color palette, typography, layout style
- Stored as CSS variables, applied via theme class on body

### Customization Options

- Primary/secondary colors
- Logo upload
- Hero image
- Font selection (3-4 options: Inter, Poppins, Roboto, etc.)

### Settings Storage

```typescript
// In organization settings (existing table)
publicSiteSettings: {
  enabled: boolean;
  theme: "ocean" | "tropical" | "minimal" | "dark" | "custom";
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  heroImageUrl: string;
  fontFamily: "inter" | "poppins" | "roboto";
  pages: {
    home: boolean;
    about: boolean;
    trips: boolean;
    courses: boolean;
    equipment: boolean;
    contact: boolean;
    gallery: boolean;
  };
  aboutContent: string;
  contactInfo: {
    address: string;
    phone: string;
    email: string;
    hours: string;
    mapEmbed: string;
  };
}
```

## Database Changes

### New Tables

```sql
-- Customer credentials (for account login)
CREATE TABLE customer_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL REFERENCES organization(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  reset_token TEXT,
  reset_token_expires TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, email)
);
```

### Modified Tables

```sql
-- Add to organization table
ALTER TABLE organization ADD COLUMN custom_domain TEXT;
ALTER TABLE organization ADD COLUMN public_site_settings JSONB;

-- Add public visibility to content tables
ALTER TABLE trips ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE training_courses ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE equipment ADD COLUMN is_public BOOLEAN DEFAULT FALSE;

-- Add account flag to customers
ALTER TABLE customers ADD COLUMN has_account BOOLEAN DEFAULT FALSE;
```

## Route Structure

```
app/routes/
  site/                      # Public site routes
    _layout.tsx             # Public site layout (header, footer, theme)
    index.tsx               # Homepage
    about.tsx               # About page
    trips/
      index.tsx             # Trip listings
      $tripId.tsx           # Trip detail
    courses/
      index.tsx             # Course listings
      $courseId.tsx         # Course detail
    equipment/
      index.tsx             # Equipment listings
    contact.tsx             # Contact page
    gallery.tsx             # Photo gallery
    book/
      $type.$id.tsx         # Booking flow (type: trip|course)
    login.tsx               # Customer login
    register.tsx            # Customer registration
    forgot-password.tsx     # Password reset
    account/                # Customer dashboard (auth required)
      _layout.tsx           # Account layout
      index.tsx             # Dashboard
      bookings.tsx          # Booking history
      certifications.tsx    # Earned certifications
      profile.tsx           # Profile settings
```

## Middleware

### Custom Domain Resolution

```typescript
// In server middleware
export function resolveCustomDomain(request: Request) {
  const hostname = new URL(request.url).hostname;

  // Check if it's a custom domain (not *.divestreams.com)
  if (!hostname.endsWith('.divestreams.com')) {
    // Look up organization by custom_domain
    const org = await db.query.organization.findFirst({
      where: eq(organization.customDomain, hostname)
    });
    if (org) {
      // Rewrite to /site routes with org context
      return { organizationId: org.id, isCustomDomain: true };
    }
  }

  return null;
}
```

## Freemium Considerations

- Public site is a **premium feature**
- Free tier: Embed widget only (for external websites)
- Premium tier: Full public site with custom domain

## Security

- Customer auth is separate from staff auth
- Public routes have no staff session access
- Customer can only view their own bookings/data
- Rate limiting on login/registration
- CSRF protection on all forms

## Implementation Priority

1. **Phase 1:** Basic public site (home, about, contact, trips listing)
2. **Phase 2:** Customer accounts and booking flow
3. **Phase 3:** Training courses integration
4. **Phase 4:** Themes and customization
5. **Phase 5:** Custom domains

## Success Metrics

- Tenant adoption rate (% enabling public site)
- Booking conversion (views → bookings)
- Customer account creation rate
- Custom domain usage
