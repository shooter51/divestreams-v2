# KAN-633 Follow-Up: Public Booking Equipment Rental Fix Required

**Status:** 🚨 CRITICAL ISSUE FOUND
**Priority:** HIGH
**Impact:** Public site booking flow has identical bug to KAN-633

---

## Issue Summary

While reviewing KAN-633 (POS rentals/trips cart fix), **Peer Reviewer #3 discovered an identical bug pattern** in the public site booking flow that was not addressed by the original fix.

---

## The Pattern That Was Fixed in KAN-633

### POS Flow (✅ FIXED)
**File:** `lib/db/pos.server.ts:87-99`
```typescript
export async function getPOSEquipment(tables: TenantTables, organizationId: string) {
  return db
    .select()
    .from(tables.equipment)
    .where(
      and(
        eq(tables.equipment.organizationId, organizationId),
        eq(tables.equipment.isRentable, true),
        eq(tables.equipment.status, "available"),
        sql`${tables.equipment.rentalPrice} IS NOT NULL AND ${tables.equipment.rentalPrice} > 0`
        // ✅ This line was added in KAN-633 fix
      )
    )
    .orderBy(tables.equipment.category, tables.equipment.name);
}
```

---

## The Same Pattern That Still Needs Fixing

### Public Booking Flow (❌ NOT FIXED)
**File:** `app/routes/site/book/$type.$id.tsx:223-248`
```typescript
// ❌ SAME VULNERABLE PATTERN
const rentableEquipment = await db
  .select({
    id: equipment.id,
    name: equipment.name,
    category: equipment.category,
    rentalPrice: equipment.rentalPrice,
  })
  .from(equipment)
  .where(
    and(
      eq(equipment.organizationId, org.id),
      eq(equipment.isRentable, true),          // ❌ Missing price validation
      eq(equipment.status, "available"),
      eq(equipment.isPublic, true)
    )
  )
  .orderBy(equipment.category, equipment.name);

// ❌ FRONTEND HIDING THE PROBLEM (same as original KAN-633 bug)
const equipmentList: RentalEquipment[] = rentableEquipment
  .filter((e) => e.rentalPrice)  // Frontend compensating for bad backend query
  .map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    rentalPrice: e.rentalPrice!,
  }));
```

---

## Required Fix

### Apply Same Solution as KAN-633
**File:** `app/routes/site/book/$type.$id.tsx:223-239`

```typescript
const rentableEquipment = await db
  .select({
    id: equipment.id,
    name: equipment.name,
    category: equipment.category,
    rentalPrice: equipment.rentalPrice,
  })
  .from(equipment)
  .where(
    and(
      eq(equipment.organizationId, org.id),
      eq(equipment.isRentable, true),
      eq(equipment.status, "available"),
      eq(equipment.isPublic, true),
      sql`${equipment.rentalPrice} IS NOT NULL AND ${equipment.rentalPrice} > 0`  // ✅ Add this
    )
  )
  .orderBy(equipment.category, equipment.name);

// ✅ OPTIONAL: Remove frontend filter since backend now guarantees valid prices
const equipmentList: RentalEquipment[] = rentableEquipment.map((e) => ({
  id: e.id,
  name: e.name,
  category: e.category,
  rentalPrice: e.rentalPrice,  // Now guaranteed to be valid by backend
}));
```

---

## Why This Matters

### Schema Reality
```typescript
// lib/db/schema.ts:444-445
rentalPrice: decimal("rental_price", { precision: 10, scale: 2 }),  // NULLABLE
isRentable: boolean("is_rentable").default(true),
```

**Problem:** Equipment can be marked `isRentable = true` with `rentalPrice = NULL` or `0`.

### Current Behavior
1. Backend query returns equipment with NULL/0 prices
2. Frontend filters them out with `.filter((e) => e.rentalPrice)`
3. User sees fewer rental options than expected
4. Data integrity issue: backend returns invalid data

### After Fix
1. Backend query only returns equipment with valid prices
2. Frontend can trust backend data
3. Cleaner architecture (validation at query level, not UI level)
4. Consistent with KAN-633 fix in POS flow

---

## Testing Requirements

### E2E Test Needed
```typescript
// tests/e2e/public/booking-equipment-rentals.spec.ts
test("should show equipment rentals with valid prices", async () => {
  // 1. Navigate to public booking page
  // 2. Verify rental equipment options appear
  // 3. Verify all shown equipment has prices > 0
  // 4. Add equipment to booking
  // 5. Verify price calculation is correct
});

test("should not show equipment with NULL rental price", async () => {
  // 1. Create equipment with rentalPrice = NULL
  // 2. Navigate to public booking page
  // 3. Verify that equipment does NOT appear in rental options
});
```

---

## Related Issues

- **KAN-633** (✅ Fixed): POS rentals/trips cart - Same pattern, fixed with SQL filter
- **KAN-XXX** (❌ New): Public booking equipment rentals - Same pattern, needs fix

---

## Recommended Actions

### 🔴 IMMEDIATE
1. Create Jira ticket: **"KAN-XXX: Fix public booking equipment rental price validation"**
2. Apply same SQL filter as KAN-633
3. Add E2E tests for public booking equipment rentals
4. Deploy alongside KAN-633 or immediately after

### 🟡 FOLLOW-UP
5. Audit all equipment queries for similar pattern: `grep -r "eq(equipment.isRentable, true)" lib/db/`
6. Consider database constraint: `CHECK (isRentable = false OR rentalPrice > 0)`
7. Update equipment form to require price when isRentable is checked

---

## Impact Assessment

### Risk Level: MEDIUM
- **Severity:** Same bug as KAN-633, but in lower-traffic flow (public bookings < POS transactions)
- **User Impact:** Equipment rental add-ons may not appear on public booking form
- **Data Integrity:** Backend returns invalid data, frontend must clean it up
- **Consistency:** Inconsistent with KAN-633 fix (POS validates, public site doesn't)

### Why Not Critical?
- Public booking flow has lower transaction volume than POS
- Frontend filter prevents showing invalid data to users
- No crashes or errors, just missing rental options
- But: Should be fixed for consistency and architecture cleanliness

---

## Architecture Note

### Anti-Pattern Identified
**Bad Pattern:** Backend returns invalid data → Frontend filters it out
**Good Pattern:** Backend validates → Frontend trusts it

**Current Status:**
- POS: ✅ Uses good pattern (KAN-633 fix)
- Public site: ❌ Uses bad pattern (this follow-up)

**Goal:** Consistent validation across all equipment rental queries.

---

## Files to Modify

1. **Backend Query:**
   - `app/routes/site/book/$type.$id.tsx:231-238` - Add SQL price filter

2. **Frontend (Optional Cleanup):**
   - `app/routes/site/book/$type.$id.tsx:241-248` - Remove `.filter()` since backend validates

3. **Tests:**
   - Create `tests/e2e/public/booking-equipment-rentals.spec.ts`

---

## Estimated Effort

- **Fix:** 15 minutes (copy-paste KAN-633 solution)
- **Tests:** 30 minutes (2 E2E scenarios)
- **Total:** 45 minutes

---

**Discovered By:** Peer Reviewer #3
**Date:** 2026-01-29
**Related Commit:** `091c0d1` (KAN-633)
