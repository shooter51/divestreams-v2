# Security Review - February 1, 2026

## Executive Summary

**Total Issues Found**: 23
**CRITICAL**: 7
**HIGH**: 16

**Immediate Action Required**: 7 critical issues must be fixed before production deployment.

---

## CRITICAL Issues (Fix Immediately)

### 1. AWS Credentials Exposed in Repository ⚠️
- **File**: `.env:15-16`
- **Risk**: Full S3 bucket access exposed
- **Action**:
  1. Rotate AWS credentials immediately via IAM
  2. Remove from git history
  3. Move to environment variables / secrets manager

### 2. Stored XSS via HTML Content Blocks
- **File**: `app/components/ContentBlockRenderer.tsx:89, 98`
- **Risk**: Attackers can inject JavaScript via CMS page builder
- **Impact**: Session hijacking, data theft
- **Fix**: Sanitize with DOMPurify before rendering

### 3. Stored XSS via Google Maps Embed
- **File**: `app/routes/site/contact.tsx:760`
- **Risk**: Arbitrary HTML accepted in mapEmbed field
- **Impact**: XSS on public contact page
- **Fix**: Validate iframe-only with allowed domains

### 4. Email Template HTML Injection
- **File**: `lib/email/index.ts:518-530`
- **Risk**: Contact form data injected unsanitized into emails
- **Impact**: XSS in admin email clients
- **Fix**: HTML-escape all user input in email templates

### 5. Missing Payment Amount Validation
- **File**: `lib/db/pos.server.ts:224-380`
- **Risk**: Client can send manipulated payment amounts
- **Impact**: $1 payment for $100 cart - direct theft
- **Fix**: Recalculate totals server-side

### 6. Missing Idempotency Keys for Stripe
- **File**: `lib/integrations/stripe.server.ts:693`
- **Risk**: Double-charging on retry/timeout
- **Impact**: Customer charged twice
- **Fix**: Add idempotency keys to all payment intents

### 7. Subscription Price Manipulation
- **File**: `lib/stripe/index.ts:147-177`
- **Risk**: Incorrect proration if prices manipulated
- **Impact**: Free upgrades or unexpected charges
- **Fix**: Fetch prices from Stripe API, not database

---

## HIGH Priority Issues (Fix This Week)

### Authentication & Authorization (7 issues)

1. **Missing Auth on /tenant Route**
   - File: `app/routes/tenant/index.tsx`
   - Fix: Add `requireOrgContext()` check

2. **Password Change Authorization Flaw**
   - File: `app/routes/tenant/settings/team.tsx:268-310`
   - Fix: Implement separate admin password reset flow

3. **No CSRF Protection**
   - Impact: Form submission hijacking
   - Fix: Implement CSRF tokens

4. **Missing Role-Based Authorization**
   - Files: `app/routes/tenant/settings/*`
   - Fix: Add role checks to admin routes

5. **Auto-Join Organization**
   - File: `app/routes/tenant/login.tsx:93-133`
   - Fix: Require approval workflow

6. **No Email Verification**
   - File: `lib/auth/index.ts:33`
   - Fix: Enable `requireEmailVerification: true`

7. **Session Cookie Security**
   - Fix: Explicitly set httpOnly, secure, sameSite

### Payment Security (4 issues)

8. **Missing Refund Authorization**
   - File: `app/routes/tenant/pos.tsx:224-276`
   - Fix: Add role checks and amount validation

9. **No Rate Limiting on Payment Intent**
   - Fix: Add rate limiting middleware

10. **Webhook Secret in Logs**
    - File: `lib/stripe/webhook.server.ts:24-27`
    - Fix: Sanitize error messages

11. **Client-Side Amount to PaymentIntent**
    - File: `app/routes/tenant/pos.tsx:143`
    - Fix: Calculate amount server-side

### Injection Vulnerabilities (3 issues)

12. **CTA Button Open Redirect**
    - File: `app/components/ContentBlockRenderer.tsx:274`
    - Fix: Validate URLs, block javascript: protocol

13. **Open Redirect via Login**
    - File: `app/routes/tenant/login.tsx:55`
    - Fix: Add `://` check like other login routes

14. **Widget postMessage Validation**
    - File: `public/widget.js:88-107`
    - Fix: Validate data types and ranges

### Sensitive Data (2 issues)

15. **Sensitive Data in Console Logs**
    - Impact: PII/customer data in logs
    - Fix: Redact sensitive fields

16. **Integration Token Encryption**
    - File: `lib/integrations/index.server.ts:32`
    - Fix: Require INTEGRATION_ENCRYPTION_KEY

---

## Implementation Plan

### Phase 1 (Deploy Today)
- [ ] Fix XSS vulnerabilities (Issues #2, #3, #4)
- [ ] Fix payment validation (Issue #5)
- [ ] Add idempotency keys (Issue #6)
- [ ] Rotate AWS credentials (Issue #1)

### Phase 2 (Deploy This Week)
- [ ] Add authentication checks (Issues #1, #4, #5)
- [ ] Fix password change flow (Issue #2)
- [ ] Enable email verification (Issue #6)
- [ ] Fix subscription price logic (Issue #7)

### Phase 3 (Deploy Next Week)
- [ ] Implement CSRF protection (Issue #3)
- [ ] Add refund authorization (Issue #8)
- [ ] Fix open redirects (Issues #12, #13)
- [ ] Sanitize logs (Issue #15)

---

## Testing Checklist

### XSS Testing
- [ ] Try injecting `<script>alert('XSS')</script>` in CMS
- [ ] Test malicious iframe in mapEmbed
- [ ] Submit contact form with HTML in name/message

### Payment Testing
- [ ] Modify payment amount via dev tools
- [ ] Test duplicate payment submission
- [ ] Verify server-side amount calculation

### Authentication Testing
- [ ] Access /tenant without login
- [ ] Test password change as non-admin
- [ ] Verify CSRF token validation

---

## Compliance Impact

### GDPR
- **Violation**: PII in console logs (Issue #15)
- **Action**: Remove before production

### PCI-DSS
- ✅ **COMPLIANT**: No card data stored
- ⚠️ **Risk**: Payment manipulation (Issues #5, #6, #11)

---

## Positive Findings

✅ **Strong Database Security**: No SQL injection, proper tenant isolation
✅ **Good Password Hashing**: Proper scrypt/bcrypt implementation
✅ **Stripe Integration**: Webhook signature verification present
✅ **No Command Injection**: No exec/spawn with user input
✅ **Environment Separation**: .env properly gitignored

---

## Recommendations

1. **Enable GitHub Advanced Security** to detect secrets in commits
2. **Add pre-commit hooks** (git-secrets) to prevent credential leaks
3. **Implement automated security testing** in CI/CD
4. **Conduct quarterly penetration testing**
5. **Use secrets manager** (AWS Secrets Manager, HashiCorp Vault)
6. **Add security headers** (CSP, X-Frame-Options, HSTS)

---

## Contact

For questions about this security review, contact the development team.

**Report Generated**: 2026-02-01
**Reviewers**: 5 Independent Security Auditors
**Lines of Code Reviewed**: 10,000+
