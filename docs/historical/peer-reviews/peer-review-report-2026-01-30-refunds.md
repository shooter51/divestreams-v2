# Unified Peer Review Report
**Date:** 2026-01-30
**Branch:** feature/KAN-654-pos-refunds
**Reviewers:** 5 Independent Peer Reviewers
**Issues Reviewed:** KAN-653, KAN-654, CI/CD Infrastructure

---

## Executive Summary

### Overall Verdict Summary

| Issue | Fix Quality | Completeness | Verdict | Critical Findings |
|-------|-------------|--------------|---------|-------------------|
| **KAN-653** (Stripe Detection) | ⭐⭐⭐⭐ (4/5) | 100% | APPROVED WITH CONDITIONS | Unit test needs updating |
| **KAN-654 Backend** (Refund Logic) | ⭐⭐⭐⭐ (4/5) | 75% | APPROVED WITH CONDITIONS | Missing booking cancellation, no transaction wrapper |
| **KAN-654 Frontend** (Refund UI) | ⭐⭐⭐⭐ (4/5) | 92% | APPROVED WITH CONDITIONS | Missing accessibility attributes |
| **CI/CD Fix** (E2E Seeding) | ⭐⭐⭐⭐ (4/5) | 50% | APPROVED WITH CONDITIONS | deploy.yml also needs seeding |
| **Cross-Cutting** (Architecture) | ⭐⭐⭐⭐ (4/5) | 85% | APPROVED WITH CONDITIONS | Missing input validation, no DB transaction |

### Key Findings

🔴 **CRITICAL ISSUES DISCOVERED (7 DEPLOY BLOCKERS):**

1. **Database Transaction Missing** - Refund processing not atomic
2. **No Input Validation** - Refund actions accept unvalidated JSON
3. **Booking Cancellation Missing** - Trip refunds don't cancel bookings
4. **No Double-Refund Prevention** - Can process duplicate refunds
5. **Missing Accessibility** - Modals lack ARIA attributes
6. **deploy.yml Missing Seed** - CI/CD workflow incomplete
7. **Unit Test Outdated** - stripe-pos.test.ts expects old behavior

**Estimated Fix Time:** ~2.5 hours total

🟡 **MEDIUM PRIORITY:** Stripe rollback, authorization checks, test coverage

🟢 **POSITIVE FINDINGS:** Clean architecture, consistent patterns, type safety

---

## Critical Action Items - MUST FIX BEFORE MERGE

### 1. 🔴 Wrap Refund in Database Transaction
**File:** `lib/db/pos.server.ts:492-572`
**Time:** 30 minutes

**Current Issue:** Operations run separately, not atomic. If crash occurs mid-refund, database left inconsistent.

**Fix:**
```typescript
export async function processPOSRefund(
  tables: TenantTables,
  organizationId: string,
  data: { ... }
) {
  return await db.transaction(async (tx) => {
    // Replace all `db.` with `tx.` in function body
    const [transaction] = await tx
      .select({ transaction: tables.transactions, ... })
      .from(tables.transactions)
      ...
    
    const [refundTransaction] = await tx
      .insert(tables.transactions)
      ...
    
    for (const item of items) {
      if (item.type === "product") {
        await tx.update(tables.products)...
      }
      if (item.type === "rental") {
        await tx.update(tables.equipment)...
        await tx.update(tables.rentals)...
      }
    }
    
    return { refundTransaction, originalTransaction: transaction };
  });
}
```

### 2. 🔴 Add Zod Input Validation
**File:** `app/routes/tenant/pos.tsx:193-251`
**Time:** 20 minutes

**Fix:**
```typescript
import { z } from "zod";

const transactionLookupSchema = z.object({
  transactionId: z.string().uuid("Invalid transaction ID format"),
});

const refundRequestSchema = z.object({
  originalTransactionId: z.string().uuid(),
  paymentMethod: z.enum(["cash", "card", "split"]),
  stripePaymentId: z.string().optional(),
  refundReason: z.string().min(1).max(500),
});

// In lookup-transaction action:
const { transactionId } = transactionLookupSchema.parse({
  transactionId: formData.get("transactionId"),
});

// In process-refund action:
const rawData = JSON.parse(formData.get("data") as string);
const data = refundRequestSchema.parse(rawData);
```

### 3. 🔴 Implement Booking Cancellation
**File:** `lib/db/pos.server.ts:566` (after rental handling)
**Time:** 45 minutes

**Fix:**
```typescript
if (item.type === "booking" && item.tripId) {
  // Find the booking created by this POS transaction
  const [booking] = await tx
    .select()
    .from(tables.bookings)
    .where(
      and(
        eq(tables.bookings.organizationId, organizationId),
        eq(tables.bookings.tripId, item.tripId),
        eq(tables.bookings.customerId, original.customerId),
        eq(tables.bookings.source, "pos"),
        sql`${tables.bookings.createdAt} >= ${original.createdAt} - interval '1 minute'`,
        sql`${tables.bookings.createdAt} <= ${original.createdAt} + interval '1 minute'`
      )
    )
    .limit(1);

  if (booking) {
    await tx
      .update(tables.bookings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(tables.bookings.id, booking.id));
  }
}
```

### 4. 🔴 Add Double-Refund Prevention
**File:** `lib/db/pos.server.ts:511` (after type check)
**Time:** 15 minutes

**Fix:**
```typescript
if (original.type === "refund") {
  throw new Error("Cannot refund a refund transaction");
}

// NEW: Check if transaction already refunded
const [existingRefund] = await db
  .select()
  .from(tables.transactions)
  .where(eq(tables.transactions.refundedTransactionId, data.originalTransactionId))
  .limit(1);

if (existingRefund) {
  throw new Error("Transaction has already been refunded");
}
```

### 5. 🔴 Add Accessibility Attributes
**File:** `app/components/pos/RefundModals.tsx`
**Time:** 30 minutes

**Fix for TransactionLookupModal (line 85-143):**
```typescript
// Add useEffect for Escape key
useEffect(() => {
  if (!isOpen) return;
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") handleClose();
  };
  document.addEventListener("keydown", handleEscape);
  return () => document.removeEventListener("keydown", handleEscape);
}, [isOpen]);

// Update modal div (line 88)
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="lookup-modal-title">
  <div className="absolute inset-0" onClick={handleClose} />
  <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
    <h2 id="lookup-modal-title" className="text-xl font-bold mb-4">Lookup Transaction</h2>
```

**Same fix for RefundConfirmationModal (line 175-287)** - Add useEffect and ARIA attributes.

### 6. 🔴 Fix deploy.yml E2E Seeding
**File:** `.github/workflows/deploy.yml:110`
**Time:** 5 minutes

**Fix:** Add after line 110 (between `db:push` and `Build application`):
```yaml
      - name: Seed subscription plans
        run: npm run db:seed
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/divestreams_test
```

### 7. 🔴 Update Unit Test
**File:** `tests/unit/lib/integrations/stripe-pos.test.ts:164-195`
**Time:** 20 minutes

**Fix:** Mock `getStripeAccountInfo()` instead of relying on cached settings:
```typescript
// Add mock for getStripeAccountInfo
vi.mock("../../../lib/integrations/stripe.server", async () => {
  const actual = await vi.importActual("../../../lib/integrations/stripe.server");
  return {
    ...actual,
    getStripeAccountInfo: vi.fn().mockResolvedValue({
      chargesEnabled: true,
      payoutsEnabled: true,
    }),
  };
});

// Update test assertions to expect fresh data fetch
```

---

## Testing After Fixes

**Before Merging to Staging:**
1. ✅ Run `npm run typecheck` - must pass
2. ✅ Run `npm test` - all tests pass including updated stripe-pos.test.ts
3. ✅ Test refund flow manually:
   - Create sale with product, equipment rental, and trip booking
   - Process refund
   - Verify: inventory restored, equipment available, booking cancelled
   - Attempt second refund → should fail with "already refunded" error
4. ✅ Test accessibility:
   - Press Escape to close modals
   - Navigate with Tab key only
   - Test with screen reader (VoiceOver on Mac)

---

## Conclusion

**Status:** APPROVED WITH CONDITIONS

All 7 critical blockers must be fixed before merging to staging. The implementation is architecturally sound and addresses real business needs, but the identified issues pose data integrity, security, and accessibility risks.

After fixing blockers (~2.5 hours), the feature will be production-ready pending QA approval.

---

*Generated by superpowers:peer-review-and-fix v4.0.3*
