# KAN-620: Bulk Update Product Stock to Minus is Possible?

**Status:** QA REJECTED (8th iteration)
**Reporter:** Antonius (QA Tester)
**Created:** January 26, 2026
**Last Updated:** February 1, 2026

---

## Original Problem

Bulk stock update feature allows setting product stock to negative values, which violates business logic (cannot have negative inventory).

**Impact:** Medium - Data integrity issue, inventory tracking broken.

---

## Current Problem (Feb 1, 2026)

**"Adjust by amount" mode has incorrect logic:**

```
Current Behavior:
- Current stock: 15
- Adjust by: -25
- Expected: Error (would result in -10)
- Actual: Sets stock to 0 (silent failure)

QA Feedback:
"e.g., the current stock is 15, we adjust to -25. When we submit,
shouldn't the app show an error message because the result would be negative?"
```

**Two modes have different validation:**
1. **"Set to value"** - ✅ Correctly rejects negative values
2. **"Adjust by amount"** - ❌ Silently clamps to 0, should error

---

## Back-and-Forth History (8 Exchanges)

| # | Date | Action | Issue | Result |
|---|------|--------|-------|--------|
| 1 | Jan 26 | **QA:** Can set stock to negative in bulk update | Validation missing | Bug logged |
| 2 | Jan 27 | **DEV:** Fixed - price plan table monthly option | ❓ Wrong issue | Unrelated |
| 3 | Jan 27 | **QA:** After update, all stock remains 0 | Update not working | ❌ Failed |
| 4 | Jan 28 | **DEV:** Fixed "Set to value" validation | Partial fix | ✅ One mode fixed |
| 5 | Jan 28 | **DEV:** Added client-side validation and warning | UI improvement | ✅ Claimed fixed |
| 6 | Jan 28 | **QA:** "Adjust by amount" still allows negative, stock stays 0 | Other mode broken | ❌ Failed |
| 7 | Jan 29 | **DEV:** Fixed individual stock adjustment validation | Wrong screen | ✅ Wrong fix |
| 8 | Feb 1 | **QA:** "Adjust by amount" behavior incorrect | Logic error | ❌ **FAILED** |

**Total duration:** 6 days
**Developer time spent:** ~6 hours
**QA testing cycles:** 5 rejections
**Issues fixed:** 1 of 2 modes

---

## Root Cause Analysis

### Two Update Modes, Two Different Bugs

**Mode 1: "Set to value"** ✅ FIXED
```typescript
// Set stock to absolute value (e.g., "Set all to 50")
if (mode === 'set') {
  if (newValue < 0) {
    return error('Cannot set stock to negative value');
  }
  await update({ stock: newValue });
}
```
**Status:** Working correctly, rejects negative values

**Mode 2: "Adjust by amount"** ❌ BROKEN
```typescript
// Adjust by relative amount (e.g., "Add 10" or "Subtract 5")
if (mode === 'adjust') {
  const newStock = currentStock + adjustment;

  // BUG: Silently clamps to 0 instead of erroring
  if (newStock < 0) {
    await update({ stock: 0 });  // ❌ Should error instead
  } else {
    await update({ stock: newStock });
  }
}
```

### Why the Logic is Wrong

**Business Rule:**
> Inventory cannot be negative. If an adjustment would result in negative stock, the operation should be **rejected with an error**, not silently clamped to 0.

**Why clamping is wrong:**
1. **Hides data problems** - User thinks adjustment worked, but actual inventory incorrect
2. **No feedback** - User doesn't know operation failed partially
3. **Audit trail broken** - Cannot tell if stock was 0 or clamped from negative

**Correct behavior:**
```
Current stock: 15
User adjusts by: -25
Expected result: -10 (invalid)
Action: ❌ Show error "Cannot adjust by -25: would result in negative stock (-10)"
Actual result: Sets to 0 ✓ but no error shown
```

### Why It Took 8 Iterations

1. **Two separate modes treated as one issue** - Fixed one, forgot the other
2. **Validation added in wrong place** - Fixed "Set to value" but not "Adjust by amount"
3. **Misunderstood business logic** - Developer thought clamping was acceptable
4. **Wrong screen fixed** - Fixed individual adjustment instead of bulk adjustment
5. **No comprehensive test** - Didn't test both modes together

---

## Plan to Close Once and For All

### Phase 1: Fix "Adjust by Amount" Validation

**Current code (broken):**
```typescript
// app/components/products/BulkStockAdjustment.tsx
async function handleAdjustByAmount(adjustment: number) {
  for (const product of selectedProducts) {
    const newStock = product.stock + adjustment;

    // ❌ WRONG: Clamps to 0
    await updateStock(product.id, Math.max(0, newStock));
  }
}
```

**Fixed code:**
```typescript
async function handleAdjustByAmount(adjustment: number) {
  // VALIDATE FIRST - Check if any product would go negative
  const wouldBeNegative = selectedProducts.filter(p => {
    const newStock = p.stock + adjustment;
    return newStock < 0;
  });

  if (wouldBeNegative.length > 0) {
    // ✅ CORRECT: Error and show which products would fail
    const productNames = wouldBeNegative.map(p =>
      `${p.name} (current: ${p.stock}, result: ${p.stock + adjustment})`
    ).join(', ');

    return error({
      title: 'Cannot adjust stock',
      message: `Adjustment of ${adjustment} would result in negative stock for: ${productNames}`,
      type: 'validation',
    });
  }

  // Only proceed if all products valid
  for (const product of selectedProducts) {
    const newStock = product.stock + adjustment;
    await updateStock(product.id, newStock);
  }

  return success('Stock adjusted successfully');
}
```

### Phase 2: Add Validation Summary

**Show preview before applying:**
```typescript
// Show preview modal when user clicks "Apply"
function PreviewAdjustment({ products, adjustment }: Props) {
  const results = products.map(p => ({
    name: p.name,
    current: p.stock,
    change: adjustment,
    result: p.stock + adjustment,
    valid: (p.stock + adjustment) >= 0,
  }));

  const invalidCount = results.filter(r => !r.valid).length;

  return (
    <Modal>
      <h2>Preview Stock Adjustment</h2>
      <p>Adjusting {products.length} products by {adjustment}</p>

      {invalidCount > 0 && (
        <Alert type="error">
          ⚠️ {invalidCount} products would have negative stock.
          Adjustment cannot proceed.
        </Alert>
      )}

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Current</th>
            <th>Change</th>
            <th>Result</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map(r => (
            <tr className={r.valid ? '' : 'text-red-600'}>
              <td>{r.name}</td>
              <td>{r.current}</td>
              <td>{r.change}</td>
              <td>{r.result}</td>
              <td>{r.valid ? '✓' : '✗ Invalid'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button disabled={invalidCount > 0}>
        {invalidCount > 0 ? 'Cannot Apply' : 'Apply Changes'}
      </button>
    </Modal>
  );
}
```

### Phase 3: Testing Strategy

**Test Matrix:**

| Mode | Current | Adjustment | Expected Result | Status |
|------|---------|------------|-----------------|--------|
| Set to value | 15 | 20 | Stock = 20 ✓ | ✅ Working |
| Set to value | 15 | -5 | Error ✗ | ✅ Working |
| Adjust by | 15 | +10 | Stock = 25 ✓ | ✅ Working |
| Adjust by | 15 | -10 | Stock = 5 ✓ | ✅ Working |
| **Adjust by** | **15** | **-25** | **Error ✗** | ❌ **BROKEN** |
| Adjust by | 0 | -5 | Error ✗ | ❌ Needs test |

**Comprehensive Test Case:**
```typescript
describe('Bulk Stock Adjustment', () => {
  describe('Adjust by amount', () => {
    it('allows positive adjustments', async () => {
      const product = { id: '1', name: 'Mask', stock: 15 };
      const result = await adjustStock([product], +10);

      expect(result.success).toBe(true);
      expect(result.newStock).toBe(25);
    });

    it('allows negative adjustments that stay positive', async () => {
      const product = { id: '1', name: 'Mask', stock: 15 };
      const result = await adjustStock([product], -10);

      expect(result.success).toBe(true);
      expect(result.newStock).toBe(5);
    });

    it('rejects adjustments that would result in negative stock', async () => {
      const product = { id: '1', name: 'Mask', stock: 15 };
      const result = await adjustStock([product], -25);

      expect(result.success).toBe(false);
      expect(result.error).toContain('negative stock');
      expect(result.error).toContain('-10'); // Show resulting value
      expect(result.newStock).toBeUndefined(); // No update
    });

    it('shows which products would fail in batch', async () => {
      const products = [
        { id: '1', name: 'Mask', stock: 15 },
        { id: '2', name: 'Fins', stock: 5 },
        { id: '3', name: 'Snorkel', stock: 30 },
      ];
      const result = await adjustStock(products, -10);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Fins'); // Only Fins would be negative
      expect(result.invalidCount).toBe(1);
    });
  });
});
```

### Phase 4: E2E Test

```typescript
test('bulk adjust by amount validation', async ({ page }) => {
  // Setup: 3 products with different stock levels
  await setupProducts([
    { name: 'Product A', stock: 15 },
    { name: 'Product B', stock: 5 },
    { name: 'Product C', stock: 30 },
  ]);

  // Navigate to products page
  await page.goto('/tenant/products');

  // Select all products
  await page.click('text=Select All');

  // Open bulk adjustment modal
  await page.click('text=Bulk Actions');
  await page.click('text=Adjust Stock');

  // Select "Adjust by amount" mode
  await page.click('input[value="adjust"]');

  // Enter -10 (should fail for Product B: 5 - 10 = -5)
  await page.fill('input[name="adjustment"]', '-10');

  // Click Apply
  await page.click('button:has-text("Apply")');

  // Should show preview with error
  await expect(page.locator('.alert-error')).toContainText(
    '1 products would have negative stock'
  );
  await expect(page.locator('text=Product B')).toHaveClass(/text-red/);

  // Apply button should be disabled
  await expect(page.locator('button:has-text("Apply Changes")')).toBeDisabled();
});
```

---

## Acceptance Criteria for Closure

**Functional:**
1. ✅ "Set to value" mode rejects negative values
2. ⏳ "Adjust by amount" mode rejects adjustments resulting in negative stock
3. ⏳ Error message shows which products would be invalid
4. ⏳ Error message shows current stock and resulting value
5. ⏳ No silent clamping to 0

**UX:**
6. ⏳ Preview modal shows calculation before applying
7. ⏳ Invalid products highlighted in red
8. ⏳ Apply button disabled if any product invalid
9. ⏳ Clear error messaging

**Technical:**
10. ⏳ Unit tests cover both modes
11. ⏳ E2E test covers validation flow
12. ⏳ Test includes batch scenario (multiple products, some invalid)

---

## Estimated Time to Complete

- Fix validation logic: **1 hour**
- Add preview modal: **2 hours**
- Unit tests: **1 hour**
- E2E test: **1 hour**
- Manual QA testing: **30 minutes**

**Total:** ~5.5 hours

---

## Why This Will Work

| Previous Attempts | Why Failed | This Approach |
|------------------|------------|---------------|
| Fixed only "Set to value" | Didn't test both modes | Tests both modes explicitly |
| No validation on adjust | Assumed clamping OK | Errors instead of clamping |
| No preview | User sees result after | Preview shows calculation first |
| Fixed wrong screen | Individual vs bulk | Fixes bulk adjustment |
| Silent failure | No error message | Clear error with details |

---

## Critical Success Factors

1. **Test both modes** - "Set to value" AND "Adjust by amount"
2. **Error, don't clamp** - Reject invalid operations
3. **Show calculation** - Preview before applying
4. **Batch awareness** - Handle multiple products, some valid, some invalid
5. **Clear messaging** - Show which products and why they failed

**Verification:**
- QA follows exact test case: stock 15, adjust by -25
- Expected: Error message, no update
- Actual should match expected

**If this fails again:** The issue is that validation is in the wrong layer (client vs server). Move validation to server-side API endpoint to guarantee enforcement.
