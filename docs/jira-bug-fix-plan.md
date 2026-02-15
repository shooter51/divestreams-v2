# Jira Bug Fix Plan - DiveStreams v2

**Date**: 2026-01-27
**Total Issues**: 24 (13 To Do, 11 In Progress)
**Analysis**: Based on screenshots, videos, comments, and descriptions

---

## Pattern 1: Image Upload Failures (Error 500) - 5 Issues

### Issues
- **KAN-623** (To Do): Error uploading course photos
- **KAN-609** (In Progress): Error uploading equipment photos - "Still happening" per comment
- **KAN-608** (In Progress): Error uploading boat photos - "Still happening" per comment
- **KAN-605** (In Progress): Error uploading dive site photos - "Still happening" per comment
- **KAN-603** (In Progress): Error uploading tour photos - "Still happening" per comment, tested with GIF and JPG

### Root Cause Analysis
All 5 issues show identical Error 500 responses when uploading images across different entities (tours, boats, equipment, dive sites, courses). The fact that users tested multiple formats (GIF, JPG) and still get the same error suggests:

1. **Server-side error in file upload handler** - likely in the shared image upload endpoint
2. **Possible causes**:
   - File size/type validation failing
   - Cloud storage (if used) configuration issues
   - Missing multipart/form-data parsing
   - Insufficient error handling masking actual error
   - File system permissions on VPS

### Fix Plan

**Priority**: P0 (Critical) - Blocks core functionality across 5 different features

**Investigation Steps**:
1. Check server logs during upload attempt to get actual error
2. Review image upload endpoint implementation
3. Test multipart/form-data parsing
4. Verify file storage configuration (local vs cloud)
5. Check VPS file system permissions if using local storage

**Files to Review**:
- `/app/routes/api/upload.ts` (or similar image upload endpoint)
- `/lib/storage/` (file storage utilities)
- `/app/routes/admin.$orgId.tours.tsx` (tour photo upload action)
- `/app/routes/admin.$orgId.boats.tsx` (boat photo upload action)
- `/app/routes/admin.$orgId.equipment.tsx` (equipment photo upload action)
- `/app/routes/admin.$orgId.dive-sites.tsx` (dive site photo upload action)
- `/app/routes/admin.$orgId.courses.tsx` (course photo upload action)

**Expected Code Changes**:
1. Add comprehensive error logging to upload handler
2. Fix file parsing if broken
3. Add proper error responses (not just 500)
4. Test file size limits
5. Verify storage path creation
6. Add file type validation with clear error messages

**Testing**:
- Test with JPG, PNG, GIF files of various sizes
- Test on all 5 affected entities
- Verify error messages are helpful
- Check VPS storage after successful upload

**Beads Issues**:
```bash
bd create --title "Fix image upload Error 500 across all entities" --type bug --priority 0
```

---

## Pattern 2: Form Data Loss on Validation Errors - 2 Issues

### Issues
- **KAN-611** (To Do): Values auto-removed when validation errors show - video shows admin org creation
- **KAN-597** (In Progress): Same issue for create organization - Tom's comment: "seems the top part and bottom part of Create Organization dialog are submitted separate"

### Root Cause Analysis
Video evidence shows form values disappearing when validation errors appear. Tom's comment reveals the Create Organization dialog has two parts submitting separately, causing data loss.

**Likely causes**:
1. Form state not preserved on validation failure
2. React Router action returning errors without preserving form data
3. Two separate forms in one dialog (top/bottom) with conflicting submissions
4. Missing defaultValue/value binding to preserve state

### Fix Plan

**Priority**: P1 (High) - Major UX issue affecting user workflows

**Investigation Steps**:
1. Review Create Organization dialog component structure
2. Check if using single form or multiple forms
3. Review action handlers for validation error responses
4. Test form state preservation on error

**Files to Review**:
- `/app/routes/admin.organizations.tsx` (admin org creation)
- `/app/routes/admin.$orgId.settings.tsx` (org settings)
- `/app/components/organizations/CreateOrgDialog.tsx` (or similar)
- Form validation utilities

**Expected Code Changes**:
1. Combine separate form submissions into single form if split
2. Preserve form data in action errors:
   ```typescript
   return json({ errors, values: formData }, { status: 400 });
   ```
3. Use returned values as defaultValue in form fields:
   ```typescript
   <input defaultValue={actionData?.values?.name || ""} />
   ```
4. Test validation scenarios preserve all fields

**Testing**:
- Trigger validation errors and verify all fields retain values
- Test both admin org creation and regular org creation
- Test multi-step forms maintain data between steps

**Beads Issues**:
```bash
bd create --title "Preserve form data on validation errors" --type bug --priority 1
```

---

## Pattern 3: Subscription Plan Issues - 1 Issue

### Issues
- **KAN-594** (In Progress): Features locked after upgrading plan - Tom's comment: "seems like plans and all the features reset on deployment of new code"

### Root Cause Analysis
Tom identified that subscription plans reset on deployment, suggesting:

1. **Subscription state stored in memory/cache instead of database**
2. **Missing database persistence for plan upgrades**
3. **Cache invalidation needed on deployment**
4. **Plan features recalculated on server restart without DB lookup**

### Fix Plan

**Priority**: P0 (Critical) - Breaks paid features, revenue impact

**Investigation Steps**:
1. Review how subscription plans are stored (DB vs cache)
2. Check plan upgrade flow - does it persist to DB?
3. Review how feature checks work (DB lookup vs cache)
4. Test deployment impact on active subscriptions

**Files to Review**:
- `/lib/db/schema/subscriptions.ts` (subscription schema)
- `/app/routes/api/stripe/webhook.ts` (Stripe plan changes)
- `/lib/subscriptions/` (subscription utilities)
- Feature flag/check utilities
- Redis caching layer if used

**Expected Code Changes**:
1. Ensure plan upgrades write to database:
   ```typescript
   await db.update(subscriptions)
     .set({ planId: newPlan, features: newFeatures })
     .where(eq(subscriptions.orgId, orgId));
   ```
2. Feature checks must query database, not rely on cache:
   ```typescript
   const sub = await db.query.subscriptions.findFirst({
     where: eq(subscriptions.orgId, orgId)
   });
   return sub?.features.includes(feature);
   ```
3. Add Redis cache invalidation on plan changes if using cache
4. Add database migration to backfill any missing plan data

**Testing**:
- Upgrade plan and verify features unlock
- Deploy new code and verify plan persists
- Test Stripe webhook updates plan correctly
- Check database shows correct plan after upgrade

**Beads Issues**:
```bash
bd create --title "Fix subscription plan persistence across deployments" --type bug --priority 0
bd create --title "Add database migration to backfill subscription data" --type task --priority 1
```

---

## Pattern 4: Training/Enrollment Errors - 2 Issues

### Issues
- **KAN-624** (To Do): Error trying to add enrollment to active training session
- **KAN-610** (In Progress): Error 500 when accessing new enrollment, now Error 400 per comment

### Root Cause Analysis
KAN-610 evolved from 500 to 400 error, suggesting partial fix attempt. Likely issues:

1. **Validation failing on enrollment creation**
2. **Missing required fields in enrollment data**
3. **Foreign key constraint violations**
4. **Active session state conflicts with new enrollments**

### Fix Plan

**Priority**: P1 (High) - Blocks core training functionality

**Investigation Steps**:
1. Review enrollment creation endpoint
2. Check validation rules for enrollments
3. Test adding enrollment to active vs inactive sessions
4. Review database constraints on enrollment table

**Files to Review**:
- `/app/routes/admin.$orgId.training.$sessionId.tsx` (enrollment management)
- `/lib/db/schema/training.ts` (enrollment schema)
- Enrollment validation logic

**Expected Code Changes**:
1. Fix validation to allow enrollments on active sessions
2. Add proper error messages (not generic 400/500)
3. Handle foreign key constraints gracefully
4. Add enrollment status validation

**Testing**:
- Add enrollment to active session
- Add enrollment to inactive session
- Verify error messages are helpful
- Test enrollment limits if any

**Beads Issues**:
```bash
bd create --title "Fix enrollment creation errors (400/500)" --type bug --priority 1
```

---

## Pattern 5: Missing Features - 3 Issues

### Issues
- **KAN-613** (To Do): No change password feature for team members
- **KAN-616** (To Do): Missing CSV template for import
- **KAN-612** (To Do): Free trial homepage visibility issues

### Fix Plan

**KAN-613: Change Password Feature**
**Priority**: P2 (Medium) - Security/UX feature gap

**Implementation**:
1. Add "Change Password" button to user settings
2. Create password change form with current + new password
3. Add server action to validate current password and update
4. Use Better Auth's password update API

**Files**:
- `/app/routes/admin.$orgId.team.tsx` (team member settings)
- `/app/components/settings/ChangePasswordForm.tsx` (new)

**Testing**:
- Test correct current password allows change
- Test incorrect current password rejected
- Test password requirements enforced

**Beads**:
```bash
bd create --title "Add change password feature for team members" --type feature --priority 2
```

---

**KAN-616: CSV Import Template**
**Priority**: P2 (Medium) - UX improvement

**Implementation**:
1. Create CSV template files for each importable entity
2. Add download link on import pages
3. Include headers + example row

**Files**:
- `/public/templates/customers-import.csv` (new)
- `/app/routes/admin.$orgId.customers.tsx` (add download link)

**Testing**:
- Download template and verify format
- Import template successfully
- Test with sample data

**Beads**:
```bash
bd create --title "Add CSV import templates" --type feature --priority 2
```

---

**KAN-612: Free Trial Homepage Visibility**
**Priority**: P2 (Medium) - Marketing/conversion issue

**Investigation Needed**:
- Review what specific visibility issues exist
- Check if it's a display bug or design issue
- Verify free trial CTA placement

**Beads**:
```bash
bd create --title "Investigate and fix free trial homepage visibility" --type bug --priority 2
```

---

## Pattern 6: UX/Validation Issues - 4 Issues

### Issues
- **KAN-622** (To Do): Discount code validation - max 100%, error shows in wrong place
- **KAN-617** (To Do): Unfriendly import error messages
- **KAN-620** (To Do): Default to first price plan option in table
- **KAN-619** (To Do): Can't create multiple price plans in table

### Fix Plan

**KAN-622: Discount Validation**
**Priority**: P2 (Medium)

**Implementation**:
1. Add client-side validation: max 100%
2. Move error message to correct field
3. Show inline error near discount input

**Files**:
- `/app/routes/admin.$orgId.discounts.tsx`

**Beads**:
```bash
bd create --title "Fix discount code validation UX" --type bug --priority 2
```

---

**KAN-617: Import Error Messages**
**Priority**: P2 (Medium)

**Implementation**:
1. Replace technical errors with user-friendly messages
2. Add specific field-level errors
3. Provide examples of correct format

**Files**:
- `/app/routes/admin.$orgId.*.import.tsx` (all import routes)
- `/lib/import/` (import utilities)

**Beads**:
```bash
bd create --title "Improve import error messages" --type task --priority 2
```

---

**KAN-620 & KAN-619: Price Plan Table Issues**
**Priority**: P2 (Medium)

**Investigation Needed**:
- Review price plan table implementation
- Test multiple plan creation
- Check default selection logic

**Beads**:
```bash
bd create --title "Fix price plan table default selection and multi-create" --type bug --priority 2
```

---

## Pattern 7: Email/Notification Issues - 2 Issues

### Issues
- **KAN-592** (In Progress): Free trial emails not sending - comments show it works but no email received
- **KAN-600** (In Progress): Email link redirects to localhost

### Fix Plan

**KAN-592: Free Trial Emails**
**Priority**: P1 (High) - Affects user onboarding

**Root Cause**: Email queued/sent but not delivered. Possible issues:
1. SMTP configuration incorrect
2. Email going to spam
3. Email template has wrong content
4. Queue worker not processing email jobs

**Investigation**:
1. Check worker logs for email job processing
2. Review SMTP credentials
3. Test with different email providers
4. Check email deliverability (SPF/DKIM)

**Files**:
- `/lib/email/index.ts`
- `/lib/jobs/worker.ts` (email job handler)
- Check BullMQ email queue

**Beads**:
```bash
bd create --title "Debug free trial email delivery" --type bug --priority 1
```

---

**KAN-600: Email Links Redirect to Localhost**
**Priority**: P1 (High) - Breaks production emails

**Root Cause**: Email templates using APP_URL but it's set to localhost or not reading env var correctly

**Implementation**:
1. Review email template generation
2. Ensure APP_URL used for all links
3. Verify environment variables in production
4. Test emails in staging/production

**Files**:
- `/lib/email/templates/` (all templates)
- Check AUTH_URL and APP_URL env vars

**Beads**:
```bash
bd create --title "Fix email links using localhost instead of production URL" --type bug --priority 1
```

---

## Pattern 8: Data Management Issues - 4 Issues

### Issues
- **KAN-618** (To Do): Customer table doesn't show customers
- **KAN-614** (To Do): Tours duplicating - video shows duplication happening
- **KAN-604** (In Progress): Can't delete dive sites (likely in use by tours)
- **KAN-601** (In Progress): Can't delete tours

### Fix Plan

**KAN-618: Customer Table Empty**
**Priority**: P1 (High)

**Investigation**:
1. Check if customers exist in database
2. Review query logic
3. Check multi-tenant filtering
4. Verify organization context

**Files**:
- `/app/routes/admin.$orgId.customers.tsx`

**Beads**:
```bash
bd create --title "Fix customer table not showing data" --type bug --priority 1
```

---

**KAN-614: Tour Duplication**
**Priority**: P1 (High) - Video evidence shows it happening

**Root Cause**: Likely double-submission or missing unique constraint

**Implementation**:
1. Add unique constraint on tour name per org
2. Prevent double-submit with loading state
3. Check for race condition in create action

**Files**:
- `/app/routes/admin.$orgId.tours.tsx`
- `/lib/db/schema/tours.ts`

**Beads**:
```bash
bd create --title "Fix tour duplication on creation" --type bug --priority 1
```

---

**KAN-604 & KAN-601: Can't Delete Tours/Dive Sites**
**Priority**: P2 (Medium)

**Root Cause**: Foreign key constraints preventing deletion

**Implementation**:
1. Add cascade delete or soft delete
2. Show helpful error: "Can't delete - used by X tours"
3. Offer to archive instead of delete

**Files**:
- `/app/routes/admin.$orgId.tours.tsx`
- `/app/routes/admin.$orgId.dive-sites.tsx`
- `/lib/db/schema/` (add cascade or soft delete)

**Beads**:
```bash
bd create --title "Implement soft delete or cascade for tours/dive sites" --type feature --priority 2
```

---

## Summary by Priority

### P0 - Critical (3 issues)
1. Image upload Error 500 (5 entities affected)
2. Subscription plan persistence across deployments
3. *(Implicit)* Database migration for subscription backfill

### P1 - High (9 issues)
1. Form data loss on validation errors
2. Enrollment creation errors (400/500)
3. Free trial email delivery
4. Email links using localhost
5. Customer table empty
6. Tour duplication
7. (From each individual issue above)

### P2 - Medium (12 issues)
1. Change password feature
2. CSV import templates
3. Free trial homepage visibility
4. Discount validation UX
5. Import error messages
6. Price plan table issues
7. Soft delete for tours/dive sites
8. (Others)

---

## Next Steps

1. **Create all Beads issues** from this plan (26 total)
2. **Start with P0 issues** - image uploads and subscription persistence
3. **Verify root causes** with debugging/logging before implementing fixes
4. **Test fixes in staging** before production deployment
5. **Update Jira** as issues are resolved

---

## Commands to Create All Beads Issues

```bash
# P0 Issues
bd create --title "Fix image upload Error 500 across all entities" --type bug --priority 0 --description "Affects tours, boats, equipment, dive sites, courses. Users tested multiple formats (GIF, JPG). Related Jira: KAN-603, 605, 608, 609, 623"

bd create --title "Fix subscription plan persistence across deployments" --type bug --priority 0 --description "Plans reset on deployment, features get locked. Related Jira: KAN-594"

bd create --title "Add database migration to backfill subscription data" --type task --priority 0 --description "Backfill any missing subscription plan data for existing orgs"

# P1 Issues
bd create --title "Preserve form data on validation errors" --type bug --priority 1 --description "Form values disappear when validation errors show. Related Jira: KAN-611, 597"

bd create --title "Fix enrollment creation errors (400/500)" --type bug --priority 1 --description "Error adding enrollments to active sessions. Related Jira: KAN-610, 624"

bd create --title "Debug free trial email delivery" --type bug --priority 1 --description "Emails queued but not received. Related Jira: KAN-592"

bd create --title "Fix email links using localhost instead of production URL" --type bug --priority 1 --description "Email links redirect to localhost. Related Jira: KAN-600"

bd create --title "Fix customer table not showing data" --type bug --priority 1 --description "Customer table empty despite data existing. Related Jira: KAN-618"

bd create --title "Fix tour duplication on creation" --type bug --priority 1 --description "Tours duplicating when created. Video evidence. Related Jira: KAN-614"

# P2 Issues
bd create --title "Add change password feature for team members" --type feature --priority 2 --description "No way to change password currently. Related Jira: KAN-613"

bd create --title "Add CSV import templates" --type feature --priority 2 --description "Downloadable CSV templates for imports. Related Jira: KAN-616"

bd create --title "Investigate and fix free trial homepage visibility" --type bug --priority 2 --description "Free trial visibility issues on homepage. Related Jira: KAN-612"

bd create --title "Fix discount code validation UX" --type bug --priority 2 --description "Max 100% validation, error in wrong place. Related Jira: KAN-622"

bd create --title "Improve import error messages" --type task --priority 2 --description "Make import errors user-friendly. Related Jira: KAN-617"

bd create --title "Fix price plan table default selection and multi-create" --type bug --priority 2 --description "Can't create multiple plans, wrong default. Related Jira: KAN-619, 620"

bd create --title "Implement soft delete or cascade for tours/dive sites" --type feature --priority 2 --description "Can't delete due to foreign keys. Related Jira: KAN-601, 604"
```
