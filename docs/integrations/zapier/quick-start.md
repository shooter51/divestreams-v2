# Zapier Integration - Quick Start Guide

## For Users (Non-Technical)

### Setup in 3 Steps:

1. **Get Your API Key**
   - Log in to DiveStreams
   - Go to Settings → Integrations → Zapier
   - Click "Generate New Key"
   - Copy the key (you'll only see it once!)

2. **Connect to Zapier**
   - Go to [Zapier.com](https://zapier.com)
   - Create a new Zap
   - Search for "DiveStreams"
   - Enter your API key when prompted

3. **Build Your Automation**
   - Choose a trigger (e.g., "New Booking")
   - Choose an action in another app (e.g., "Send Email")
   - Test and turn on your Zap!

### Popular Use Cases:

**Send Slack notifications when bookings are created:**
- Trigger: DiveStreams → New Booking
- Action: Slack → Send Message

**Add customers to Mailchimp:**
- Trigger: DiveStreams → New Customer
- Action: Mailchimp → Add Subscriber

**Create Google Calendar events from trips:**
- Trigger: DiveStreams → Trip Created
- Action: Google Calendar → Create Event

**Log payments to Google Sheets:**
- Trigger: DiveStreams → Payment Received
- Action: Google Sheets → Add Row

## For Developers

### Quick Integration:

```typescript
import { triggerBookingCreated } from "~/lib/integrations/zapier-events.server";

// In your booking creation code:
await triggerBookingCreated(organizationId, {
  id: booking.id,
  bookingNumber: booking.bookingNumber,
  tripName: booking.trip.name,
  tripDate: booking.trip.date.toISOString(),
  customerName: `${customer.firstName} ${customer.lastName}`,
  customerEmail: customer.email,
  participants: booking.participants,
  totalAmount: booking.totalAmount,
  currency: "USD",
  status: booking.status,
});
```

### Available Trigger Functions:

```typescript
// Booking events
await triggerBookingCreated(orgId, bookingData);
await triggerBookingUpdated(orgId, bookingData);
await triggerBookingCancelled(orgId, bookingData);

// Customer events
await triggerCustomerCreated(orgId, customerData);
await triggerCustomerUpdated(orgId, customerData);

// Payment events
await triggerPaymentReceived(orgId, paymentData);
await triggerPaymentRefunded(orgId, paymentData);

// Trip events
await triggerTripCreated(orgId, tripData);
await triggerTripCompleted(orgId, tripData);
```

### Testing:

```bash
# Test API key
curl -H "X-API-Key: your_key" \
  https://divestreams.com/api/zapier/test

# List triggers
curl -H "X-API-Key: your_key" \
  https://divestreams.com/api/zapier/triggers

# Subscribe to webhook
curl -X POST https://divestreams.com/api/zapier/subscribe \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"booking.created","target_url":"https://hooks.zapier.com/..."}'
```

## Deployment

### Run Database Migration:

```bash
npm run db:migrate
```

### Start Webhook Worker:

```bash
npm run worker:zapier
```

### Add to Docker Compose:

```yaml
zapier-worker:
  image: ghcr.io/shooter51/divestreams-app:latest
  command: npm run worker:zapier
  environment:
    - DATABASE_URL
    - REDIS_URL
  restart: unless-stopped
```

## Troubleshooting

### Webhook not firing?
1. Check Settings → Integrations → Zapier for delivery logs
2. Verify trigger is enabled in your Zap
3. Test webhook with `/api/zapier/test` endpoint

### Action failing?
1. Verify API key is correct
2. Check required fields are provided
3. Review error message in Zapier

### Need more help?
- User Guide: `/docs/zapier-integration.md`
- Code Examples: `/docs/zapier-usage-examples.ts`
- Full Summary: `/docs/ZAPIER_IMPLEMENTATION_SUMMARY.md`

## Key Features

✅ **9 Triggers** - Real-time events from DiveStreams
✅ **2 Actions** - Create bookings and update customers
✅ **Reliable Delivery** - Background queue with retries
✅ **Multi-Tenant** - Isolated API keys per organization
✅ **Activity Logs** - Track all webhook deliveries
✅ **Easy Setup** - Just copy your API key

## What's Next?

1. Generate your API key
2. Create your first Zap
3. Automate your workflow!

Questions? support@divestreams.com
