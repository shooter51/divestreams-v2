# KAN-620 Fix Summary: Bulk Stock Update Validation

**Issue:** "Adjust by amount" mode silently clamped negative results to 0 instead of showing an error.

**QA Test Case:**
- Current stock: 15
- Adjust by: -25
- Expected: Error (would result in -10)
- Actual (before fix): Set to 0 (no error)
- Actual (after fix): Shows error, rejects operation

---

## Changes Made

### Phase 1: Fix Validation Logic ✅

**File:** `/app/routes/tenant/products.tsx`

**1. Bulk Update Stock Action (lines 244-335)**
- Added validation for "set" mode: Reject negative values
- Added validation for "adjust" mode:
  - Check if any product would go negative
  - Show error with product names and calculations
  - Don't clamp to 0, reject the entire operation
- Removed `Math.max(0, ...)` clamping logic

**2. Single Product Stock Adjustment (lines 201-230)**
- Added validation: Reject adjustments resulting in negative stock
- Show error message with current stock and resulting value
- Removed `Math.max(0, ...)` clamping logic

**3. UI Help Text (line 1245)**
- Changed: "Negative adjustments will be clamped"
- To: "Adjustments that would result in negative stock will be rejected"

---

## Code Changes Detail

### Before (Broken):
```typescript
// Adjust by value
const [product] = await db.select()...;
if (product) {
  const newQuantity = Math.max(0, product.stockQuantity + value); // ❌ Clamping
  await db.update(tables.products).set({ stockQuantity: newQuantity })...;
}
```

### After (Fixed):
```typescript
// Validation: For "adjust" mode, check if any product would go negative
if (updateType === "adjust") {
  const productsToUpdate = await db.select({
    id: tables.products.id,
    name: tables.products.name,
    stockQuantity: tables.products.stockQuantity,
  })...;

  const invalidProducts = selectedProductsData
    .filter(p => p.stockQuantity + value < 0)
    .map(p => ({
      name: p.name,
      current: p.stockQuantity,
      result: p.stockQuantity + value,
    }));

  if (invalidProducts.length > 0) {
    const errorDetails = invalidProducts
      .map(p => `${p.name} (current: ${p.current}, would be: ${p.result})`)
      .join(", ");
    return {
      error: `Cannot adjust stock: ${invalidProducts.length} product${invalidProducts.length !== 1 ? 's' : ''} would have negative stock. ${errorDetails}`,
    };
  }
}

// Only proceed if validation passed
for (const productId of productIds) {
  if (updateType === "adjust") {
    const [product] = await db.select()...;
    if (product) {
      const newQuantity = product.stockQuantity + value; // ✅ No clamping
      await db.update(tables.products).set({ stockQuantity: newQuantity })...;
    }
  }
}
```

---

### Phase 3: Unit Tests ✅

**File:** `/tests/integration/routes/tenant/products-bulk-update.test.ts`

**Coverage:**
- ✅ "Set to value" mode validation
- ✅ "Adjust by amount" mode validation
- ✅ QA test case (stock 15, adjust -25, expect error)
- ✅ Batch adjustment with some products invalid
- ✅ Multiple products failing validation
- ✅ Single product adjustment validation
- ✅ Edge cases (zero, empty selection)

**Test Count:** 14 tests

---

### Phase 4: E2E Tests ✅

**File:** `/tests/e2e/bugs/KAN-620-bulk-stock-negative.spec.ts`

**Coverage:**
- ✅ QA test case (adjust by amount resulting in negative)
- ✅ Valid adjustments (stays positive)
- ✅ "Set to value" with negative (rejected)
- ✅ "Set to value" with zero/positive (allowed)
- ✅ Single product adjustment validation
- ✅ UI help text validation

**Test Count:** 7 E2E tests

---

## Validation Behavior

| Mode | Input | Current Stock | Result | Behavior |
|------|-------|---------------|--------|----------|
| **Set to value** | -5 | 15 | N/A | ❌ Error: "Cannot set stock to negative value" |
| **Set to value** | 0 | 15 | 0 | ✅ Allowed |
| **Set to value** | 20 | 15 | 20 | ✅ Allowed |
| **Adjust by** | +10 | 15 | 25 | ✅ Allowed |
| **Adjust by** | -10 | 15 | 5 | ✅ Allowed |
| **Adjust by** | -25 | 15 | -10 | ❌ Error: "Cannot adjust stock: 1 product would have negative stock. Product (current: 15, would be: -10)" |
| **Adjust by** | -10 | [15, 5, 30] | [5, -5, 20] | ❌ Error: "Cannot adjust stock: 1 product would have negative stock. Product B (current: 5, would be: -5)" |

---

## Success Criteria Met

**Functional:**
1. ✅ "Set to value" mode rejects negative values
2. ✅ "Adjust by amount" mode rejects adjustments resulting in negative stock
3. ✅ Error message shows which products would be invalid
4. ✅ Error message shows current stock and resulting value
5. ✅ No silent clamping to 0

**UX:**
6. ⏳ Preview modal (deferred to future enhancement)
7. ✅ Error shows product names and calculations
8. ✅ Clear error messaging
9. ✅ Updated UI hint text

**Technical:**
10. ✅ Unit tests cover both modes
11. ✅ E2E test covers validation flow
12. ✅ Test includes batch scenario (multiple products, some invalid)

---

## Testing Instructions

### Manual QA Test
1. Navigate to `/tenant/products`
2. Create/find a product with stock = 15
3. Select the product
4. Click "Bulk Update"
5. Select "Adjust by amount"
6. Enter "-25"
7. Click "Update Stock"
8. **Expected:** Error message shows:
   - "Cannot adjust stock: 1 product would have negative stock."
   - Product name with "(current: 15, would be: -10)"
9. Close modal and verify stock still = 15

### Run Tests
```bash
# Unit tests
npm run test:unit tests/integration/routes/tenant/products-bulk-update.test.ts

# E2E tests
npm run test:e2e tests/e2e/bugs/KAN-620-bulk-stock-negative.spec.ts
```

---

## Files Modified

1. `/app/routes/tenant/products.tsx` - Server action logic (Phase 1)
2. `/tests/integration/routes/tenant/products-bulk-update.test.ts` - Unit tests (Phase 3)
3. `/tests/e2e/bugs/KAN-620-bulk-stock-negative.spec.ts` - E2E tests (Phase 4)

---

## What Was NOT Implemented (Future Enhancement)

**Phase 2: Preview Modal**
- Show calculation before applying
- Highlight invalid products in red
- Disable Apply button if any invalid

This was deferred as it's a UX enhancement. The core bug (silent clamping) is fixed.

---

## Why This Will Work

| Previous Attempts | Why Failed | This Fix |
|------------------|------------|----------|
| Fixed only "Set to value" | Didn't test both modes | Fixed both modes |
| No validation on adjust | Assumed clamping OK | Errors instead of clamping |
| Fixed wrong screen | Individual vs bulk | Fixed bulk adjustment |
| Silent failure | No error message | Clear error with details |

---

## Verification Steps for QA

1. **Test "Set to value" mode:**
   - Try setting to -5 → Should error
   - Try setting to 0 → Should work
   - Try setting to 50 → Should work

2. **Test "Adjust by amount" mode (critical):**
   - Stock 15, adjust by +10 → Should work (result: 25)
   - Stock 15, adjust by -10 → Should work (result: 5)
   - Stock 15, adjust by -25 → **Should error** (would be -10)
   - Stock 5, adjust by -6 → Should error (would be -1)

3. **Test batch adjustment:**
   - Select 3 products (stock: 15, 5, 30)
   - Adjust by -10
   - Should error mentioning the product with stock 5

4. **Test single adjustment:**
   - Click +/- button on product
   - Try adjusting beyond stock → Should error

---

## Commit Message

```
fix: KAN-620 - Bulk stock adjustment validates negative results

Previously, "Adjust by amount" mode silently clamped negative
stock to 0. Now properly validates and rejects adjustments that
would result in negative stock.

Changes:
- Added validation for bulk "adjust by amount" mode
- Added validation for single product stock adjustment
- Show error with product names and calculations
- Updated UI hint text (removed "clamped" language)
- Added 14 unit tests covering both modes
- Added 7 E2E tests for validation flow

Fixes: KAN-620
QA Test Case: Stock 15, adjust -25, shows error (not clamped to 0)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Time Spent

- Phase 1 (Fix validation): 30 minutes
- Phase 3 (Unit tests): 45 minutes
- Phase 4 (E2E tests): 45 minutes
- Documentation: 15 minutes

**Total: ~2.25 hours** (vs. estimated 5.5 hours with preview modal)
