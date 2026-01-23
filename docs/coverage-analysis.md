# Code Coverage Analysis - Critical Gaps Report

**Generated:** 2026-01-22
**Overall Coverage:** 28.59% statements | 21.58% branches | 20.18% functions | 29.04% lines

## Executive Summary

This analysis identifies the top 10 most critical files/modules with low coverage that are core to DiveStreams business logic. The focus is on production code in `lib/db/`, `lib/auth/`, `app/routes/`, and `lib/services/` that handles multi-tenant data access, authentication, and core business workflows.

**Key Findings:**
- Critical database query functions have only 32-34% coverage
- Authentication context helpers have 51-62% coverage with many edge cases untested
- Admin routes have 19-39% coverage with most UI routes completely untested
- Integration routes (Google, Mailchimp, QuickBooks, Xero) have 0% coverage
- POS system has 0-34% coverage across multiple modules

---

## Priority 1: CRITICAL - Core Business Logic (0-35% coverage)

### 1. `lib/db/queries.server.ts` - Database Query Layer
**Current Coverage:** 32.55% statements | 34.9% functions
**Business Criticality:** HIGH
**Uncovered:** 290 statements, 69 functions

**Description:** Core tenant database query layer. Handles all multi-tenant data access for bookings, customers, tours, trips, equipment, and dashboard statistics.

**Critical Uncovered Functions:**
- `getBookings()` - Main booking retrieval with filters
- `getBookingById()` - Single booking details
- `getTours()` - Tour catalog with pagination
- `getTourById()` - Single tour details with trips
- `getCustomers()` - Customer list with search
- `getCustomerById()` - Customer profile with bookings
- `getTrips()` - Trip scheduling queries
- `getTripById()` - Trip details with participants
- `getEquipment()` - Equipment inventory
- `getEquipmentById()` - Equipment rental details
- `getDiveSites()` - Dive site catalog
- `getTeamMembers()` - Team member access
- `getRecentActivity()` - Dashboard activity feed

**Common Patterns Missing:**
- Error handling for database failures
- Edge cases for empty results
- Filter validation (date ranges, status values)
- Pagination boundary conditions
- Multi-tenant isolation verification
- JOIN query correctness

**Test Priority:** IMMEDIATE - This is the data access layer for all tenant operations.

---

### 2. `lib/auth/org-context.server.ts` - Multi-Tenant Authentication
**Current Coverage:** 51.47% statements | 62.5% functions
**Business Criticality:** HIGH
**Uncovered:** 33 statements, 3 functions

**Description:** Handles organization context resolution, freemium limits enforcement, subdomain routing, and permission checks.

**Critical Uncovered Functions:**
- `requireRole()` - Permission enforcement (untested)
- `requirePremium()` - Premium feature gating (untested)
- `checkLimit()` - Freemium limit enforcement (untested)

**Critical Uncovered Branches:**
- Staging subdomain resolution (`admin.staging.divestreams.com`, `{tenant}.staging.divestreams.com`)
- Edge cases in `getSubdomainFromRequest()` for unusual domain formats
- Freemium limit calculations when exactly at limit
- Premium subscription status edge cases
- Error handling when subscription plan not found in database

**Common Patterns Missing:**
- Invalid subdomain handling
- Subscription expiration edge cases
- Usage limit boundary conditions (exactly at limit, over limit)
- Team member role permission matrix
- Database query failure handling

**Test Priority:** IMMEDIATE - Controls all tenant access and security.

---

### 3. `lib/db/pos.server.ts` - Point of Sale Queries
**Current Coverage:** 33.82% statements | 50% functions
**Business Criticality:** HIGH
**Uncovered:** 45 statements, 9 functions

**Description:** POS system database queries for products, inventory, and transactions.

**Critical Uncovered Functions:**
- `getPOSCategories()` - Product category list
- `getPOSProduct()` - Single product details
- `createTransaction()` - Complete POS transaction processing
- `getTransactions()` - Transaction history
- `getTransactionById()` - Single transaction details
- `updateProductStock()` - Inventory management
- `getDailySales()` - Sales reporting
- `getInventoryStatus()` - Stock level tracking

**Common Patterns Missing:**
- Stock validation before purchase
- Transaction rollback on payment failure
- Inventory decrement atomicity
- Sale price date range validation
- Out-of-stock handling
- Discount calculation validation

**Test Priority:** HIGH - Handles financial transactions and inventory.

---

### 4. `app/routes/tenant/reports.tsx` - Business Reports
**Current Coverage:** 0% statements | 0% functions
**Business Criticality:** HIGH
**Uncovered:** 347 statements, 39 functions

**Description:** Business intelligence and reporting dashboard. Generates revenue reports, booking analytics, customer insights.

**Critical Uncovered Functions:**
- Revenue reporting (daily/weekly/monthly/yearly)
- Booking analytics (conversion rates, popular tours)
- Customer analytics (retention, lifetime value)
- Equipment utilization reports
- Staff performance metrics
- Export functionality (CSV, PDF)

**Common Patterns Missing:**
- Date range validation
- Report generation performance
- Large dataset handling
- Currency formatting
- Timezone handling
- Empty data handling

**Test Priority:** HIGH - Critical for business decisions.

---

### 5. `app/routes/tenant/settings/` - Settings Management
**Current Coverage:** 27.75% statements | 8.06% functions
**Business Criticality:** HIGH
**Uncovered:** 630 statements, 171 functions

**Critical Files:**
- `billing.tsx` (0%) - Stripe subscription management
- `integrations.tsx` (0%) - Third-party integrations (Google, QuickBooks, Xero, Mailchimp)
- `notifications.tsx` (0%) - Email notification settings
- `profile.tsx` (0%) - Organization profile updates
- `team.tsx` (0%) - Team member management
- `booking-widget.tsx` (0%) - Public booking widget configuration

**Critical Uncovered Functions:**
- Stripe subscription creation/cancellation
- Payment method updates
- Integration OAuth flows
- Webhook handling
- Team member invitation system
- Role-based permission updates

**Common Patterns Missing:**
- Payment processing error handling
- OAuth state validation
- Webhook signature verification
- Email sending validation
- Concurrent team member updates
- Integration rate limiting

**Test Priority:** HIGH - Controls billing and integrations.

---

## Priority 2: MEDIUM - Route Handlers (0-40% coverage)

### 6. `app/routes/tenant/products.tsx` - Product Management
**Current Coverage:** 0% statements | 0% functions
**Business Criticality:** MEDIUM
**Uncovered:** 280 statements, 50 functions

**Description:** Product catalog management for POS system.

**Critical Uncovered Functions:**
- `loader()` - Product list with categories
- `action()` - Create/update/delete products
- Product form validation
- Image upload handling
- Bulk product import
- Inventory tracking integration

**Common Patterns Missing:**
- Form validation edge cases
- Image upload size/format validation
- Duplicate product detection
- Bulk operation error handling
- Concurrent update conflicts

**Test Priority:** MEDIUM - Core to POS functionality.

---

### 7. `app/routes/tenant/trips.tsx` - Trip Scheduling
**Current Coverage:** 11.98% statements | 8% functions
**Business Criticality:** MEDIUM
**Uncovered:** 257 statements, 69 functions

**Description:** Trip scheduling and participant management.

**Critical Uncovered Functions:**
- Trip creation with tour template
- Participant assignment
- Capacity validation
- Weather integration
- Trip cancellation workflow
- Participant notification

**Common Patterns Missing:**
- Over-capacity booking prevention
- Double-booking prevention
- Cancellation policy enforcement
- Weather-based recommendations
- Participant notification failures

**Test Priority:** MEDIUM - Core booking workflow.

---

### 8. `app/routes/admin/` - Admin Platform
**Current Coverage:** 39.27% statements | 19.14% functions
**Business Criticality:** MEDIUM
**Uncovered:** 201 statements, 38 functions

**Critical Files:**
- `tenants.$id.tsx` (0%) - Tenant management
- `plans.$id.tsx` (0%) - Subscription plan editing
- `layout.tsx` (0%) - Admin navigation
- `logout.tsx` (0%) - Admin logout

**Critical Uncovered Functions:**
- Tenant creation/suspension
- Subscription plan CRUD
- Admin authentication
- Platform-wide analytics
- Tenant impersonation

**Common Patterns Missing:**
- Super admin permission checks
- Tenant data isolation verification
- Subscription change validation
- Platform metrics accuracy

**Test Priority:** MEDIUM - Platform administration.

---

## Priority 3: LOW - Integrations & UI (0% coverage)

### 9. `app/routes/api/integrations/` - External Integrations
**Current Coverage:** 0% statements | 0% functions
**Business Criticality:** LOW-MEDIUM
**Uncovered:** 118 statements, 12 functions

**Files:**
- `google/callback.tsx` (0%) - Google Calendar OAuth
- `quickbooks/callback.tsx` (0%) - QuickBooks accounting
- `xero/callback.tsx` (0%) - Xero accounting
- `mailchimp/callback.tsx` (0%) - Email marketing

**Critical Uncovered Functions:**
- OAuth callback handling
- Token exchange and refresh
- Integration data sync
- Error handling and retries

**Common Patterns Missing:**
- OAuth state validation
- Token expiration handling
- API rate limiting
- Sync conflict resolution
- Integration disconnection

**Test Priority:** LOW-MEDIUM - Important but non-blocking.

---

### 10. `app/routes/tenant/bookings.tsx` - Booking Management
**Current Coverage:** 39.77% statements | 32.5% functions
**Business Criticality:** MEDIUM
**Uncovered:** 106 statements, 27 functions

**Description:** Booking creation, modification, and cancellation workflows.

**Critical Uncovered Functions:**
- Booking modification workflow
- Partial refund calculations
- Customer notification system
- Waiver signature capture
- Group booking handling
- Waitlist management

**Common Patterns Missing:**
- Booking conflict detection
- Payment processing errors
- Notification delivery failures
- Waiver validation
- Group booking capacity

**Test Priority:** MEDIUM - Core revenue workflow.

---

## Common Patterns in Uncovered Code

### 1. Error Handling (Systematic Gap)
- Database query failures
- External API failures (Stripe, integrations)
- Network timeouts
- Invalid input data
- Concurrent modification conflicts

### 2. Validators (Input Validation)
- Form input sanitization
- Date range validation
- Email format validation
- Phone number formatting
- Price/currency validation
- Capacity limits

### 3. Edge Cases (Boundary Conditions)
- Empty result sets
- Exactly at limit (freemium)
- Over limit by 1
- Null/undefined handling
- Timezone boundary cases
- Leap year/DST handling

### 4. Business Logic (Domain Rules)
- Freemium limit enforcement
- Permission checks (role-based)
- Booking capacity validation
- Inventory stock validation
- Refund policy enforcement
- Cancellation rules

### 5. Security (Authentication & Authorization)
- Multi-tenant isolation
- Role-based access control
- Premium feature gating
- OAuth state validation
- Webhook signature verification
- Session management

---

## Recommended Testing Strategy

### Phase 1: Critical Business Logic (Weeks 1-2)
1. **Database Queries** (`lib/db/queries.server.ts`)
   - Unit tests for all query functions
   - Integration tests with test database
   - Multi-tenant isolation tests

2. **Authentication Context** (`lib/auth/org-context.server.ts`)
   - Subdomain resolution edge cases
   - Freemium limit enforcement
   - Permission check validation

3. **POS System** (`lib/db/pos.server.ts`)
   - Transaction processing
   - Inventory management
   - Stock validation

### Phase 2: Revenue-Critical Routes (Weeks 3-4)
4. **Bookings** (`app/routes/tenant/bookings.tsx`)
5. **Products** (`app/routes/tenant/products.tsx`)
6. **Settings/Billing** (`app/routes/tenant/settings/billing.tsx`)

### Phase 3: Admin & Reports (Weeks 5-6)
7. **Admin Platform** (`app/routes/admin/`)
8. **Reports** (`app/routes/tenant/reports.tsx`)

### Phase 4: Integrations (Weeks 7-8)
9. **External Integrations** (`app/routes/api/integrations/`)
10. **Booking Widget** (`app/routes/tenant/settings/booking-widget.tsx`)

---

## Success Metrics

**Target Coverage Goals:**
- Critical business logic (Priority 1): 80%+ coverage
- Route handlers (Priority 2): 70%+ coverage
- Integrations & UI (Priority 3): 50%+ coverage
- Overall project: 60%+ coverage

**Quality Indicators:**
- All error handlers tested
- All validators have edge case tests
- All freemium limits enforced
- All permission checks verified
- All payment flows tested

---

## Tools & Techniques

**Unit Testing:**
- Vitest for all `lib/` modules
- Mock database with test fixtures
- Isolated function testing

**Integration Testing:**
- Test database with Drizzle migrations
- Mock external APIs (Stripe, integrations)
- End-to-end workflow testing

**E2E Testing:**
- Playwright for critical user flows
- Multi-tenant isolation verification
- Payment processing (test mode)

**Test Data:**
- Factory functions for models
- Reusable test fixtures
- Seed data generators

---

## Next Steps

1. **Create test utilities** (`tests/utils/`)
   - Database factory functions
   - Mock auth context helpers
   - Test organization fixtures

2. **Implement Priority 1 tests**
   - Start with `lib/db/queries.server.ts`
   - Add `lib/auth/org-context.server.ts`
   - Complete `lib/db/pos.server.ts`

3. **Track progress**
   - Update this document weekly
   - Run coverage reports after each PR
   - Block PRs that decrease coverage

4. **Integrate into CI/CD**
   - Enforce minimum coverage thresholds
   - Generate coverage badges
   - Alert on coverage drops
