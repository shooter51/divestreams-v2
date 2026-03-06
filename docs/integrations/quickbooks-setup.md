# QuickBooks Integration Setup Guide

This guide explains how to set up and configure the QuickBooks Online integration for DiveStreams.

## Overview

The QuickBooks integration allows automatic syncing of:
- **Customers** - DiveStreams customers → QuickBooks customers
- **Invoices** - DiveStreams bookings → QuickBooks invoices
- **Payments** - DiveStreams payments → QuickBooks payment records

## Prerequisites

1. Active QuickBooks Online account (Sandbox or Production)
2. Intuit Developer account
3. OAuth credentials configured in environment

## Setup Steps

### 1. Create Intuit Developer Account

1. Go to [Intuit Developer Portal](https://developer.intuit.com/)
2. Sign up or log in with your Intuit account
3. Create a new app for DiveStreams

### 2. Configure OAuth App

1. In the Intuit Developer Dashboard:
   - Navigate to **Keys & Credentials**
   - Note your **Client ID** and **Client Secret**

2. Set up Redirect URI:
   - Production: `https://yourdomain.com/api/integrations/quickbooks/callback`
   - Development: `http://localhost:5173/api/integrations/quickbooks/callback`
   - Staging: `https://staging.yourdomain.com/api/integrations/quickbooks/callback`

3. Configure Scopes:
   - Enable: `com.intuit.quickbooks.accounting`
   - Enable: `openid`
   - Enable: `profile`
   - Enable: `email`

### 3. Environment Variables

Add the following to your `.env` file:

```bash
# QuickBooks OAuth Credentials
QUICKBOOKS_CLIENT_ID=your_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_client_secret_here

# QuickBooks Environment (true for sandbox, false for production)
QUICKBOOKS_SANDBOX=true

# Application URL (for OAuth callback)
APP_URL=https://divestreams.com
```

**Important**: Never commit `.env` files with real credentials to version control.

### 4. Database Migration

Run the QuickBooks database migration:

```bash
npm run db:migrate
```

This creates the following tables:
- `quickbooks_sync_records` - Maps DiveStreams entities to QuickBooks entities
- `quickbooks_item_mappings` - Maps DiveStreams products to QuickBooks items

### 5. Start Background Worker

The QuickBooks sync worker must be running for background syncing:

```bash
npm run worker
```

Or in production, ensure the worker service is running via systemd/docker.

## User Configuration

### Connecting QuickBooks

1. Navigate to **Settings → Integrations** in DiveStreams
2. Find **QuickBooks** in the integrations list
3. Click **Connect QuickBooks**
4. Authorize DiveStreams in the QuickBooks authorization page
5. Select the QuickBooks company to connect
6. You'll be redirected back to DiveStreams

### Sync Settings

After connecting, configure sync preferences:

1. Go to **Settings → Integrations → QuickBooks**
2. Enable/disable sync options:
   - **Sync Invoices** - Create invoices for new bookings
   - **Sync Payments** - Record payments in QuickBooks
   - **Sync Customers** - Create customers automatically
   - **Auto-sync** - Enable background syncing

### Manual Sync

To manually sync a booking:

1. Navigate to the booking details
2. Click **Sync to QuickBooks**
3. Wait for confirmation

## How It Works

### Invoice Creation Flow

1. Customer books a dive trip in DiveStreams
2. If auto-sync is enabled:
   - Job queued in background
   - Customer checked/created in QuickBooks
   - Invoice created with booking details
   - Sync record saved with mapping
3. If auto-sync is disabled:
   - Use manual sync button
   - Same process runs immediately

### Payment Recording Flow

1. Payment received for booking
2. Payment synced to QuickBooks:
   - Payment record created
   - Linked to existing invoice (if available)
   - Marked as received

### Data Mapping

| DiveStreams | QuickBooks |
|-------------|------------|
| Customer (firstName + lastName) | Customer (DisplayName) |
| Customer email | PrimaryEmailAddr |
| Customer phone | PrimaryPhone |
| Booking | Invoice |
| Booking number | Invoice DocNumber |
| Booking total | Invoice Line Amount |
| Payment | Payment |
| Payment amount | Payment TotalAmt |

## API Rate Limits

QuickBooks API has rate limits:
- **Production**: 500 requests per minute, 5000 per day per company
- **Sandbox**: 100 requests per minute, 1000 per day

DiveStreams handles this by:
- Queuing sync jobs with retry logic
- Exponential backoff on failures
- Batching related operations

## Troubleshooting

### Connection Issues

**Error**: "QuickBooks not connected"
- **Solution**: Reconnect QuickBooks via Settings → Integrations

**Error**: "Token refresh failed"
- **Solution**: Disconnect and reconnect QuickBooks (tokens expire after 100 days)

### Sync Failures

Check sync logs in QuickBooks settings page:
1. Go to **Settings → Integrations → QuickBooks**
2. Click **Show Details** under Sync History
3. Review failed operations

Common errors:
- **Customer already exists** - QuickBooks found duplicate by email
- **Invoice validation failed** - Missing required fields
- **Rate limit exceeded** - Too many requests, will retry automatically

### Token Expiration

QuickBooks tokens expire:
- **Access Token**: 1 hour (auto-refreshed)
- **Refresh Token**: 100 days (must reconnect)

When refresh token expires, users must reconnect QuickBooks.

## Security Considerations

1. **OAuth Tokens**: Encrypted at application level before database storage
2. **State Parameter**: Includes nonce to prevent CSRF attacks
3. **Realm ID Validation**: Verified during OAuth callback
4. **HTTPS Required**: OAuth callback must use HTTPS in production

## Testing

### Sandbox Environment

Use QuickBooks Sandbox for testing:

1. Set `QUICKBOOKS_SANDBOX=true` in `.env`
2. Create test company in QuickBooks Sandbox
3. Connect DiveStreams to sandbox company
4. Test sync operations

### Test Data

Create test scenarios:
- New customer booking (should create customer + invoice)
- Existing customer booking (should create invoice only)
- Payment on invoice (should record payment)
- Failed sync (check error handling)

## Production Deployment

Before going live:

1. Switch to production credentials:
   ```bash
   QUICKBOOKS_SANDBOX=false
   QUICKBOOKS_CLIENT_ID=production_client_id
   QUICKBOOKS_CLIENT_SECRET=production_client_secret
   ```

2. Update OAuth redirect URIs in Intuit Developer Portal

3. Test connection with real QuickBooks company

4. Enable auto-sync for users

5. Monitor sync logs for errors

## Support Resources

- [QuickBooks API Documentation](https://developer.intuit.com/app/developer/qbo/docs/develop)
- [OAuth 2.0 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [API Explorer](https://developer.intuit.com/app/developer/qbo/docs/develop/explore-the-api)
- [Rate Limits](https://developer.intuit.com/app/developer/qbo/docs/develop/troubleshooting/rate-limits)

## Maintenance

### Token Management

Tokens should be refreshed automatically, but monitor:
- Failed token refreshes in logs
- Expired integrations (> 100 days old)
- Disconnected integrations

### Sync Monitoring

Regular checks:
- Review failed sync operations weekly
- Monitor queue size for bottlenecks
- Check API rate limit usage

### Database Cleanup

Periodically clean old sync logs:

```sql
-- Delete sync logs older than 90 days
DELETE FROM integration_sync_log
WHERE created_at < NOW() - INTERVAL '90 days'
  AND status IN ('success', 'failed');
```

## Webhook Support (Future)

QuickBooks supports webhooks for real-time updates. To implement:

1. Set up webhook endpoint in DiveStreams
2. Register webhook with QuickBooks
3. Handle incoming change notifications
4. Implement two-way sync

This is currently not implemented but can be added for bidirectional sync.
