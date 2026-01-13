# Booking Widget Implementation Exploration

## Overview

An embeddable booking widget that dive shops can add to their existing websites, allowing customers to browse tours and book directly without leaving the dive shop's site.

---

## Widget Types

### 1. Inline Embed Widget
```html
<!-- Dive shop adds this to their site -->
<div id="divestreams-widget" data-tenant="demo"></div>
<script src="https://widget.divestreams.com/v1/widget.js"></script>
```

Renders a full booking interface within the page.

### 2. Popup/Modal Widget
```html
<button onclick="DiveStreams.open()">Book a Dive</button>
<script src="https://widget.divestreams.com/v1/widget.js" data-tenant="demo"></script>
```

Opens a modal overlay for booking.

### 3. Button Widget
```html
<a href="https://demo.divestreams.com/book" class="divestreams-button">Book Now</a>
<script src="https://widget.divestreams.com/v1/button.js"></script>
```

Styled button that links to hosted booking page.

---

## Widget Features

### Customer-Facing
- Browse available tours
- View calendar availability
- Select date and time slot
- Enter participant details
- Secure payment (Stripe)
- Confirmation + email receipt

### Configuration Options
```javascript
DiveStreams.init({
  tenant: 'demo',
  primaryColor: '#0066cc',    // Match shop branding
  language: 'en',              // i18n support
  currency: 'USD',
  showPrices: true,
  defaultView: 'calendar',     // or 'list'
  tours: ['snorkeling', 'scuba'], // Filter specific tours
  onSuccess: (booking) => {
    // Custom callback
    gtag('event', 'purchase', { value: booking.total });
  }
});
```

---

## Technical Architecture

### Option A: iframe Embed
```
┌─────────────────────────────────────┐
│  Dive Shop Website                  │
│  ┌───────────────────────────────┐  │
│  │  <iframe>                     │  │
│  │    widget.divestreams.com     │  │
│  │    /embed/{tenant}            │  │
│  │  </iframe>                    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Pros:**
- Complete isolation (security)
- Easy to implement
- No CSS conflicts
- Payment security (Stripe stays in iframe)

**Cons:**
- Limited styling customization
- Fixed aspect ratio challenges
- Cross-origin communication needed

### Option B: Web Component
```javascript
// Custom element with Shadow DOM
<divestreams-booking tenant="demo"></divestreams-booking>
```

**Pros:**
- Native browser support
- Encapsulated styles (Shadow DOM)
- Flexible sizing
- Better performance

**Cons:**
- More complex to build
- Browser compatibility (older browsers)
- Security considerations for payments

### Option C: React Micro-Frontend
```javascript
// Bundled React app that mounts to target div
DiveStreams.mount('#widget-container', { tenant: 'demo' });
```

**Pros:**
- Full React component flexibility
- Reuses existing codebase
- Rich interactions

**Cons:**
- Large bundle size
- Potential React version conflicts
- CSS isolation challenges

**Recommendation:** iframe for Phase 1 (simplest, most secure), Web Component for Phase 2.

---

## Implementation Plan

### New Routes

```
/app/routes/embed/
├── $tenant.tsx           # Main embed entry
├── $tenant.tours.tsx     # Tour list view
├── $tenant.calendar.tsx  # Calendar availability
├── $tenant.book.tsx      # Booking form
└── $tenant.confirm.tsx   # Confirmation
```

### Embed Route Example

```typescript
// routes/embed/$tenant.tsx
export async function loader({ params }: LoaderFunctionArgs) {
  const subdomain = params.tenant;
  const tenant = await getTenantBySubdomain(subdomain);

  if (!tenant || !tenant.isActive) {
    throw new Response('Shop not found', { status: 404 });
  }

  // Get public data only - no auth required
  const tours = await getPublicTours(tenant.id);
  const widgetSettings = await getWidgetSettings(tenant.id);

  return { tenant, tours, settings: widgetSettings };
}

export default function EmbedPage() {
  // Minimal chrome, optimized for embed
  return (
    <div className="divestreams-widget">
      <Outlet />
    </div>
  );
}
```

### Widget JavaScript

```javascript
// widget.js - Lightweight loader
(function() {
  const container = document.getElementById('divestreams-widget');
  const tenant = container.dataset.tenant;

  const iframe = document.createElement('iframe');
  iframe.src = `https://widget.divestreams.com/embed/${tenant}`;
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.minHeight = '600px';

  container.appendChild(iframe);

  // Handle resize messages from iframe
  window.addEventListener('message', (e) => {
    if (e.origin === 'https://widget.divestreams.com') {
      if (e.data.type === 'resize') {
        iframe.style.height = e.data.height + 'px';
      }
      if (e.data.type === 'booking_complete') {
        container.dispatchEvent(new CustomEvent('booking', { detail: e.data.booking }));
      }
    }
  });
})();
```

---

## Widget Customization

### Tenant Settings (Schema Addition)
```typescript
widgetSettings: pgTable('widget_settings', {
  id: uuid().primaryKey(),
  tenantId: uuid().references(() => tenants.id).unique(),
  primaryColor: varchar(7).default('#0066cc'),
  secondaryColor: varchar(7).default('#f0f0f0'),
  fontFamily: varchar(100).default('system-ui'),
  logoUrl: varchar(500),
  headerText: varchar(255),
  footerText: text(),
  showPoweredBy: boolean().default(true), // "Powered by DiveStreams"
  allowedDomains: jsonb(), // CORS whitelist
  defaultView: varchar(20).default('calendar'),
  enabledTours: jsonb(), // array of tour IDs, null = all
});
```

### Admin UI for Widget Config
```
/app/routes/tenant/settings/widget.tsx
├── Preview (live iframe preview)
├── Colors (primary, secondary)
├── Branding (logo, text)
├── Tours (select which to show)
├── Install Code (copy snippet)
└── Allowed Domains (CORS)
```

---

## Security Considerations

### CORS Policy
```typescript
// Only allow embedding from registered domains
export async function loader({ request, params }) {
  const origin = request.headers.get('Origin');
  const tenant = await getTenant(params.tenant);
  const allowedDomains = tenant.widgetSettings?.allowedDomains || [];

  if (origin && !allowedDomains.includes(origin)) {
    throw new Response('Not allowed', { status: 403 });
  }

  return json(data, {
    headers: {
      'X-Frame-Options': `ALLOW-FROM ${origin}`,
      'Content-Security-Policy': `frame-ancestors ${allowedDomains.join(' ')}`
    }
  });
}
```

### Payment Security
- All payments handled via Stripe Elements within iframe
- No card data touches DiveStreams servers
- PCI compliance maintained

### Rate Limiting
- Limit API calls per tenant per minute
- Prevent booking spam with CAPTCHA
- IP-based rate limiting for abuse prevention

---

## Implementation Priority

### Phase 1 (MVP Widget)
1. Create `/embed/$tenant` routes
2. Basic tour list and calendar views
3. Simple booking form (Stripe Checkout redirect)
4. Embed script generator
5. Copy/paste install instructions

### Phase 2 (Enhanced)
1. Inline Stripe Elements (no redirect)
2. Widget customization UI (colors, logo)
3. Allowed domains configuration
4. Mobile-optimized responsive design

### Phase 3 (Advanced)
1. Web Component version
2. Multi-language support
3. Real-time availability updates (WebSocket)
4. Abandoned booking recovery

### Phase 4 (Enterprise)
1. White-label (remove DiveStreams branding)
2. Custom domain widgets (`booking.diveshop.com`)
3. Analytics dashboard (embed performance)
4. A/B testing for conversion

---

## Dependencies

```bash
# No new dependencies for iframe approach
# Web Component phase:
npm install lit
```

## Estimated Effort

| Phase | Features | Effort |
|-------|----------|--------|
| Phase 1 | MVP widget + embed | 4-5 days |
| Phase 2 | Customization + Stripe | 3-4 days |
| Phase 3 | Web Component + i18n | 4-5 days |
| Phase 4 | Enterprise features | 5-7 days |

---

## Revenue Model

| Plan | Widget Features |
|------|-----------------|
| Starter | Basic widget, DiveStreams branding |
| Professional | Custom colors, remove branding |
| Enterprise | White-label, custom domain, analytics |

---

## Questions to Resolve

1. iframe vs Web Component for Phase 1?
2. Stripe Checkout redirect or embedded Elements?
3. Multi-language support priority?
4. Analytics needs (views, conversion rates)?
5. White-label timeline?
