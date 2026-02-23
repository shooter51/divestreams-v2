# Zapier Integration Documentation

## Overview

The DiveStreams Zapier integration allows you to automate workflows by connecting DiveStreams with 5000+ apps. This integration supports both **triggers** (events from DiveStreams) and **actions** (operations in DiveStreams).

## Features

- **Real-time Triggers**: Instant webhook-based triggers when events occur
- **Multi-tenant Support**: Each organization gets its own API key
- **Reliable Delivery**: Background queue with automatic retries
- **Activity Logging**: Track all webhook deliveries for debugging

## Setup Instructions

### 1. Generate API Key

1. Log in to your DiveStreams account
2. Navigate to **Settings > Integrations > Zapier**
3. Click **Generate New Key**
4. Copy the API key (you'll only see it once!)

### 2. Connect to Zapier

1. Go to [Zapier.com](https://zapier.com)
2. Create a new Zap
3. Search for "DiveStreams" in triggers or actions
4. Enter your API key when prompted
5. Choose your trigger or action

## Available Triggers

Triggers send data from DiveStreams to other apps when events occur:

### Booking Triggers

- **New Booking** - Fires when a booking is created
- **Booking Updated** - Fires when a booking is modified
- **Booking Cancelled** - Fires when a booking is cancelled

### Customer Triggers

- **New Customer** - Fires when a customer is added
- **Customer Updated** - Fires when customer details change

### Payment Triggers

- **Payment Received** - Fires when a payment is successfully processed
- **Payment Refunded** - Fires when a payment is refunded

### Trip Triggers

- **Trip Created** - Fires when a new trip is scheduled
- **Trip Completed** - Fires when a trip is marked as completed

## Available Actions

Actions allow Zapier to create or modify data in DiveStreams:

### Create Booking

Create a new booking in DiveStreams.

**Required Fields:**
- Trip ID
- Customer Email
- Number of Participants

**Optional Fields:**
- Customer First Name
- Customer Last Name
- Customer Phone
- Booking Notes

### Update Customer

Update an existing customer's information.

**Required Fields:**
- Customer Email (to identify the customer)

**Optional Fields:**
- First Name
- Last Name
- Phone
- Emergency Contact
- Emergency Phone
- Certification Level
- Notes

## Example Workflows

### 1. Google Sheets → DiveStreams
**When a new row is added to Google Sheets, create a booking**

- Trigger: Google Sheets - New Row
- Action: DiveStreams - Create Booking
- Map columns to booking fields

### 2. DiveStreams → Mailchimp
**When a new customer is created, add to Mailchimp list**

- Trigger: DiveStreams - New Customer
- Action: Mailchimp - Add Subscriber

### 3. DiveStreams → Slack
**Send notification when payment is received**

- Trigger: DiveStreams - Payment Received
- Action: Slack - Send Message

### 4. Typeform → DiveStreams
**Create customer from Typeform submission**

- Trigger: Typeform - New Entry
- Action: DiveStreams - Update Customer

## Webhook Subscription (Advanced)

The integration uses REST Hooks for instant triggers:

### Subscribe to Trigger
```bash
POST /api/zapier/subscribe
Headers: X-API-Key: your_api_key
Body: {
  "event_type": "booking.created",
  "target_url": "https://hooks.zapier.com/your-webhook-url"
}
```

### Unsubscribe from Trigger
```bash
DELETE /api/zapier/subscribe
Headers: X-API-Key: your_api_key
Body: {
  "event_type": "booking.created",
  "target_url": "https://hooks.zapier.com/your-webhook-url"
}
```

## API Endpoints

All endpoints require the `X-API-Key` header.

### Test Connection
```bash
GET /api/zapier/test
Headers: X-API-Key: your_api_key
```

### List Triggers
```bash
GET /api/zapier/triggers
Headers: X-API-Key: your_api_key
```

### Create Booking
```bash
POST /api/zapier/actions/create-booking
Headers: X-API-Key: your_api_key
Body: {
  "trip_id": "trip_123",
  "customer_email": "john@example.com",
  "participants": 2
}
```

### Update Customer
```bash
POST /api/zapier/actions/update-customer
Headers: X-API-Key: your_api_key
Body: {
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe"
}
```

## Webhook Payload Format

All webhook triggers send data in this format:

```json
{
  "event": "booking.created",
  "timestamp": "2024-01-18T12:00:00Z",
  "data": {
    "bookingId": "bk_abc123",
    "bookingNumber": "BK-2024-001",
    "tripName": "Morning Dive",
    "customerEmail": "john@example.com",
    ...
  }
}
```

## Troubleshooting

### Webhook Not Firing

1. Check that the trigger is enabled in your Zap
2. Verify your API key is valid (test at `/api/zapier/test`)
3. Check webhook delivery logs in DiveStreams settings

### Failed Webhook Deliveries

Webhooks are automatically retried 3 times with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: After 2 seconds
- Attempt 3: After 4 seconds

Check the delivery log in Settings > Integrations > Zapier for error details.

### API Key Issues

- Ensure you're using the correct API key format: `zap_dev_...`
- Check that the key hasn't been revoked
- Generate a new key if needed

## Security

- API keys are hashed (SHA-256) before storage
- Webhook payloads are delivered over HTTPS only
- Each organization has isolated API keys
- Keys can be revoked at any time

## Rate Limits

- Webhook deliveries: 5 concurrent per organization
- API actions: No explicit limit (standard rate limiting applies)
- Failed webhooks are automatically disabled after 10 consecutive failures

## Support

For issues or questions:
- Email: support@divestreams.com
- Documentation: https://docs.divestreams.com/integrations/zapier
- Status: https://status.divestreams.com
