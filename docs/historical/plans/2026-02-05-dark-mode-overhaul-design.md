# Dark Mode System Overhaul — Complete Design

**Date:** 2026-02-05
**Status:** Approved for Implementation
**Scope:** Full system overhaul with reusable components and regression prevention

## Overview

Complete dark mode implementation across all pages, components, and elements using a three-layer architecture with reusable components, auto-adaptive themes, and prevention mechanisms.

## Architecture

### Layer 1: Foundation (CSS Variables)
- ✅ Already complete in `app.css` with semantic tokens
- Light mode defaults in `:root`, dark mode in `@media (prefers-color-scheme: dark)`
- No changes needed - foundation is solid

### Layer 2: Reusable Components (New)
Create 5 new base components in `app/components/ui/`:
- `StatusBadge.tsx` - Semantic status indicators
- `FormInput.tsx` - Text input with error handling
- `FormSelect.tsx` - Select dropdown with error handling
- `FormTextarea.tsx` - Textarea with error handling
- `ErrorMessage.tsx` - Consistent error message display

### Layer 3: Application Layer (Refactored)
- Replace all hardcoded colors with semantic tokens
- Replace inline form inputs with wrapper components
- Update public site theme system for auto-adaptive dark mode
- Fix Stripe Elements styling
- Update certification agency colors with light/dark variants

## Component Specifications

### 1. StatusBadge Component

**Purpose:** Replace all hardcoded status styling across 6+ files

**API:**
```tsx
<StatusBadge status="pending" />
<StatusBadge status="confirmed" size="sm" />
<StatusBadge status="cancelled" />
```

**Supported Status Types:**
- `pending` → Warning colors (yellow/amber)
- `confirmed` → Success colors (green)
- `checked_in` → Brand colors (blue)
- `completed` → Neutral colors (gray)
- `cancelled` → Danger colors (red)
- `available` → Success colors
- `unavailable` → Danger colors
- `paid` → Success colors
- `unpaid` → Warning colors
- `refunded` → Info colors (purple)

**Size Variants:** `sm`, `md` (default), `lg`

**TypeScript Interface:**
```tsx
export type BadgeStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'available'
  | 'unavailable'
  | 'paid'
  | 'unpaid'
  | 'refunded';

interface StatusBadgeProps {
  status: BadgeStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

**Files to Refactor:**
- `app/routes/site/account/bookings.$bookingId.tsx`
- `app/routes/site/account/bookings.tsx`
- `app/routes/site/account/index.tsx`
- `app/routes/site/book/confirm.tsx`
- `app/routes/tenant/bookings/$id.tsx`
- `app/routes/tenant/trips/$id.tsx`

### 2. FormInput Component

**Purpose:** Consistent input styling with automatic error handling

**API:**
```tsx
<FormInput
  label="Email Address"
  name="email"
  type="email"
  error={actionData?.errors?.email}
  required
  placeholder="you@example.com"
/>
```

**TypeScript Interface:**
```tsx
interface FormInputProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number' | 'date';
  error?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
}
```

**Error Styling (Automatic):**
- Border: `var(--danger)` when error, `var(--border)` when normal
- Background: `var(--danger-muted)` when error
- Text: Always `var(--foreground)` for readability
- Error message: Below input in `var(--danger)` color

### 3. FormSelect Component

**API:**
```tsx
<FormSelect
  label="Country"
  name="country"
  options={[
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' }
  ]}
  error={actionData?.errors?.country}
  required
/>
```

**TypeScript Interface:**
```tsx
interface FormSelectProps {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

### 4. FormTextarea Component

**API:**
```tsx
<FormTextarea
  label="Description"
  name="description"
  rows={4}
  error={actionData?.errors?.description}
  placeholder="Enter description..."
/>
```

**TypeScript Interface:**
```tsx
interface FormTextareaProps {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
}
```

### 5. ErrorMessage Component

**Purpose:** Consistent error message display

**API:**
```tsx
<ErrorMessage error={actionData?.errors?.form} />
```

**TypeScript Interface:**
```tsx
interface ErrorMessageProps {
  error?: string;
  className?: string;
}
```

## Auto-Adaptive Theme System

### Updated Theme Structure

```tsx
export interface ThemeColors {
  name: string;
  // Light mode colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headerBg: string;
  footerBg: string;
  // Dark mode overrides
  dark: {
    primaryColor: string;      // Brighter for dark backgrounds
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;    // Dark background
    textColor: string;          // Light text
    headerBg: string;
    footerBg: string;
    cardBg: string;             // Card surface color
    borderColor: string;        // Border color
  };
}
```

### CSS Generation

The `getThemeStyleBlock()` function generates:

```css
.site-theme {
  --primary-color: #0077B6;      /* Ocean blue (light mode) */
  --background-color: #F0F9FF;
  --text-color: #1E3A5F;
  --color-card-bg: #FFFFFF;
  --color-border: #E5E7EB;
}

@media (prefers-color-scheme: dark) {
  .site-theme {
    --primary-color: #60A5FA;    /* Brighter blue for dark mode */
    --background-color: #030712;  /* Dark background */
    --text-color: #E0F2FE;       /* Light text */
    --color-card-bg: #111827;
    --color-border: #374151;
  }
}
```

### Theme Preset Updates

All 5 themes already have dark properties defined in `lib/themes/public-site-themes.ts`. They need to be wired into CSS generation properly.

**Files to Update:**
- `app/routes/site/_layout.tsx` - Update theme rendering to use dark overrides

## Migration Strategy - Single Pass

### Phase 1: Core Components (Critical)
- Create 5 new UI components (StatusBadge, FormInput, FormSelect, FormTextarea, ErrorMessage)
- Refactor 6 files using status badges
- Fix Stripe Elements styling in `CheckoutModals.tsx`
- Update certification agency colors in `/site/courses/$courseId.tsx` with light/dark variants

### Phase 2: Forms & Validation (Critical)
- Refactor ~20 form files to use new FormInput components
- Replace all hardcoded error borders (`#ef4444` → `var(--danger)`)
- Update inline style validations across booking/registration flows

### Phase 3: Theme System & Gray Utilities (Medium)
- Wire dark mode overrides into public site theme CSS generation
- Replace all `bg-gray-*`, `text-gray-*`, `border-gray-*` with semantic tokens
- Update embed routes (8 files)
- Update admin panel (2 files)
- Fix RichTextEditor placeholder color

### Phase 4: Edge Cases & Polish (Low)
- Update print/email template colors with semantic tokens
- Fix gradient hardcoding with CSS variable gradients
- Review and update any remaining inline style colors
- Add `@media print` styles for proper printing from dark mode

## Files to Update (Complete List)

### Critical Priority (16 files)

**Status Badges:**
1. `app/routes/site/account/bookings.$bookingId.tsx`
2. `app/routes/site/account/bookings.tsx`
3. `app/routes/site/account/index.tsx`
4. `app/routes/site/book/confirm.tsx`
5. `app/routes/tenant/bookings/$id.tsx`
6. `app/routes/tenant/trips/$id.tsx`

**Certification Colors:**
7. `app/routes/site/courses/$courseId.tsx`
8. `app/routes/site/courses/index.tsx`

**Trip Availability:**
9. `app/routes/site/trips/$tripId.tsx`
10. `app/routes/site/trips/index.tsx`

**Error Colors:**
11. `app/routes/site/book/$type.$id.tsx`
12. `app/routes/site/register.tsx`
13. `app/routes/site/contact.tsx`

**Stripe:**
14. `app/components/pos/CheckoutModals.tsx`

**Theme System:**
15. `app/routes/site/_layout.tsx`
16. `lib/themes/public-site-themes.ts`

### Medium Priority (20 files)

**Gray Utilities (Embed Routes):**
1. `app/routes/embed/$tenant.confirm.tsx`
2. `app/routes/embed/$tenant.courses.tsx`
3. `app/routes/embed/$tenant.courses.$courseId.enroll.tsx`
4. `app/routes/embed/$tenant.trips.tsx`
5. `app/routes/embed/$tenant.trips.$tripId.book.tsx`
6. `app/routes/embed/$tenant.book.tsx`
7. `app/routes/embed/$tenant.checkout.tsx`
8. `app/routes/embed/$tenant.payment.tsx`

**Admin Panel:**
9. `app/routes/admin/login.tsx`
10. `app/routes/admin/layout.tsx`

**Forms (Additional):**
11. `app/routes/tenant/customers/new.tsx`
12. `app/routes/tenant/trips/new.tsx`
13. `app/routes/admin/tenants.new.tsx`
14. `app/routes/admin/plans.$id.tsx`
15. `app/routes/admin/settings/user-profile.tsx`

**Other:**
16. `app/components/RichTextEditor.tsx`
17. `app/routes/tenant/tours/index.tsx`
18. `app/routes/tenant/reports/export.pdf.tsx`
19. `app/routes/tenant/dive-sites/$id.tsx`
20. `app/routes/marketing/signup.tsx`

### Low Priority (2 files)

1. `app/routes/site/gallery.tsx`
2. `app/routes/site/index.tsx`

## Preventing Future Regressions

### ESLint Rule

Create custom ESLint rule to block hardcoded colors:

```js
// .eslintrc.js (add to rules)
'no-hardcoded-colors': ['error', {
  allowedPatterns: [
    'transparent',
    'currentColor',
    'inherit'
  ]
}]
```

### TypeScript Utility

```tsx
// lib/utils/theme.ts
export const semanticColors = {
  // Surfaces
  surface: 'var(--surface)',
  surfaceRaised: 'var(--surface-raised)',
  surfaceInset: 'var(--surface-inset)',
  surfaceOverlay: 'var(--surface-overlay)',

  // Foreground
  foreground: 'var(--foreground)',
  foregroundMuted: 'var(--foreground-muted)',
  foregroundSubtle: 'var(--foreground-subtle)',

  // Borders
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',

  // Brand
  brand: 'var(--brand)',
  brandHover: 'var(--brand-hover)',
  brandMuted: 'var(--brand-muted)',
  brandDisabled: 'var(--brand-disabled)',

  // Semantic
  danger: 'var(--danger)',
  dangerHover: 'var(--danger-hover)',
  dangerMuted: 'var(--danger-muted)',
  success: 'var(--success)',
  successMuted: 'var(--success-muted)',
  warning: 'var(--warning)',
  warningMuted: 'var(--warning-muted)',
  info: 'var(--info)',
  infoMuted: 'var(--info-muted)',
  accent: 'var(--accent)',
  accentMuted: 'var(--accent-muted)',
} as const;

// Usage enforces semantic tokens
style={{ backgroundColor: semanticColors.surface }}
```

### Documentation

- Update `docs/DARK_MODE_GUIDE.md` with component usage examples
- Add component stories showing light/dark modes
- Create PR template checklist: "Does this change respect dark mode?"

### Component Library

- All new components exported from `app/components/ui/index.ts`
- Fully typed with proper IntelliSense
- Dark mode tested in both modes

### Testing

- Add Playwright test that toggles `prefers-color-scheme`
- Visual regression tests for key pages in both modes
- Test checklist after implementation:
  - [ ] Toggle OS dark mode on/off
  - [ ] Test all 5 public site themes in both modes
  - [ ] Verify status badges in bookings/trips/accounts
  - [ ] Test form validation in both modes
  - [ ] Check Stripe payment flow
  - [ ] Verify print/PDF outputs

## Success Criteria

- ✅ All 38 files updated to use semantic tokens
- ✅ 5 new reusable components created
- ✅ Public site themes auto-adapt to system preference
- ✅ No hardcoded hex colors or gray utilities remain
- ✅ ESLint rule prevents future regressions
- ✅ Documentation updated
- ✅ All tests passing in both light and dark modes

## Implementation Order

1. Create 5 new UI components
2. Refactor critical files (status badges, forms, theme system)
3. Update medium priority files (gray utilities, admin panel)
4. Polish low priority files (gallery, hero sections)
5. Add ESLint rule and documentation
6. Test thoroughly in both modes
7. Commit with comprehensive message

## Estimated Effort

**Total:** 12-16 hours of focused work

- Component creation: 3-4 hours
- Critical refactoring: 4-6 hours
- Medium refactoring: 3-4 hours
- Polish and testing: 2-3 hours

## Risk Assessment

**Risk Level:** Low-Medium

**Mitigations:**
- Component-based approach ensures consistency
- Semantic tokens already proven in foundation
- Comprehensive testing before deployment
- Can deploy incrementally if needed

## References

- Original audit: `docs/DARK_MODE_AUDIT_2026-02-01.md`
- Original design: `docs/plans/2026-01-25-dark-mode-design.md`
- Token preview: `docs/dark-mode-tokens-preview.html`
- Theme preview: `docs/dark-mode-themes-preview.html`
