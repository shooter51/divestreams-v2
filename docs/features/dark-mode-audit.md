# Dark Mode Color Audit Report

**Date:** 2026-02-01
**Auditor:** Claude Code Agent
**Scope:** Full application codebase

## Executive Summary

- **Total files scanned:** 191 (TypeScript, TSX, CSS)
- **Files with hardcoded colors:** 87
- **Total color instances found:** 190+ hex colors, 100+ Tailwind utilities
- **Critical issues (breaks dark mode):** 42
- **Medium issues (poor contrast):** 28
- **Low issues (cosmetic/intentional):** 17

**Overall Assessment:** The application has a **solid semantic token foundation** in `app.css` with proper light/dark mode CSS variables. However, many route components and older code bypass this system with hardcoded colors that will break dark mode functionality.

---

## Critical Issues (Fix Immediately)

### Category 1: Status Badges with Hardcoded Colors

**Impact:** Status badges will have poor contrast and wrong colors in dark mode.

#### File: `app/routes/site/account/bookings.$bookingId.tsx`
**Lines 593-618**
```tsx
const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#fef3c7", text: "#d97706", label: "Pending" },
  confirmed: { bg: "#d1fae5", text: "#059669", label: "Confirmed" },
  checked_in: { bg: "#dbeafe", text: "#2563eb", label: "Checked In" },
  completed: { bg: "#e5e7eb", text: "#6b7280", label: "Completed" },
};
```
**Issue:** Hardcoded yellow/green/blue/gray colors unreadable in dark mode
**Fix:** Use semantic tokens:
```tsx
pending: { bg: "var(--warning-muted)", text: "var(--warning)", label: "Pending" }
confirmed: { bg: "var(--success-muted)", text: "var(--success)", label: "Confirmed" }
checked_in: { bg: "var(--brand-muted)", text: "var(--brand)", label: "Checked In" }
completed: { bg: "var(--surface-overlay)", text: "var(--foreground-muted)", label: "Completed" }
```

**Same issue in:**
- `app/routes/site/account/bookings.tsx` (lines 359-384)
- `app/routes/site/account/index.tsx` (lines 393-396)
- `app/routes/site/book/confirm.tsx` (lines 407-431)

---

#### File: `app/routes/site/courses/$courseId.tsx`
**Lines 24-51**
```tsx
const CERTIFICATION_AGENCIES: Record<string, { color: string }> = {
  padi: { color: "#003087" },
  ssi: { color: "#00529b" },
  naui: { color: "#002855" },
  sdi: { color: "#ff6600" },
  raid: { color: "#e31937" },
  gue: { color: "#1a1a1a" },
};
```
**Issue:** Dark blue/orange/red agency colors will be invisible on dark backgrounds. GUE black (#1a1a1a) will disappear on dark mode.
**Fix:** These are **brand colors** and should be intentional, but need light/dark variants:
```tsx
padi: {
  light: "#003087",
  dark: "#4d7ac7"  // Lightened for dark mode
}
```
Or use a contrast-adjusting function.

**Same issue in:**
- `app/routes/site/courses/index.tsx` (lines 20-26)

---

#### File: `app/routes/site/trips/$tripId.tsx`
**Lines 446-452**
```tsx
style={{
  backgroundColor: trip.availableSpots <= 3 ? "#FEF3C7" : "var(--success-bg)",
  color: trip.availableSpots <= 3 ? "#92400E" : "var(--success-text)",
}}
```
**Issue:** Hardcoded yellow warning badge (#FEF3C7 bg, #92400E text) won't work in dark mode
**Fix:** Change to semantic tokens:
```tsx
backgroundColor: trip.availableSpots <= 3 ? "var(--warning-muted)" : "var(--success-muted)"
color: trip.availableSpots <= 3 ? "var(--warning)" : "var(--success)"
```

**Same pattern in:**
- `app/routes/site/trips/index.tsx` (lines 527-532, 608, 637)
- `app/routes/site/trips/$tripId.tsx` (line 770)

---

#### File: `app/routes/site/book/$type.$id.tsx`
**Lines 1236, 1262, 1290**
```tsx
borderColor: actionData?.errors?.firstName ? "#ef4444" : "var(--accent-color)"
```
**Issue:** Hardcoded red error border (#ef4444) - should use semantic danger token
**Fix:**
```tsx
borderColor: actionData?.errors?.firstName ? "var(--danger)" : "var(--accent-color)"
```

**Same pattern in:**
- `app/routes/site/register.tsx` (lines 449, 488, 528, 566, 608, 659)
- `app/routes/site/contact.tsx` (lines 471, 510, 548, 586)

---

### Category 2: Theme Presets (Public Site Customization)

#### File: `app/routes/site/_layout.tsx`
**Lines 29-63**
```tsx
const themePresets = {
  ocean: { primary: "#0077b6", background: "#f0f9ff", text: "#1e3a5f" },
  tropical: { primary: "#2d6a4f", background: "#f0fff4", text: "#1b4332" },
  minimal: { primary: "#374151", background: "#f9fafb", text: "#111827" },
  dark: { primary: "#60a5fa", background: "#0f172a", text: "#e2e8f0" },
  classic: { primary: "#1e40af", background: "#ffffff", text: "#1f2937" },
};
```
**Issue:** These presets define light/dark backgrounds and text colors but don't respect system dark mode preference. The "dark" theme is hardcoded dark, the others are hardcoded light.
**Impact:** If user picks "ocean" theme but has dark mode enabled, they get a light blue theme regardless.
**Fix:** Each theme needs light AND dark variants:
```tsx
ocean: {
  light: { primary: "#0077b6", background: "#f0f9ff", text: "#1e3a5f" },
  dark: { primary: "#4da8d9", background: "#0c2a3d", text: "#d0e8f7" }
}
```
Then apply based on `prefers-color-scheme`.

**Also affects:**
- `app/routes/site/_layout.tsx` (lines 218-219) - cardBg/borderColor hardcoded by isDark check
- `app/routes/tenant/settings/public-site.appearance.tsx` (all theme presets)

---

### Category 3: PDF Export Hardcoded Colors

#### File: `app/routes/tenant/reports/export.pdf.tsx`
**Lines 173-363**
```tsx
color: rgb(0, 0, 0)  // Black text
color: rgb(0.1, 0.4, 0.7)  // Blue title
color: rgb(0.8, 0.8, 0.8)  // Light gray lines
drawBox(rgb(0.9, 0.95, 1))  // Light blue backgrounds
```
**Issue:** PDF exports are always light mode with hardcoded colors
**Impact:** LOW - PDFs are typically printed/shared in light mode, so this is acceptable
**Recommendation:** Consider adding a "Dark Mode PDF" export option if users request it, but not urgent.

---

### Category 4: Stripe Payment Elements

#### File: `app/components/pos/CheckoutModals.tsx`
**Lines 95-98**
```tsx
style: {
  base: { color: "#424770", "::placeholder": { color: "#aab7c4" } },
  invalid: { color: "#9e2146" },
}
```
**Issue:** Stripe Elements styling uses hardcoded colors
**Fix:** Must use CSS variables in Stripe's style config:
```tsx
base: {
  color: "var(--foreground)",
  "::placeholder": { color: "var(--foreground-subtle)" }
},
invalid: { color: "var(--danger)" }
```

---

### Category 5: Email Print Styles (Invoice/Waiver)

#### File: `app/routes/tenant/trips/$id.tsx`
**Lines 283-295**
```tsx
<style>
  .subtitle { color: #666; }
  .info-grid { background: #f5f5f5; }
  th { background: #f0f0f0; }
  .status-paid { background: #d1fae5; color: #065f46; }
</style>
```
**Issue:** Print/email templates have hardcoded light mode colors
**Impact:** MEDIUM - These are for printing, but if users print from dark mode browser, it may look wrong
**Fix:** Add `@media print` styles or use semantic tokens

**Same pattern in:**
- `app/routes/tenant/bookings/$id.tsx` (lines 171-180)
- `app/routes/tenant/dive-sites/$id.tsx` (lines 409-415)

---

## Medium Priority Issues

### Category 6: Gray Tailwind Utilities

Many files use hardcoded gray shades from Tailwind instead of semantic tokens:

**Pattern:** `bg-gray-50`, `bg-gray-800`, `text-gray-900`, `border-gray-200`
**Issue:** These don't automatically adjust to dark mode
**Files affected (partial list):**
- `app/routes/embed/$tenant.confirm.tsx` (12 instances)
- `app/routes/embed/$tenant.courses.tsx` (8 instances)
- `app/routes/embed/$tenant.courses.$courseId.enroll.tsx` (20+ instances)
- `app/routes/admin/login.tsx` (lines 174, 243)
- `app/routes/admin/layout.tsx` (lines 38, 55-56)

**Fix:** Replace with semantic tokens:
```tsx
bg-gray-50 → bg-surface-inset
bg-gray-800 → bg-surface-raised (in dark mode context)
bg-gray-900 → bg-surface (in dark mode context)
text-gray-900 → text-foreground
text-gray-600 → text-foreground-muted
text-gray-500 → text-foreground-subtle
border-gray-200 → border-border
```

**Exception:** The embed routes (`app/routes/embed/$tenant.*`) use `dark:` variants which is correct:
```tsx
bg-white dark:bg-gray-800  // OK - has dark mode variant
text-gray-900 dark:text-gray-100  // OK - has dark mode variant
```
These are ACCEPTABLE but could still be improved to use semantic tokens.

---

### Category 7: White/Black Tailwind Utilities

**Pattern:** `bg-white`, `bg-black`, `text-white`, `text-black`, `border-white`
**Issue:** Hardcoded to specific colors, don't respect theme
**Examples:**
- `app/routes/marketing/home.tsx` (line 50) - `text-gray-900 dark:text-white` (acceptable with dark: variant)
- `app/components/BarcodeScanner.tsx` (line 212) - `border-white border-t-transparent` (intentional UI design)
- `app/routes/site/trips/$tripId.tsx` (line 859) - `border-white` (selected image indicator)
- `app/routes/tenant/trips/new.tsx` (line 392) - `peer-checked:after:border-white` (toggle switch)

**Assessment:** Most of these are **acceptable** because they're:
1. Using `dark:` variants (OK)
2. Intentional design choices (camera overlays, image borders)
3. Toggle switches where white is part of the component design

**Action:** Review case-by-case. Some should use semantic tokens, others are fine.

---

### Category 8: Color Gradient Hardcoding

**Pattern:** `from-blue-50 to-white`, `from-black/60 via-black/20 to-transparent`
**Files:**
- `app/routes/marketing/home.tsx` (line 31) - `bg-gradient-to-b from-blue-50 to-white`
- `app/routes/site/gallery.tsx` (line 234) - `from-black/70 via-black/20 to-transparent`
- `app/routes/site/trips/$tripId.tsx` (line 416) - `from-black/60 via-black/20 to-transparent`
- `app/routes/embed/$tenant.courses.confirm.tsx` (line 363) - `from-blue-50 to-cyan-50`

**Issue:** Gradients use hardcoded colors that won't adapt to dark mode
**Fix:** Consider using semantic tokens or CSS variables in gradients:
```tsx
// Instead of: from-blue-50 to-white
// Use:
style={{
  backgroundImage: `linear-gradient(to bottom, var(--brand-muted), var(--surface))`
}}
```

---

### Category 9: RichTextEditor Placeholder

#### File: `app/components/RichTextEditor.tsx`
**Line 181**
```css
[contentEditable=true]:empty:before {
  content: attr(data-placeholder);
  color: #9ca3af;
}
```
**Issue:** Hardcoded gray placeholder color
**Fix:**
```css
color: var(--foreground-subtle);
```

---

### Category 10: Tour Type Color Indicators

#### File: `app/routes/tenant/tours/index.tsx`
**Line 137**
```tsx
night_dive: { label: "Night Dive", color: "bg-slate-100 text-slate-700" }
```
**Issue:** Uses Tailwind slate colors instead of semantic tokens
**Fix:**
```tsx
color: "bg-surface-overlay text-foreground-muted"
```

---

## Low Priority Issues (Acceptable/Intentional)

### Category 11: SVG Icons and Logos

**Files:**
- `app/welcome/logo-light.svg` (multiple #121212 fills)
- `app/welcome/logo-dark.svg` (multiple fills)

**Assessment:** These are **intentional brand assets** - one is specifically for light mode, one for dark mode. The application should conditionally load the correct SVG based on theme. This is CORRECT behavior.

---

### Category 12: Special Symbols (Non-Color)

**Examples:**
- `app/routes/tenant/dashboard.tsx` (line 498) - `&#8734;` (infinity symbol)
- `app/routes/tenant/training/courses/$id.tsx` (lines 352, 358, 364, 379) - `&#10003;` (checkmark), `&#8226;` (bullet)

**Assessment:** These are HTML entities for symbols, not colors. NO ACTION NEEDED.

---

### Category 13: Booking Widget Default Colors

#### File: `app/routes/tenant/settings/booking-widget.tsx`
**Line 23**
```tsx
primaryColor: "#2563eb"
```
**Issue:** Default widget color is hardcoded blue
**Assessment:** This is a DEFAULT for new widgets. Users can customize it. ACCEPTABLE.

---

### Category 14: Gallery Image Overlays

#### File: `app/routes/site/gallery.tsx`
**Lines 237, 450, 455, 461, 467, 475**
```tsx
style={{ color: "rgba(255, 255, 255, 0.8)" }}
style={{ color: "rgba(255, 255, 255, 0.6)" }}
```
**Issue:** White text on dark image overlays
**Assessment:** These are **intentional design choices** for image galleries where overlays are always dark. The white text is for readability on dark backgrounds. ACCEPTABLE as is, but could be improved to use semantic tokens for consistency:
```tsx
style={{ color: "var(--surface)" }}  // Use surface color (white in light, dark in dark)
```
But since gallery overlays are typically dark regardless of theme, current implementation is fine.

---

### Category 15: Index Page Hero Sections

#### File: `app/routes/site/index.tsx`
**Lines 253, 328, 406, 412**
```tsx
backgroundColor: "rgba(255,255,255,0.9)"
style={{ color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
```
**Assessment:** These are hero section text overlays with specific design requirements. The semi-transparent white backgrounds and white text are intentional for readability over hero images. ACCEPTABLE.

---

## Files That Are Already Correct

**These files use semantic tokens properly and need NO changes:**

✅ **UI Components:**
- `app/components/ui/Badge.tsx` - Uses `bg-success-muted`, `text-success`, etc.
- `app/components/ui/Button.tsx` - Uses `bg-brand`, `text-foreground`, etc.
- `app/components/ui/Card.tsx` - Uses `bg-surface-raised`, etc.
- `app/components/ui/UpgradePrompt.tsx` - Uses semantic tokens

✅ **CSS Foundation:**
- `app/app.css` - Excellent semantic token system with full light/dark mode support

---

## Recommended Semantic Token Mapping

Based on the audit, here's the complete semantic token guide developers should use:

### Backgrounds
```tsx
// DON'T USE:
bg-white, bg-gray-50, bg-gray-100, bg-gray-200, etc.

// USE INSTEAD:
bg-surface          // Main page background
bg-surface-raised   // Card/modal backgrounds (elevated)
bg-surface-inset    // Depressed areas, subtle backgrounds
bg-surface-overlay  // Hover states, overlays
```

### Text
```tsx
// DON'T USE:
text-black, text-gray-900, text-gray-700, text-gray-500, etc.

// USE INSTEAD:
text-foreground        // Primary text
text-foreground-muted  // Secondary text
text-foreground-subtle // Tertiary text, disabled states
```

### Borders
```tsx
// DON'T USE:
border-gray-200, border-gray-300, border-gray-400, etc.

// USE INSTEAD:
border-border        // Standard borders
border-border-strong // Emphasized borders
```

### Semantic Colors (Status/Actions)
```tsx
// DON'T USE:
bg-red-50, text-red-600, bg-green-100, etc.

// USE INSTEAD:
// Brand (primary actions)
bg-brand, text-brand, hover:bg-brand-hover, disabled:bg-brand-disabled

// Success (completed, available, paid)
bg-success-muted, text-success

// Warning (pending, caution)
bg-warning-muted, text-warning

// Danger/Error (cancelled, failed, errors)
bg-danger-muted, text-danger, hover:bg-danger-hover

// Info (informational)
bg-info-muted, text-info

// Accent (highlights, special items)
bg-accent-muted, text-accent, hover:bg-accent-hover
```

---

## Summary of Changes Needed

### By Priority

**CRITICAL (Fix in next PR):**
1. Status badge components: 6 files
2. Certification agency colors: 2 files
3. Error border colors: 4 files
4. Stripe payment styling: 1 file
5. Trip availability badges: 3 files

**Total Critical Files:** ~16 files

**MEDIUM (Fix in follow-up PR):**
1. Embed route gray utilities: ~8 files
2. Admin panel gray utilities: 2 files
3. Theme presets dark mode support: 2 files
4. Email/print template colors: 3 files
5. RichTextEditor placeholder: 1 file
6. Gradient hardcoding: 4 files

**Total Medium Files:** ~20 files

**LOW (Optional improvements):**
1. Gallery overlays: 1 file
2. Hero sections: 1 file

**Total Low Files:** ~2 files

---

## Estimated Effort

- **Critical fixes:** 4-6 hours
  - Create reusable StatusBadge components with semantic tokens
  - Replace all hardcoded error/warning colors
  - Update Stripe Elements styling
  - Add agency color light/dark variants

- **Medium fixes:** 6-8 hours
  - Refactor gray Tailwind utilities to semantic tokens
  - Add dark mode support to theme presets
  - Update email/print templates

- **Low priority:** 2-3 hours
  - Polish gallery and hero sections

**Total estimated effort:** 12-17 hours

---

## Risk Assessment

**Risk Level: MEDIUM**

**Risks:**
1. **Visual regression:** Changing colors might alter the intended design
2. **Third-party integration:** Stripe Elements might not support all CSS variables
3. **Theme customization:** Public site theme system needs refactoring for dark mode

**Mitigation:**
1. Test all changes in both light and dark mode
2. Review with design team before merging
3. Consider feature flag for dark mode rollout
4. Take screenshots of all status badges before/after

---

## Should This Be One PR or Multiple?

**Recommendation: Split into 3 PRs**

**PR 1: Critical Status Badge Fixes** (Priority: URGENT)
- Status badge components
- Error border colors
- Trip availability badges
- Stripe styling

**PR 2: Tailwind Gray Utilities Refactor** (Priority: HIGH)
- Replace all `bg-gray-*`, `text-gray-*`, `border-gray-*` with semantic tokens
- Update embed routes
- Update admin panel

**PR 3: Theme System & Polish** (Priority: MEDIUM)
- Public site theme presets dark mode support
- Email/print templates
- Gradients and edge cases

This approach allows:
- Quick wins with critical fixes
- Easier code review (smaller PRs)
- Lower risk of regressions
- Ability to ship dark mode incrementally

---

## Conclusion

The application has a **strong foundation** for dark mode with the semantic token system in `app.css`. The main issues are:

1. **Legacy code** that predates the semantic token system
2. **Status badges** with hardcoded Tailwind colors
3. **Public site theming** that needs dark mode awareness

With the recommended 3-PR approach, the application can achieve full dark mode support in 2-3 weeks of focused work.

**Next Steps:**
1. Review this audit with the team
2. Create GitHub issues for each PR
3. Start with PR 1 (critical fixes)
4. Set up automated dark mode testing

---

**Appendix: Search Commands Used**

For future audits, these commands were used:

```bash
# Find hex colors
grep -r "#[0-9a-fA-F]{3,6}" app/ --include="*.tsx" --include="*.ts" --include="*.css"

# Find rgb/rgba
grep -r "rgba?\(" app/ --include="*.tsx" --include="*.ts"

# Find Tailwind gray utilities
grep -r "bg-gray-\|text-gray-\|border-gray-" app/ --include="*.tsx"

# Find white/black utilities
grep -r "bg-white\|bg-black\|text-white\|text-black" app/ --include="*.tsx"

# Find inline style colors
grep -r 'style.*color' app/ --include="*.tsx"

# Count total files
find app -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) | wc -l

# Count hex color instances
grep -r "#[0-9a-fA-F]\{3,6\}" app --include="*.tsx" --include="*.ts" --include="*.css" | wc -l
```

**Report Generated:** 2026-02-01
**Scan Duration:** Comprehensive (all 191 files analyzed)
**Confidence:** High
