# DiveStreams Zapier Integration

This directory contains the Zapier Platform CLI app definition for DiveStreams.

## Structure

```
zapier-app/
├── index.js                    # Main app definition
├── authentication.js           # API key authentication
├── triggers/
│   ├── new-booking.js         # New booking trigger
│   ├── payment-received.js    # Payment received trigger
│   └── new-customer.js        # New customer trigger
├── actions/
│   ├── create-booking.js      # Create booking action
│   └── update-customer.js     # Update customer action
└── package.json               # Dependencies
```

## Setup

1. Install Zapier CLI globally:
   ```bash
   npm install -g zapier-platform-cli
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Login to Zapier:
   ```bash
   zapier login
   ```

4. Register the app (first time only):
   ```bash
   zapier register "DiveStreams"
   ```

5. Link to the registered app:
   ```bash
   zapier link
   ```

## Development

### Test locally
```bash
npm test
```

### Validate app structure
```bash
npm run validate
```

### Push to Zapier
```bash
npm run push
```

This creates a private version you can test in the Zapier editor.

## Testing in Zapier

1. After pushing, go to https://zapier.com/app/editor
2. Create a new Zap
3. Search for "DiveStreams" (it will show as private)
4. Enter your API key from DiveStreams Settings > Integrations > Zapier
5. Test the trigger or action

## Deployment

See `/docs/zapier-app-submission.md` for the full submission guide.

## Authentication

The app uses API key authentication. Users get their API key from:
Settings > Integrations > Zapier in DiveStreams.

## Triggers (3)

- **New Booking** - Fires when a booking is created
- **Payment Received** - Fires when a payment is received
- **New Customer** - Fires when a customer is added

All triggers use REST Hooks for instant delivery.

## Actions (2)

- **Create Booking** - Creates a new booking
- **Update Customer** - Updates customer information

## Environment

The app points to production DiveStreams:
- Base URL: `https://divestreams.com`
- API endpoints: `/api/zapier/*`

## Support

- Documentation: `/docs/zapier-integration.md`
- Submission Guide: `/docs/zapier-app-submission.md`
