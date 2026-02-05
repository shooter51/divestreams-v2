# Dark Mode Implementation Guide

**Last Updated:** 2026-02-05
**Status:** ✅ Production Ready

## Overview

DiveStreams v2 implements comprehensive dark mode support using semantic design tokens and auto-adaptive themes. All colors automatically respond to the user's system preference via `@media (prefers-color-scheme: dark)`.

## Architecture

### Three-Layer System

1. **Foundation Layer** - CSS Variables (app.css)
2. **Component Layer** - Reusable UI Components
3. **Application Layer** - Pages and Features

## Using Semantic Colors

### ✅ DO: Use Semantic Tokens

```tsx
// Option 1: CSS Variables (Recommended)
<div
  style={{
    backgroundColor: "var(--surface-raised)",
    color: "var(--foreground)",
    borderColor: "var(--border)",
  }}
>
  Content
</div>

// Option 2: Semantic Colors Utility
import { semanticColors } from "lib/utils/semantic-colors";

<div
  style={{
    backgroundColor: semanticColors.surfaceRaised,
    color: semanticColors.foreground,
    borderColor: semanticColors.border,
  }}
>
  Content
</div>

// Option 3: Tailwind Classes (when semantic class exists)
<div className="bg-surface-raised text-foreground border-border">
  Content
</div>
```

### ❌ DON'T: Hardcode Colors

```tsx
// ❌ WRONG - Will not adapt to dark mode
<div
  style={{
    backgroundColor: "#FFFFFF",
    color: "#1F2937",
    border: "1px solid #E5E7EB",
  }}
>
  Content
</div>

// ❌ WRONG - Hardcoded RGB/HSL
<div style={{ backgroundColor: "rgb(255, 255, 255)" }}>Content</div>

// ❌ WRONG - Hardcoded Tailwind gray utilities
<div className="bg-gray-100 text-gray-900 border-gray-300">Content</div>
```

## Semantic Token Reference

### Surfaces (Backgrounds)

| Token | Purpose | Example Use |
|-------|---------|-------------|
| `--surface` | Main page background | Page containers |
| `--surface-raised` | Elevated surfaces | Cards, modals, dropdowns |
| `--surface-inset` | Depressed areas | Input fields, code blocks |
| `--surface-overlay` | Hover states, overlays | Hover effects, temporary surfaces |

### Foreground (Text)

| Token | Purpose | Example Use |
|-------|---------|-------------|
| `--foreground` | Primary text | Headlines, body text |
| `--foreground-muted` | Secondary text | Labels, metadata |
| `--foreground-subtle` | Tertiary text | Placeholders, disabled text |

### Borders

| Token | Purpose | Example Use |
|-------|---------|-------------|
| `--border` | Standard borders | Input borders, dividers |
| `--border-strong` | Emphasized borders | Active states, focus rings |

### Brand Colors

| Token | Purpose | Example Use |
|-------|---------|-------------|
| `--brand` | Primary brand color | CTA buttons, links |
| `--brand-hover` | Brand hover state | Button hover |
| `--brand-muted` | Muted brand backgrounds | Subtle highlights |
| `--brand-disabled` | Disabled brand state | Disabled buttons |

### Semantic States

| Token | Purpose | Example Use |
|-------|---------|-------------|
| `--danger` | Error text | Error messages, delete buttons |
| `--danger-hover` | Danger hover state | Delete button hover |
| `--danger-muted` | Danger background | Error alerts, validation errors |
| `--success` | Success text | Success messages, confirmation |
| `--success-muted` | Success background | Success alerts |
| `--warning` | Warning text | Warning messages |
| `--warning-muted` | Warning background | Warning alerts |
| `--info` | Info text | Info messages, badges |
| `--info-hover` | Info hover state | Info button hover |
| `--info-muted` | Info background | Info alerts |
| `--accent` | Accent color | Highlights, accents |
| `--accent-hover` | Accent hover state | Accent button hover |
| `--accent-muted` | Accent background | Subtle accents |

## Reusable Components

### StatusBadge

Use for all status indicators (booking status, payment status, availability, etc.)

```tsx
import { StatusBadge, type BadgeStatus } from "app/components/ui";

<StatusBadge status="pending" />
<StatusBadge status="confirmed" size="md" />
<StatusBadge status="cancelled" />
```

**Supported Statuses:**
- Bookings: `pending`, `confirmed`, `checked_in`, `completed`, `cancelled`, `no_show`
- Availability: `available`, `unavailable`
- Equipment: `rented`, `maintenance`, `retired`
- Active/Inactive: `active`, `inactive`
- Payment: `paid`, `unpaid`, `refunded`, `partial`, `failed`

### FormInput

Use for all text input fields.

```tsx
import { FormInput } from "app/components/ui";

<FormInput
  label="Email Address"
  name="email"
  type="email"
  error={actionData?.errors?.email}
  required
  placeholder="you@example.com"
/>
```

**Automatic Features:**
- Error styling (red border/background when error present)
- Dark mode support
- Label/input association
- Accessibility attributes

### FormSelect

Use for all dropdown select fields.

```tsx
import { FormSelect } from "app/components/ui";

<FormSelect
  label="Country"
  name="country"
  options={[
    { value: "us", label: "United States" },
    { value: "ca", label: "Canada" },
  ]}
  error={actionData?.errors?.country}
  required
/>
```

### FormTextarea

Use for all multi-line text input.

```tsx
import { FormTextarea } from "app/components/ui";

<FormTextarea
  label="Description"
  name="description"
  rows={4}
  error={actionData?.errors?.description}
  placeholder="Enter description..."
/>
```

### ErrorMessage

Use for consistent error message display.

```tsx
import { ErrorMessage } from "app/components/ui";

<ErrorMessage error={actionData?.errors?.form} />
```

## Public Site Themes

All 5 public site themes (Ocean, Tropical, Minimal, Dark, Classic) automatically adapt to dark mode.

```tsx
// Theme CSS is generated in app/routes/site/_layout.tsx
const darkCSS = getThemeStyleBlock(fullTheme, {
  primaryColor: settings.primaryColor || undefined,
  secondaryColor: settings.secondaryColor || undefined,
});

// CSS output includes both light and dark mode:
// .site-theme { --primary-color: #0077B6; }
// @media (prefers-color-scheme: dark) {
//   .site-theme { --primary-color: #60A5FA; }
// }
```

## Stripe Elements Styling

Stripe Elements automatically detect dark mode:

```tsx
// app/components/pos/CheckoutModals.tsx
const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const stripeElementsOptions = {
  appearance: {
    theme: "stripe",
    variables: {
      colorPrimary: isDark ? "#60A5FA" : "#3B82F6",
      colorBackground: isDark ? "#1F2937" : "#FFFFFF",
      colorText: isDark ? "#F3F4F6" : "#1F2937",
      colorDanger: isDark ? "#F87171" : "#EF4444",
      borderRadius: "0.5rem",
    },
  },
};
```

## Certification Agency Colors

Certification badges use light/dark color variants:

```tsx
// app/routes/site/courses/$courseId.tsx
const agencyColors = {
  PADI: { lightColor: "#0055A4", darkColor: "#3B82F6" },
  SSI: { lightColor: "#FF6B00", darkColor: "#FB923C" },
  NAUI: { lightColor: "#005EB8", darkColor: "#60A5FA" },
  // ... etc
};

// CSS generation includes @media query
style.textContent = `
  .cert-badge-${agency.id} {
    background: linear-gradient(135deg, ${colors.lightColor}, ${colors.lightColor}dd);
  }
  @media (prefers-color-scheme: dark) {
    .cert-badge-${agency.id} {
      background: linear-gradient(135deg, ${colors.darkColor}, ${colors.darkColor}dd);
    }
  }
`;
```

## Testing Dark Mode

### Manual Testing

1. **Toggle System Dark Mode:**
   - macOS: System Settings → Appearance → Dark
   - Windows: Settings → Personalization → Colors → Dark
   - Linux: Varies by desktop environment

2. **Test All Themes:**
   - Visit public site settings
   - Test Ocean, Tropical, Minimal, Dark, Classic themes
   - Verify each theme in both light and dark modes

3. **Test All Pages:**
   - Home, About, Trips, Courses, Equipment, Contact, Gallery
   - Account pages (bookings, profile, payments)
   - Admin panel (tenant management, settings)
   - Booking flows (trip booking, course enrollment)
   - POS/Checkout flows

### Automated Testing

```typescript
// Playwright test with dark mode
test("should display correctly in dark mode", async ({ page }) => {
  // Enable dark mode
  await page.emulateMedia({ colorScheme: "dark" });

  await page.goto("/");

  // Verify semantic colors are used
  const card = page.locator('[data-testid="booking-card"]');
  const bg = await card.evaluate((el) =>
    getComputedStyle(el).backgroundColor
  );

  // Should use CSS variable, not hardcoded color
  expect(bg).not.toBe("rgb(255, 255, 255)");
});
```

## ESLint Rule

The project includes an ESLint rule that prevents hardcoded colors:

```javascript
// eslint.config.js
"no-restricted-syntax": [
  "error",
  {
    selector: "Literal[value=/#[0-9a-fA-F]{3,8}$/]",
    message: "❌ Hardcoded hex colors are prohibited. Use semantic tokens instead."
  }
]
```

**Allowed Exceptions:**
- `transparent`
- `currentColor`
- `inherit`

## Migration Checklist

When adding new components or pages:

- [ ] Use semantic color tokens (no hex codes)
- [ ] Test in both light and dark modes
- [ ] Use reusable UI components (StatusBadge, FormInput, etc.)
- [ ] Verify ESLint passes (no hardcoded color warnings)
- [ ] Check all interactive states (hover, focus, disabled)
- [ ] Verify form validation styling works in both modes
- [ ] Test with all 5 public site themes (if public-facing)

## Common Patterns

### Card Component

```tsx
<div
  className="rounded-lg border shadow-sm p-6"
  style={{
    backgroundColor: "var(--surface-raised)",
    borderColor: "var(--border)",
  }}
>
  <h3 style={{ color: "var(--foreground)" }}>Card Title</h3>
  <p style={{ color: "var(--foreground-muted)" }}>Card description</p>
</div>
```

### Button Component

```tsx
<button
  className="px-4 py-2 rounded-lg font-medium transition-colors"
  style={{
    backgroundColor: "var(--brand)",
    color: "white",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = "var(--brand-hover)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = "var(--brand)";
  }}
>
  Click Me
</button>
```

### Form with Validation

```tsx
<form>
  <FormInput
    label="Email"
    name="email"
    type="email"
    error={errors?.email}
    required
  />

  <FormSelect
    label="Plan"
    name="plan"
    options={planOptions}
    error={errors?.plan}
    required
  />

  <FormTextarea
    label="Message"
    name="message"
    rows={4}
    error={errors?.message}
  />

  <ErrorMessage error={errors?.form} />

  <button type="submit">Submit</button>
</form>
```

## Resources

- **Design Document:** `docs/plans/2026-02-05-dark-mode-overhaul-design.md`
- **Semantic Colors Utility:** `lib/utils/semantic-colors.ts`
- **Theme System:** `lib/themes/public-site-themes.ts`
- **UI Components:** `app/components/ui/`

## Support

If you encounter dark mode issues:

1. Verify you're using semantic tokens (not hardcoded colors)
2. Check ESLint output for warnings
3. Test with system dark mode enabled
4. Review this guide for proper usage patterns
5. Check existing components in `app/components/ui/` for examples

---

**Remember:** All colors must use semantic tokens. The ESLint rule will catch hardcoded colors during development.
