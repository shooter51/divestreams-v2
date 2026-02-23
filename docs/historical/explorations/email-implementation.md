# Email Implementation Exploration

## Current State

### Existing Infrastructure
The project has a functional email foundation in `/lib/email/index.ts`:

- **Transport**: Nodemailer with SMTP configuration
- **Queue**: BullMQ email queue with Redis backend
- **Templates**: 4 existing HTML email templates:
  - `bookingConfirmationEmail` - Sent when booking is confirmed
  - `bookingReminderEmail` - Sent before trip date
  - `welcomeEmail` - Sent to new tenants
  - `passwordResetEmail` - For password recovery

### Configuration (.env)
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@divestreams.com
```

### Job Queue System
Located in `/lib/jobs/index.ts`:
- `sendEmail()` function queues emails with retry logic
- Scheduled job: Booking reminders at 8 AM daily
- Worker processes emails with concurrency control

---

## Enhancement Opportunities

### 1. Additional Email Templates

| Template | Trigger | Purpose |
|----------|---------|---------|
| `tripCancellation` | Trip cancelled | Notify customers of cancellation + refund info |
| `paymentReceipt` | Payment processed | Itemized receipt for transactions |
| `reviewRequest` | 24h after trip | Request customer reviews |
| `waitlistNotification` | Spot available | Alert waitlisted customers |
| `equipmentRentalReminder` | Day before trip | Remind about rental equipment pickup |
| `certificationExpiry` | 30/7 days before | Alert customers about expiring certifications |
| `abandonedBooking` | 1h after abandon | Recover incomplete bookings |

### 2. Multi-Tenant Branding

Each tenant should customize:
- Logo in email header
- Brand colors (primary, secondary)
- Footer contact info
- Social media links
- Custom email domain (e.g., `bookings@diveshop.com`)

**Schema Addition:**
```typescript
emailSettings: {
  logoUrl: string | null;
  primaryColor: string; // hex
  footerText: string;
  replyToEmail: string;
  customDomain: string | null; // for verified sending domains
}
```

### 3. Email Providers

**Current**: SMTP (generic)

**Recommended Upgrades:**
| Provider | Pros | Cons | Cost |
|----------|------|------|------|
| **SendGrid** | Reliable, analytics, templates | Complex pricing | Free tier: 100/day |
| **Postmark** | Fast delivery, simple | Transactional only | $15/mo for 10k |
| **AWS SES** | Cheap at scale | Setup complexity | $0.10 per 1k |
| **Resend** | Modern API, React emails | New provider | Free tier: 3k/mo |

**Recommendation**: Resend for modern DX, or SendGrid for proven reliability.

### 4. React Email Templates

Replace HTML strings with React Email for:
- Component reusability
- TypeScript safety
- Preview in development
- Responsive by default

```typescript
// Example with React Email
import { Html, Head, Body, Container, Text } from '@react-email/components';

export function BookingConfirmation({ booking, tenant }) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif' }}>
        <Container>
          <Text>Your booking is confirmed!</Text>
          {/* ... */}
        </Container>
      </Body>
    </Html>
  );
}
```

### 5. Email Analytics

Track per tenant:
- Delivery rates
- Open rates
- Click rates
- Bounce/complaint rates

**Schema Addition:**
```typescript
emailLogs: pgTable('email_logs', {
  id: uuid().primaryKey(),
  tenantId: uuid().references(() => tenants.id),
  templateType: varchar(50),
  recipientEmail: varchar(255),
  status: varchar(20), // sent, delivered, opened, clicked, bounced
  sentAt: timestamp(),
  openedAt: timestamp(),
  metadata: jsonb()
});
```

---

## Implementation Priority

### Phase 1 (MVP)
1. Add `tripCancellation` and `paymentReceipt` templates
2. Per-tenant logo and brand color support
3. Email preview in admin panel

### Phase 2 (Enhanced)
1. Migrate to React Email templates
2. Integrate SendGrid or Resend
3. Add `reviewRequest` and `waitlistNotification` templates

### Phase 3 (Advanced)
1. Custom sending domains (DKIM/SPF)
2. Email analytics dashboard
3. A/B testing for subject lines
4. Automated drip campaigns

---

## Dependencies

```bash
npm install @react-email/components resend
```

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1 | 2 templates + branding | 2-3 days |
| Phase 2 | React Email + provider | 3-4 days |
| Phase 3 | Analytics + domains | 5-7 days |

---

## Questions to Resolve

1. Which email provider preferred (cost vs features)?
2. Should we support tenant custom domains from day one?
3. Priority of email templates beyond confirmation/reminder?
