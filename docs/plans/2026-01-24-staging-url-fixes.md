# Staging URL Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all hardcoded production URLs that break staging environment links.

**Architecture:** Use environment-aware URL utilities (`getTenantUrl`, `getBaseDomain`, `getAppUrl`) instead of hardcoded domains.

**Tech Stack:** React Router, TypeScript, Environment variables

---

## Overview

Multiple files hardcode `divestreams.com` instead of using environment-aware URL utilities. This causes links on staging (`admin.staging.divestreams.com`) to incorrectly point to production.

## Root Cause

The `getTenantUrl()` function in `lib/utils/url.ts` correctly handles staging detection, but some components bypass it with hardcoded domains.

Additionally, the staging VPS may have `APP_URL` set incorrectly to production instead of staging.

---

## Files With Hardcoded URLs

| File | Line | Issue |
|------|------|-------|
| `app/routes/tenant/settings/public-site.appearance.tsx` | 352 | `https://${orgSlug}.divestreams.com` |
| `app/routes/tenant/layout.tsx` | 76 | `{tenant.subdomain}.divestreams.com` |
| `app/routes/tenant/settings/booking-widget.tsx` | 51 | `process.env.APP_URL \|\| "https://divestreams.com"` |

---

## Implementation Tasks

### Task 1: Fix Public Site Appearance URL

**Files:**
- Modify: `app/routes/tenant/settings/public-site.appearance.tsx`

**Step 1:** Import URL utility
```typescript
import { getTenantUrl } from "~/lib/utils/url";
```

**Step 2:** Replace hardcoded URL (Line 352)

**Current:**
```tsx
href={`https://${orgSlug}.divestreams.com`}
```

**Fix:**
```tsx
href={getTenantUrl(orgSlug)}
```

### Task 2: Fix Tenant Layout Sidebar

**Files:**
- Modify: `app/routes/tenant/layout.tsx`

**Step 1:** Import URL utility
```typescript
import { getBaseDomain } from "~/lib/utils/url";
```

**Step 2:** Replace hardcoded domain (Line 76)

**Current:**
```tsx
<p className="text-sm text-gray-500">{tenant.subdomain}.divestreams.com</p>
```

**Fix:**
```tsx
<p className="text-sm text-gray-500">{tenant.subdomain}.{getBaseDomain()}</p>
```

### Task 3: Fix Booking Widget Settings

**Files:**
- Modify: `app/routes/tenant/settings/booking-widget.tsx`

**Step 1:** Import URL utility
```typescript
import { getAppUrl } from "~/lib/utils/url";
```

**Step 2:** Replace direct env access (Line 51)

**Current:**
```typescript
const baseUrl = process.env.APP_URL || "https://divestreams.com";
```

**Fix:**
```typescript
const baseUrl = getAppUrl();
```

### Task 4: Verify Staging VPS Environment

**Check:** SSH into staging VPS (76.13.28.28) and verify APP_URL

```bash
# Check current environment
docker exec divestreams-app env | grep APP_URL
```

**Expected:** `APP_URL=https://staging.divestreams.com`

**If wrong:** Update `/docker/divestreams-staging/.env`:
```
APP_URL=https://staging.divestreams.com
```

### Task 5: Run Typecheck

```bash
npm run typecheck
```

### Task 6: Test in Staging

1. Deploy changes to staging
2. Go to admin.staging.divestreams.com
3. Verify tenant links go to `*.staging.divestreams.com`
4. Check sidebar displays correct domain
5. Check booking widget preview URL

---

## URL Utility Reference

**File:** `lib/utils/url.ts`

```typescript
// Get tenant-specific URL (handles staging automatically)
getTenantUrl(subdomain: string, path?: string): string

// Get base domain (divestreams.com or staging.divestreams.com)
getBaseDomain(): string

// Get app URL from environment
getAppUrl(): string

// Check if running in staging
isStaging(): boolean
```
