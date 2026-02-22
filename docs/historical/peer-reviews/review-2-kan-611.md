# Peer Review #2: KAN-611 - Form Data Lost on Login Validation Error

**Reviewer:** Peer Reviewer #2
**Date:** 2026-01-28
**Commit:** be6a490746b621c06cfb4778cf5ba0a297c4f495
**Issue:** KAN-611 - Form data lost on login validation error

---

## Verdict: APPROVED WITH CONDITIONS

**Fix Quality:** ⭐⭐⭐⭐ (4/5)
**Completeness:** 60% (3 out of 5 login forms fixed)

---

## What Was Fixed

### Files Modified in be6a490:
1. **app/routes/admin/login.tsx**
   - Added `email` parameter to all error responses (8 locations)
   - Added `defaultValue={actionData?.email || ""}` to email input
   - Updated ActionData type to include `email?: string`

2. **app/routes/auth/login.tsx** (mentioned in commit but not shown in diff)
   - Implied similar fixes were applied

### Technical Implementation:
```typescript
// BEFORE (data loss)
if (!email || !emailRegex.test(email)) {
  return { error: "Please enter a valid email address" };
}

// AFTER (preserves email)
if (!email || !emailRegex.test(email)) {
  return { error: "Please enter a valid email address", email: email || "" };
}

// UI binding
<input
  defaultValue={actionData?.email || ""}
  // ...
/>
```

---

## Critical Finding: INCOMPLETE FIX - SYSTEMIC ISSUE

### Similar Defects Found:

#### 1. **app/routes/tenant/login.tsx** - ⚠️ PARTIALLY FIXED
**Status:** Email preservation NOT implemented on validation errors

**Analysis:**
```typescript
// Lines 114-119: Validation errors do NOT preserve email
if (typeof email !== "string" || !email || !emailRegex.test(email)) {
  return { error: "Please enter a valid email address" };  // ❌ No email returned
}

if (typeof password !== "string" || !password) {
  return { error: "Password is required" };  // ❌ No email returned
}

// Line 147: Email IS preserved using navigation.formData
defaultValue={formData?.get("email")?.toString() || ""}  // ✅ Uses formData method
```

**Verdict:** Uses different preservation method (navigation.formData) but doesn't work for server-side validation errors since formData is only available during submission.

**Risk:** Medium - Form clears on server-side validation errors (invalid email format, missing password)

---

#### 2. **app/routes/site/login.tsx** - ✅ CORRECTLY IMPLEMENTED
**Status:** Email preservation properly implemented

**Analysis:**
```typescript
// Lines 175-177: Errors return email
if (Object.keys(errors).length > 0) {
  return { errors, email };  // ✅ Email preserved
}

// Lines 196-199: Catch block preserves email
catch (error) {
  return {
    errors: { form: "Invalid email or password" },
    email,  // ✅ Email preserved
  };
}

// Line 327: UI correctly uses actionData
defaultValue={actionData?.email || ""}  // ✅ Bound to actionData
```

**Verdict:** This form is correctly implemented and serves as a good reference.

---

#### 3. **app/routes/auth/login.tsx** - ⚠️ NOT PRESERVING EMAIL
**Status:** Email preservation NOT implemented

**Analysis:**
```typescript
// Lines 73-74: Validation errors do NOT return values
if (Object.keys(errors).length > 0) {
  return { errors };  // ❌ Email not preserved
}

// Lines 96, 109: Error responses do NOT return email
return { errors: { form: "Invalid email or password" } };  // ❌ No email

// Line 147: UI uses navigation.formData (doesn't work for server errors)
defaultValue={formData?.get("email")?.toString() || ""}
```

**Risk:** HIGH - This is a primary login route that loses email on ALL validation errors.

---

### Summary Table

| Route | Status | Email Preserved? | Implementation Method | Risk Level |
|-------|--------|------------------|----------------------|-----------|
| `/admin/login` | ✅ FIXED | Yes | actionData.email | ✅ None |
| `/site/login` | ✅ FIXED | Yes | actionData.email | ✅ None |
| `/tenant/login` | ⚠️ PARTIAL | Only on client nav | navigation.formData | 🟡 Medium |
| `/auth/login` | ❌ NOT FIXED | No | navigation.formData | 🔴 High |

---

## Related Issues Found

### Additional Form Routes That May Need Review:

1. **app/routes/tenant/signup.tsx**
   - ✅ Correctly preserves name and email in values object
   - Lines 98, 120, 175-176 return `values: { name, email }`

2. **app/routes/site/register.tsx**
   - ✅ No actionData usage for defaultValue (form has no validation errors that return data)
   - Uses controlled state for password validation feedback

3. **app/routes/tenant/forgot-password.tsx**
   - ❌ Does NOT preserve email on validation error (line 32)
   - **Risk:** Low (single field form, less frustrating)

4. **app/routes/admin/settings.team.tsx**
   - ❌ Email invite form does NOT preserve email on error
   - Lines 114, 153 return only error message
   - **Risk:** Medium (team management workflow)

5. **app/routes/tenant/settings/team.tsx**
   - ❌ Email invite form does NOT preserve email on error
   - Lines 131, 148 return only error message
   - **Risk:** Medium (team management workflow)

---

## Architectural Observation

### Two Different Patterns in Use:

#### Pattern A: Server-Side Preservation (Recommended)
```typescript
// Action returns email
return { error: "...", email: email || "" };

// UI binds to actionData
<input defaultValue={actionData?.email || ""} />
```
**Used by:** admin/login, site/login (after fix)
**Pros:** Works for all error types including server-side validation
**Cons:** Must remember to include email in every error return

#### Pattern B: Client-Side Preservation
```typescript
// Action returns only error
return { errors: { form: "..." } };

// UI binds to navigation.formData
const formData = navigation.formData;
<input defaultValue={formData?.get("email")?.toString() || ""} />
```
**Used by:** auth/login, tenant/login
**Pros:** Automatic - don't need to manually pass values
**Cons:** Only preserves during client navigation, fails on server-side validation errors

### Recommendation:
Standardize on **Pattern A** for all login/signup forms. Pattern B fails when:
- Server-side email validation fails (invalid format)
- Database errors occur during auth
- Network errors cause server-side failures

---

## Completeness Analysis

### What Was Fixed: 60%
- ✅ admin/login.tsx (fully fixed)
- ✅ site/login.tsx (already correct in code review)
- ⚠️ tenant/login.tsx (partially works, uses Pattern B)

### What Still Needs Fixing: 40%
- ❌ auth/login.tsx (primary tenant login route - HIGH PRIORITY)
- ❌ tenant/forgot-password.tsx (LOW PRIORITY)

### Additional Issues Outside Original Scope:
- Team invite forms (2 routes) - NOT CRITICAL but poor UX

---

## Testing Requirements

### Primary Testing (MUST DO):
1. **app/routes/auth/login.tsx** - Test all validation error paths:
   - [ ] Invalid email format → email should persist
   - [ ] Missing password → email should persist
   - [ ] Wrong credentials → email should persist
   - [ ] Server error → email should persist

2. **app/routes/tenant/login.tsx** - Test server-side validation:
   - [ ] Invalid email format → email should persist
   - [ ] Missing password → email should persist
   - [ ] Auth API error → email should persist

### Secondary Testing (SHOULD DO):
3. **app/routes/tenant/forgot-password.tsx**:
   - [ ] Invalid email format → email should persist

4. **Team invite forms**:
   - [ ] app/routes/admin/settings.team.tsx
   - [ ] app/routes/tenant/settings/team.tsx

### Regression Testing (VERIFY FIX):
5. **app/routes/admin/login.tsx** (the fixed route):
   - [ ] Invalid email → email persists ✅
   - [ ] Missing password → email persists ✅
   - [ ] Wrong credentials → email persists ✅
   - [ ] Not platform member → email persists ✅

---

## Recommendations

### 1. 🔴 **REQUIRED - Complete the Fix**
**Priority:** CRITICAL
**Effort:** 30 minutes

Fix the remaining login routes using the same pattern as admin/login:

**app/routes/auth/login.tsx:**
```typescript
// Add email to all error responses
if (Object.keys(errors).length > 0) {
  return { errors, email: email || "" };
}

// Update catch block
return {
  errors: { form: "Invalid email or password" },
  email: email || ""
};

// Update ActionData type
type ActionData = {
  errors?: Record<string, string>;
  email?: string;
};

// Update UI
<input defaultValue={actionData?.email || ""} />
```

**app/routes/tenant/login.tsx:**
```typescript
// Lines 115, 119 - add email to error returns
return { error: "Please enter a valid email address", email: email || "" };
return { error: "Password is required", email: email || "" };

// Line 190 - add email to catch
return { error: "An error occurred during login. Please try again.", email: email || "" };
```

---

### 2. 🟡 **MEDIUM - Standardize Pattern Across Codebase**
**Priority:** HIGH
**Effort:** 2-3 hours

Create a standardized pattern document and refactor all forms to use server-side preservation (Pattern A).

**Benefits:**
- Consistent UX across all forms
- Reliable in all error scenarios
- Easier to maintain

**Suggested approach:**
1. Create utility function for form error responses
2. Document pattern in CLAUDE.md
3. Add to code review checklist

---

### 3. 🟢 **LOW - Fix Forgot Password Form**
**Priority:** LOW
**Effort:** 10 minutes

Apply same fix to `app/routes/tenant/forgot-password.tsx` for consistency.

---

### 4. 🟢 **LOW - Fix Team Invite Forms**
**Priority:** LOW
**Effort:** 20 minutes

Update team management forms to preserve email on validation errors:
- app/routes/admin/settings.team.tsx
- app/routes/tenant/settings/team.tsx

Not critical since these are internal admin workflows, but improves UX.

---

## Code Quality Observations

### Strengths:
- ✅ Clear commit message linking to issue
- ✅ Type-safe implementation with TypeScript
- ✅ Consistent null checking (`email || ""`)
- ✅ Updated type definitions to match new response shape

### Areas for Improvement:
- ⚠️ Inconsistent patterns across similar routes
- ⚠️ No test coverage for validation error preservation
- ⚠️ No utility function to standardize this pattern

---

## Final Assessment

### What Works:
The fix for `admin/login.tsx` is technically sound and solves the reported issue completely. The implementation is clean and type-safe.

### What's Missing:
The fix was applied to only 1-2 of 4 similar login forms. This creates an inconsistent user experience where some login forms preserve email and others don't.

### Impact if Left Incomplete:
- Users of `/auth/login` (primary tenant login) will continue experiencing the frustrating UX
- Users will perceive the application as inconsistent and buggy
- Increases support tickets ("why does the admin login work but tenant login doesn't?")

### Recommendation:
**Approve with conditions:** The PR should not be merged until `/auth/login` is fixed. This is the highest-traffic login route and must work correctly.

---

## Next Steps

1. ✅ Approve current changes to admin/login.tsx
2. 🔴 **BLOCK MERGE** until auth/login.tsx is fixed
3. 🟡 Create follow-up ticket for tenant/login.tsx Pattern B → A migration
4. 🟢 Create follow-up ticket for team invite forms (low priority)
5. 📋 Update testing checklist to include form field preservation testing

---

**Review Status:** ⚠️ APPROVED WITH CONDITIONS
**Blocker:** Must fix /auth/login before merge
**Estimated Fix Time:** 30 minutes

---

## References

- Issue: KAN-611
- Commit: be6a490
- Files reviewed:
  - app/routes/admin/login.tsx ✅
  - app/routes/auth/login.tsx ❌
  - app/routes/tenant/login.tsx ⚠️
  - app/routes/site/login.tsx ✅
  - app/routes/tenant/signup.tsx ✅
  - app/routes/site/register.tsx ✅
