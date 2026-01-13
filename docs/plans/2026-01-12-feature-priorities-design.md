# DiveStreams Feature Implementation Design

**Date:** 2026-01-12
**Status:** Approved
**Goal:** Foundation-first approach to build infrastructure that enables customer-facing features

---

## Implementation Order

| Priority | Feature | Effort | Dependencies |
|----------|---------|--------|--------------|
| 1 | Email | 2-3 days | None |
| 2 | Images | 3-4 days | Backblaze B2 account |
| 3 | Booking Widget | 5-6 days | Images |
| 4 | Calendar | 2-3 days | None |
| 5 | Reports | 4-5 days | None |
| 6 | POS | 7-10 days | Images, potentially Stripe Terminal |

---

## Feature 1: Email

### Decisions
- **Provider:** Platform SMTP (single config in .env)
- **Sender:** `noreply@divestreams.com`
- **Scope:** Get existing 4 templates actually sending

### Existing Templates (lib/email/index.ts)
1. `bookingConfirmationEmail` - After booking confirmed
2. `bookingReminderEmail` - Day before trip
3. `welcomeEmail` - New tenant signup
4. `passwordResetEmail` - Password recovery

### Implementation Tasks
1. Configure SMTP credentials in production .env
2. Test email sending with each template
3. Wire up booking confirmation to booking creation flow
4. Wire up reminder emails to scheduled job (already in job queue)
5. Wire up welcome email to tenant registration

### Configuration Required
```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@divestreams.com
```

---

## Feature 2: Images

### Decisions
- **Storage:** Backblaze B2
- **CDN:** Cloudflare (free egress from B2)
- **Limit:** Up to 5 images per entity
- **Entities:** Tours, dive sites, boats, equipment, staff

### Schema Addition
```typescript
images: pgTable('images', {
  id: uuid().primaryKey().defaultRandom(),
  entityType: varchar(50).notNull(), // 'tour', 'dive_site', 'boat', 'equipment', 'staff'
  entityId: uuid().notNull(),
  url: varchar(500).notNull(),
  thumbnailUrl: varchar(500),
  alt: varchar(255),
  sortOrder: integer().default(0),
  isPrimary: boolean().default(false),
  sizeBytes: integer(),
  createdAt: timestamp().defaultNow(),
});
```

### Implementation Tasks
1. Create Backblaze B2 bucket `divestreams-images`
2. Configure Cloudflare CDN in front of B2
3. Add images table to tenant schema
4. Create upload API endpoint with validation (5 image limit, 10MB max, image types only)
5. Generate thumbnails on upload (200x200, 600x400)
6. Add image management UI to tour/site/boat/equipment edit pages
7. Display images in listings

### B2 + Cloudflare Setup
- B2 bucket with public read access
- Cloudflare DNS pointing to B2 endpoint
- Cache rules for image optimization

---

## Feature 3: Booking Widget

### Decisions
- **Type:** Iframe embed for existing websites
- **Flow:** Full booking (browse → select → pay)
- **Payments:** Stripe Connect (tenant receives directly)

### Embed Code (for tenants)
```html
<div id="divestreams-booking"></div>
<script src="https://widget.divestreams.com/v1/widget.js"
        data-tenant="demo"></script>
```

### Routes Structure
```
/app/routes/embed/
├── $tenant.tsx           # Layout wrapper
├── $tenant._index.tsx    # Tour list with images
├── $tenant.tour.$id.tsx  # Tour detail + date selection
├── $tenant.book.tsx      # Booking form + Stripe
└── $tenant.confirm.tsx   # Confirmation page
```

### Implementation Tasks
1. Create `/embed/$tenant` route group
2. Build tour listing with cover images
3. Build date/time selection (mini calendar)
4. Build booking form (participants, contact info)
5. Integrate Stripe Connect checkout
6. Build confirmation page
7. Create widget.js loader script
8. Add CORS configuration for allowed domains
9. Add widget settings to tenant settings

### Widget Settings Schema
```typescript
widgetSettings: pgTable('widget_settings', {
  id: uuid().primaryKey(),
  tenantId: uuid().references(() => tenants.id).unique(),
  primaryColor: varchar(7).default('#0066cc'),
  allowedDomains: jsonb(), // ['diveshop.com', 'www.diveshop.com']
  isEnabled: boolean().default(true),
});
```

---

## Feature 4: Calendar

### Decisions
- **Type:** View-only schedule visualization
- **Views:** Month and week
- **Interactions:** Click trip for details modal
- **Sync:** No Google Calendar integration

### Library
FullCalendar (recommended) or Recharts-based custom

```bash
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid
```

### Implementation Tasks
1. Install FullCalendar
2. Create calendar route with month view
3. Load trips as calendar events
4. Add week view toggle
5. Add trip detail modal on event click
6. Color-code by tour type or status
7. Add capacity indicators (full/available badges)

### Loader Data
```typescript
interface CalendarEvent {
  id: string;
  title: string;        // "Snorkeling 9:00 AM"
  start: Date;
  end: Date;
  status: string;
  booked: number;
  capacity: number;
  color: string;
}
```

---

## Feature 5: Reports

### Decisions
- **Scope:** Revenue + Bookings dashboard
- **Exports:** CSV + PDF
- **Views:** Summary stats, charts, data tables

### Report Types

**Revenue Reports:**
- Total revenue by date range
- Revenue by tour
- Revenue by payment method
- Refunds summary

**Booking Reports:**
- Booking count and trends
- Bookings by tour
- Cancellation rates
- Capacity utilization

### Implementation Tasks
1. Create reports dashboard route
2. Build summary stat cards (revenue, bookings, customers)
3. Add date range picker with comparison
4. Build revenue chart (Recharts line/bar)
5. Build booking trends chart
6. Add data tables with sorting
7. Implement CSV export
8. Implement PDF export with @react-pdf/renderer
9. Add report filtering (by tour, date range)

### Dependencies
```bash
npm install recharts @react-pdf/renderer date-fns
```

---

## Feature 6: POS

### Decisions
- **Scope:** Full dive shop operations
  - Retail products (merchandise, accessories)
  - Equipment rentals
  - Courses and certifications
  - Repairs and services
- **Priority:** Last (after other features)

### Schema Additions

```typescript
products: pgTable('products', {
  id: uuid().primaryKey(),
  name: varchar(255).notNull(),
  sku: varchar(50),
  category: varchar(50), // 'retail', 'rental', 'course', 'service'
  price: integer().notNull(),
  trackInventory: boolean().default(false),
  stockQuantity: integer(),
  isActive: boolean().default(true),
});

rentalItems: pgTable('rental_items', {
  id: uuid().primaryKey(),
  productId: uuid().references(() => products.id),
  serialNumber: varchar(100),
  status: varchar(20), // 'available', 'rented', 'maintenance'
  currentBookingId: uuid(),
});
```

### Routes Structure
```
/app/routes/tenant/pos/
├── index.tsx         # POS terminal
├── products.tsx      # Product catalog
├── transactions.tsx  # Transaction history
└── end-of-day.tsx    # Daily reports
```

### Implementation Tasks (High Level)
1. Create products schema and CRUD
2. Build POS terminal interface
3. Implement cart and checkout flow
4. Add cash and card payment handling
5. Build transaction history
6. Add rental tracking
7. Add end-of-day reports
8. (Future) Stripe Terminal hardware integration

---

## Technical Notes

### Multi-Tenant Considerations
- All new tables use tenant schema isolation
- Images table includes entityType for flexible attachment
- Widget uses public routes (no tenant auth required)
- Reports query tenant-specific data only

### Performance
- Image thumbnails generated on upload, not on-the-fly
- Calendar loads events for visible date range only
- Reports use aggregation queries, consider caching for large datasets

### Security
- Widget CORS restricted to allowed domains
- Upload validation: file type, size limits
- Rate limiting on widget API endpoints

---

## Next Steps

1. Start with Email - configure SMTP, test templates
2. Set up Backblaze B2 + Cloudflare for images
3. Build image upload system
4. Proceed to Widget development

Ready to set up for implementation?
