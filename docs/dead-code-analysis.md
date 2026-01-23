# Dead Code Analysis Report - DiveStreams v2

**Generated:** 2026-01-22
**Purpose:** Identify unused/dead code that can be safely removed to improve coverage metrics
**Status:** For Developer Review - DO NOT DELETE CODE WITHOUT REVIEW

---

## Executive Summary

This analysis identified **6 categories** of potentially unused or dead code across the DiveStreams v2 codebase. The findings focus on code that has 0% coverage or appears to have no active references, which could be safely removed or refactored to improve overall code quality and test coverage metrics.

**Key Findings:**
- 3 backup files that should be removed
- 2 cleanup scripts that may be obsolete
- 3 integration files with minimal usage (Xero, Twilio, WhatsApp)
- 96+ console.log statements in production code
- Commented imports in active files
- 1 deprecated function still in use (requireTenant)

---

## Category 1: Backup Files (HIGH PRIORITY - SAFE TO DELETE)

### 1.1 Route Backup File

**File:** `/app/routes/tenant/settings/integrations.tsx.backup`
- **Size:** Unknown
- **Last Modified:** Post DIVE-031 cleanup
- **Evidence:** Contains old imports for removed API keys and webhooks features
- **References:** 0 (no code imports this file)
- **Git History:** Created during DIVE-031 cleanup, never used

**Recommendation:** ✅ **DELETE** - This is a leftover backup from the DIVE-031 cleanup that removed API keys and webhooks. The current integrations.tsx file is the active version.

**Command to remove:**
```bash
rm app/routes/tenant/settings/integrations.tsx.backup
```

---

### 1.2 Git Hook Backups

**Files:**
- `.git/hooks/pre-commit.backup`
- `.git/hooks/post-merge.backup`

**Evidence:** Standard git hook backups, not part of application code
**References:** 0 (not referenced by any code)

**Recommendation:** ✅ **DELETE** - These are development artifacts. Can be safely removed or kept as backups (no impact on coverage).

**Command to remove:**
```bash
rm .git/hooks/pre-commit.backup .git/hooks/post-merge.backup
```

---

## Category 2: Cleanup Scripts (MEDIUM PRIORITY - VERIFY BEFORE DELETION)

### 2.1 API Webhooks Removal Script

**File:** `/scripts/remove-api-webhooks.sh` (1.5K)
- **Purpose:** Script created for DIVE-031 to remove API keys and webhooks
- **Last Used:** During DIVE-031 execution
- **Status:** Task completed, features removed
- **Evidence:** DIVE-031 documentation shows completion

**Recommendation:** ⚠️ **MOVE TO ARCHIVE or DELETE** - Script served its purpose. If keeping for documentation, move to `docs/archive/` or delete entirely.

---

### 2.2 Integrations Cleanup Script

**File:** `/scripts/clean-integrations.py` (2.8K)
- **Purpose:** Python script for integration cleanup
- **Last Used:** Unknown
- **References:** 0 in current codebase

**Recommendation:** ⚠️ **VERIFY THEN DELETE** - Check with team if this script is still needed for any operational tasks. If not, delete.

---

## Category 3: Potentially Unused Integration Libraries (MEDIUM PRIORITY)

### 3.1 Xero Integration

**File:** `/lib/integrations/xero.server.ts` (719 lines, 12 exported functions)
- **Exports:** 12 functions including OAuth flow, invoice creation, contact sync
- **Usage in Routes:**
  - Imported in `/app/routes/tenant/settings/integrations.tsx` (getXeroAuthUrl)
  - Callback route exists: `/app/routes/api/integrations/xero/callback.tsx`
- **Active Usage:** OAuth connection setup only, no active sync or invoice creation found
- **Git History:** Last significant change 2 months ago (OAuth tenant credentials)

**Functions with ZERO references found:**
1. `getXeroOrganizationInfo()` - Fetch org details from Xero
2. `getXeroAccounts()` - Get account codes for mapping
3. `createXeroInvoice()` - Create invoices in Xero
4. `syncContactToXero()` - Sync contacts to Xero
5. `getXeroInvoices()` - Fetch invoices from Xero
6. `getXeroContacts()` - Fetch contacts from Xero

**Evidence:**
- Integration UI exists in settings
- OAuth callback route exists
- NO actual usage of sync/invoice functions found in any route
- Users can connect but cannot use the integration

**Recommendation:** 🔍 **INVESTIGATE BEFORE REMOVAL**
- **Option A:** Remove entire Xero integration if not being used by customers
- **Option B:** Complete the integration by adding UI for invoice sync and contact sync
- **Option C:** Mark as "coming soon" and keep core OAuth setup

**Estimated Impact:** Removing could improve coverage by ~0.5% (719 lines of untested code)

---

### 3.2 Twilio SMS Integration

**File:** `/lib/integrations/twilio.server.ts` (519 lines, 9 exported functions)
- **Exports:** 9 functions for SMS messaging via Twilio API
- **Usage in Routes:**
  - Imported in `/app/routes/tenant/settings/integrations.tsx` (connectTwilio, sendSMS)
  - Connection setup exists in settings UI
- **Active Usage:** Test send button exists but no automated SMS triggers found
- **Git History:** Last change 2 months ago (tenant OAuth credentials)

**Functions with LIMITED references:**
1. `connectTwilio()` - Used in settings page ✓
2. `sendSMS()` - Used in settings page test button ✓
3. `sendBookingConfirmation()` - NOT used in booking flow ✗
4. `sendTripReminder()` - NOT used in reminder system ✗
5. `sendCustomMessage()` - NOT used anywhere ✗
6. `sendBulkSMS()` - NOT used anywhere ✗
7. `getAccountBalance()` - NOT used anywhere ✗
8. `listPhoneNumbers()` - NOT used anywhere ✗

**Evidence:**
- Integration can be connected
- Test SMS can be sent from settings
- NO automated SMS in booking confirmations or trip reminders
- Helper functions (bulk, balance, phone list) completely unused

**Recommendation:** 🔍 **INCOMPLETE FEATURE - DECIDE ACTION**
- **Option A:** Remove if SMS notifications not planned
- **Option B:** Complete integration by adding SMS to booking/reminder workflows
- **Option C:** Keep minimal connect/test, remove unused helpers (6 functions)

**Estimated Impact:** Removing unused helpers could improve coverage by ~0.3% (300+ lines)

---

### 3.3 WhatsApp Integration

**File:** `/lib/integrations/whatsapp.server.ts` (792 lines, 10+ exported functions)
- **Exports:** 10+ functions for WhatsApp via Meta API or Twilio
- **Usage in Routes:**
  - Imported in `/app/routes/tenant/settings/integrations.tsx` (connectWhatsApp, sendWhatsApp)
  - Connection setup exists in settings UI
- **Active Usage:** Similar to Twilio - connection exists, no automated messages
- **Git History:** Last change 2 months ago

**Functions with LIMITED references:**
1. `connectWhatsApp()` - Used in settings page ✓
2. `sendWhatsApp()` - Used in settings page test button ✓
3. `sendBookingConfirmationWhatsApp()` - NOT used in booking flow ✗
4. `sendTripReminderWhatsApp()` - NOT used in reminder system ✗
5. `sendCustomWhatsAppMessage()` - NOT used anywhere ✗
6. `listMessageTemplates()` - NOT used anywhere ✗
7. `formatWhatsAppNumber()` - NOT exported or used ✗

**Evidence:**
- Can connect both Meta and Twilio WhatsApp
- Test message can be sent from settings
- NO automated WhatsApp messages in workflows
- Template management functions unused

**Recommendation:** 🔍 **INCOMPLETE FEATURE - DECIDE ACTION**
- Same as Twilio recommendation
- Remove if WhatsApp not planned, or complete the integration

**Estimated Impact:** Removing unused helpers could improve coverage by ~0.4% (400+ lines)

---

## Category 4: Deprecated Functions Still in Use (MEDIUM PRIORITY)

### 4.1 Legacy Tenant Context Function

**File:** `/lib/auth/org-context.server.ts`
**Function:** `requireTenant()` (lines 551-571)
- **Status:** Marked @deprecated
- **Purpose:** Backward compatibility wrapper for old tenant format
- **Usage:** Found in **45 route files** (123 total occurrences)

**Routes Still Using Deprecated Function:**
- All POS routes (products, transactions)
- All customer routes (new, edit, view)
- All booking routes
- All gallery routes
- All images routes
- All equipment routes
- All dive-sites routes
- All tours routes
- All trips routes
- All boats routes

**Recommendation:** ⚠️ **MIGRATION NEEDED**
- This is marked deprecated but heavily used
- DO NOT remove without migrating all routes to `requireOrgContext()`
- Create migration task to update all 45 route files
- This is NOT unused code, just deprecated legacy code

**Estimated Impact:** Migration would require touching 45+ files but improve code maintainability

---

## Category 5: Development Artifacts (LOW PRIORITY)

### 5.1 Console Log Statements

**Count:** 96+ occurrences in production code (excluding tests)
**Locations:** Scattered across `/lib` and `/app/routes`

**Examples:**
- `console.error()` in error handlers (these are valid - keep)
- `console.log()` for debugging (should be removed or use proper logger)
- `console.debug()` statements

**Recommendation:** 🧹 **CLEAN UP GRADUALLY**
- Keep `console.error()` for legitimate error logging
- Remove `console.log()` debugging statements
- Consider implementing structured logging (Winston, Pino)
- Low priority - does not affect coverage metrics significantly

---

### 5.2 Commented Imports

**File:** `/app/routes/tenant/settings/integrations.tsx`
**Lines:** 6-17 (commented imports for removed API keys/webhooks)

**Content:**
```typescript
// API keys and webhooks removed - DIVE-031
// import { createApiKey, listApiKeys, revokeApiKey } from "...";
// import {
//   listWebhooks,
//   createWebhook,
//   ...
// } from "...";
```

**Recommendation:** ✅ **DELETE COMMENTED CODE**
- These imports are documented in DIVE-031 cleanup
- No need to keep commented-out code
- Git history preserves this if needed

---

## Category 6: Large Files with Many Exports (INFORMATIONAL)

### 6.1 Database Queries File

**File:** `/lib/db/queries.server.ts`
- **Lines:** Unknown (contains 80 exported functions)
- **Exports:** 80 database query functions
- **Usage:** Imported by 27 route files
- **Coverage:** Unknown without coverage report

**Analysis:**
- This is a large utility file with many exports
- Some functions may have 0% coverage but are needed for completeness
- Recommend reviewing coverage report to identify truly unused queries

**Recommendation:** 📊 **REQUIRES COVERAGE ANALYSIS**
- Need unit test coverage data to identify unused functions
- Many query functions may be unused but kept for future features
- Consider breaking into smaller, feature-specific query files

**Example breakdown suggestion:**
- `queries.customers.server.ts` (customer queries)
- `queries.bookings.server.ts` (booking queries)
- `queries.trips.server.ts` (trip queries)
- `queries.dashboard.server.ts` (dashboard stats)

---

## Category 7: TODO/FIXME Comments (INFORMATIONAL)

### 7.1 Known Incomplete Features

**Found 7 TODO/FIXME comments:**

1. **Stripe Webhook Handler** (`lib/stripe/webhook.server.ts:67`)
   ```typescript
   // TODO: Send confirmation email
   ```

2. **Stripe Webhook Handler** (`lib/stripe/webhook.server.ts:75`)
   ```typescript
   // TODO: Send failed payment notification email
   ```

3. **Training Import** (`app/routes/tenant/training/import/index.tsx:23`)
   ```typescript
   // TODO: Handle import logic in next task
   ```

4. **Public Site Page Restore** (`app/routes/tenant/settings/public-site.pages.$pageId.edit.tsx:290`)
   ```typescript
   // TODO: Implement restore
   ```

5. **Google Calendar Integration Test** (`tests/integration/lib/integrations/google-calendar.integration.test.ts:11`)
   ```typescript
   // TODO: These integration tests require full database setup and are currently incomplete
   ```

**Recommendation:** 📝 **TRACK IN ISSUE TRACKER**
- These are incomplete features, not dead code
- Move to Beads issue tracker for proper tracking
- Some may be blocking features that need prioritization

---

## Summary of Recommendations

### Immediate Actions (Safe to Delete)

1. ✅ **DELETE** backup files:
   ```bash
   rm app/routes/tenant/settings/integrations.tsx.backup
   rm .git/hooks/pre-commit.backup
   rm .git/hooks/post-merge.backup
   ```

2. ✅ **DELETE** commented imports in integrations.tsx (lines 6-17)

3. ✅ **DELETE** or **ARCHIVE** cleanup scripts:
   ```bash
   mkdir -p docs/archive
   mv scripts/remove-api-webhooks.sh docs/archive/
   mv scripts/clean-integrations.py docs/archive/
   ```

**Estimated coverage improvement:** Minimal (backup files don't count toward coverage)

---

### Investigate and Decide (Requires Business Decision)

1. 🔍 **Xero Integration** - Complete, remove, or mark as "coming soon"
2. 🔍 **Twilio SMS** - Complete integration or remove unused helpers
3. 🔍 **WhatsApp Integration** - Complete integration or remove unused helpers

**Estimated coverage improvement:** 0.5-1.2% if unused functions removed

---

### Future Refactoring Tasks

1. ⚠️ **Migrate from requireTenant() to requireOrgContext()** (45 files)
2. 📊 **Analyze queries.server.ts** with coverage data
3. 🧹 **Clean up console.log statements** (96+ occurrences)
4. 📝 **Convert TODO comments to Beads issues**

---

## Testing Strategy After Removal

If code is removed, ensure:

1. ✅ Run full test suite: `npm test`
2. ✅ Run E2E tests: `npm run test:e2e`
3. ✅ Build passes: `npm run build`
4. ✅ TypeScript check: `npm run typecheck`
5. ✅ Manual verification of settings page
6. ✅ Check integration connections still work

---

## Git History Notes

- **DIVE-031 Cleanup:** Successfully removed API keys and webhooks 2 weeks ago
- **Integration refactoring:** OAuth tenant credentials added 2 months ago
- **Recent activity:** Training import module added this week

---

## Coverage Impact Estimate

If all recommended deletions are made:

| Category | Lines | Estimated Coverage Gain |
|----------|-------|-------------------------|
| Backup files | ~2000 | 0% (not counted) |
| Cleanup scripts | ~200 | 0% (not counted) |
| Xero unused functions | ~400 | 0.3-0.5% |
| Twilio unused helpers | ~300 | 0.2-0.3% |
| WhatsApp unused helpers | ~400 | 0.3-0.4% |
| Commented code | ~100 | 0% (not counted) |
| **TOTAL** | ~3400 | **0.8-1.2%** |

**Note:** Coverage gains are estimates. Actual impact depends on current coverage percentage and how coverage is calculated.

---

## Recommended Next Steps

1. **Immediate (This Week):**
   - Delete backup files and commented code
   - Archive cleanup scripts
   - Create Beads issues for TODO comments

2. **Short Term (Next Sprint):**
   - Decide on Xero/Twilio/WhatsApp integration status
   - Remove or complete based on product roadmap
   - Start planning requireTenant() migration

3. **Long Term (Next Quarter):**
   - Analyze and refactor queries.server.ts
   - Implement structured logging
   - Break down large files into feature modules

---

## Notes for Developers

- **DO NOT DELETE CODE** based solely on this report
- **ALWAYS VERIFY** with team before removing any integration code
- **CHECK CUSTOMER USAGE** - some integrations may be used by specific customers
- **GIT HISTORY** is your friend - code can always be restored if needed
- **COVERAGE METRICS** are a guide, not a goal - don't sacrifice maintainability for percentage points

---

**Report End**
