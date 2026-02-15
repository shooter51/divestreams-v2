# Jira Dev Review - Verification Plan
**Date:** 2026-01-31
**Environment:** https://staging.divestreams.com
**Total Issues:** 36

## ✅ Recently Fixed (Likely Working)

These issues have been marked as FIXED in Jira comments with commit references. Verify they work in staging UI:

### 1. **KAN-641** - Product Image CRUD
- **Status:** FIXED in commit `e457c4f`
- **Test:**
  1. Navigate to Products → Edit a product
  2. Verify ImageManager component appears
  3. Upload an image (should save successfully)
  4. Reorder images, set primary, delete image
- **Expected:** Full image management (upload, reorder, delete, primary)

### 2. **KAN-642** - Boat Image During Creation
- **Status:** FIXED in commit `12133d0`
- **Test:**
  1. Create new boat
  2. After creation, verify redirected to edit page (not list page)
  3. Should see success message: "Now add images to complete your boat listing"
  4. ImageManager should be visible on edit page
- **Expected:** Auto-redirect to edit page after creation

### 3. **KAN-603** - Tour Picture Upload 500 Error
- **Status:** FIXED in commits `f2fdeeb`, `1237e12`, `297ed20`, `61c72c1`
- **Test:**
  1. Navigate to Tours → Edit tour → Tour Images section
  2. Upload an image (JPG, PNG, GIF)
  3. Should upload without 500 error
- **Expected:** B2 storage configured, images upload successfully

### 4. **KAN-631** - POS New Sale Button Not Working
- **Status:** FIXED in commit `091c0d1`
- **Test:**
  1. Navigate to POS
  2. Click "New Sale" button
  3. Should open new sale modal/view
- **Expected:** Button triggers new sale flow (doesn't submit form)

### 5. **KAN-648** - Retail/Rentals Not in POS
- **Status:** FIXED in commits `9872101`, `b154a08`, `c3eaa64`
- **Test:**
  1. Create product with `isActive = true`
  2. Create equipment with `isRentable = true` and `rentalPrice > 0`
  3. Go to POS → Verify products appear in Retail tab
  4. Verify equipment appears in Rentals tab
- **Expected:** Products and rentals visible in POS

### 6. **KAN-622** - Discount Modal Not Closing
- **Status:** FIXED in commit `100f8cf`
- **Test:**
  1. Navigate to Discounts
  2. Create new discount code
  3. Modal should close automatically on success
  4. Try Update and Delete - modals should close too
- **Expected:** Modals auto-close after create/update/delete

### 7. **KAN-633** - POS Cart Rentals/Trips
- **Status:** FIXED in commit `df6f620`
- **Test:**
  1. Add rental equipment to POS cart
  2. Add trip to POS cart
  3. Should not crash (React strict mode violations fixed)
- **Expected:** Cart handles rentals and trips without errors

### 8. **KAN-634** - Split Payment
- **Status:** FIXED in commit `c037efa`
- **Test:**
  1. Create POS transaction with split payment
  2. Complete checkout
  3. Should process successfully
- **Expected:** Split payment works correctly

### 9. **KAN-638** - Course Booking
- **Status:** FIXED in commit `d8f9c9d`
- **Test:**
  1. As customer, navigate to course booking
  2. Try to book a course
  3. Should use dynamic BASE_URL (not hardcoded)
- **Expected:** Course booking works on staging domain

### 10. **KAN-630** - Album Upload Timeout
- **Status:** Timeout extended in commit `254144e`
- **Test:**
  1. Upload images to album
  2. Should not timeout prematurely
- **Expected:** Uploads complete without timeout

## 🔍 Need Investigation (No Fix Comments Found Yet)

These issues don't have "FIXED" comments in Jira. Test them and mark with "Broken" label if they don't work:

### Image Management (7 issues)
- **KAN-605** - Dive site picture upload 500 error
- **KAN-643** - Dive sites card view images
- **KAN-644** - Boats card view images
- **KAN-645** - No dive site image during creation
- **KAN-646** - Tours card view images
- **KAN-647** - No tour image during creation

### Customer Booking (2 issues)
- **KAN-635** - Customer courses dark mode
- **KAN-636** - Privacy policy/TOS not found
- **KAN-639** - Customer trip booking 404

### Training/Courses (4 issues)
- **KAN-624** - Add enrollment error
- **KAN-628** - No CSV upload on import course
- **KAN-629** - Training session details (1/? spots)
- **KAN-650** - Training courses auto-seeded

### Subscription/Features (3 issues)
- **KAN-594** - Premium features locked despite subscription
- **KAN-626** - Upgrade subscription failed
- **KAN-627** - Failed to upgrade (no monthly price)

### Import/CSV (1 issue)
- **KAN-617** - Import product error messages

### Data Seeding (1 issue)
- **KAN-640** - Seed products auto-inserted

### System/Admin (7 issues)
- **KAN-611** - Auto-remove values issue
- **KAN-612** - Free trial homepage visibility
- **KAN-613** - No change password feature
- **KAN-619** - Rental management 500 error
- **KAN-625** - E2E tests failing (in CI/CD)
- **KAN-632** - No POS transaction history
- **KAN-649** - Critical multi-tenancy audit
- **KAN-651** - Owner login behavior

## Testing Workflow

For each issue:
1. **Open issue in Jira:** `https://divestreams.atlassian.net/browse/KAN-XXX`
2. **Read description** to understand expected behavior
3. **Test on staging:** `https://staging.divestreams.com`
4. **If BROKEN:**
   - Add "Broken" label to Jira issue
   - Add comment with failure details (screenshot, error message, steps)
5. **If WORKING:**
   - Move to "Done" status (or leave in Dev Review if needs more testing)

## Quick Test Script

Login to staging and run through this checklist:

```bash
# Image Management Tests
□ Upload image to tour (KAN-603)
□ Upload image to dive site (KAN-605)
□ Create boat → auto-redirect to edit page (KAN-642)
□ Create dive site → check if image upload available (KAN-645)
□ Create tour → check if image upload available (KAN-647)

# POS Tests
□ Click "New Sale" button (KAN-631)
□ Add retail product to cart (KAN-648)
□ Add rental equipment to cart (KAN-648, KAN-633)
□ Complete split payment (KAN-634)
□ View transaction history (KAN-632)

# Discount Tests
□ Create discount code → modal closes (KAN-622)
□ Update discount → modal closes (KAN-622)
□ Delete discount → modal closes (KAN-622)

# Customer Tests
□ Book course (KAN-638)
□ Book trip (KAN-639)
□ View courses in dark mode (KAN-635)
□ Access privacy policy (KAN-636)

# Training Tests
□ Add enrollment (KAN-624)
□ Import course CSV (KAN-628)
□ Check training session participant count (KAN-629)

# Admin Tests
□ Change password feature (KAN-613)
□ Upgrade subscription (KAN-626, KAN-627)
□ Premium feature access (KAN-594)
```

## Automation Note

E2E tests cover some of these scenarios. Check:
- `tests/e2e/pos.spec.ts` - POS workflows
- `tests/e2e/courses.spec.ts` - Course booking
- Run tests: `npm run test:e2e`

## Summary

- **10 issues:** Marked as FIXED, need UI verification
- **26 issues:** Need investigation and testing
- **Goal:** Mark broken ones with "Broken" label
