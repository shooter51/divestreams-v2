# Google Calendar Integration Setup Guide

This guide will help you set up the Google Calendar integration for DiveStreams, allowing automatic synchronization of trips and bookings with Google Calendar.

## Prerequisites

- Access to [Google Cloud Console](https://console.cloud.google.com/)
- Admin access to your DiveStreams organization
- A Google Workspace or Gmail account

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Create Project** or select an existing project
3. Enter a project name (e.g., "DiveStreams Calendar Integration")
4. Click **Create**

## Step 2: Enable Google Calendar API

1. In the Google Cloud Console, navigate to **APIs & Services > Library**
2. Search for "Google Calendar API"
3. Click on **Google Calendar API**
4. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Navigate to **APIs & Services > OAuth consent screen**
2. Select **External** user type (unless using Google Workspace)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: DiveStreams
   - **User support email**: Your support email
   - **Developer contact information**: Your email
5. Click **Save and Continue**
6. On the **Scopes** page, click **Add or Remove Scopes**
7. Add these scopes:
   - `https://www.googleapis.com/auth/calendar.events` (View and edit events)
   - `https://www.googleapis.com/auth/calendar.readonly` (View calendars)
   - `https://www.googleapis.com/auth/userinfo.email` (View email address)
   - `https://www.googleapis.com/auth/userinfo.profile` (View basic profile)
8. Click **Update** and then **Save and Continue**
9. Add test users if needed (for testing phase)
10. Click **Save and Continue** and review the summary

## Step 4: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services > Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application** as the application type
4. Enter a name (e.g., "DiveStreams Web Client")
5. Under **Authorized redirect URIs**, add:
   - For production: `https://divestreams.com/api/integrations/google/callback`
   - For staging: `https://staging.divestreams.com/api/integrations/google/callback`
   - For development: `http://localhost:5173/api/integrations/google/callback`
   - For tenant-specific: `https://*.divestreams.com/api/integrations/google/callback`
6. Click **Create**
7. **Save the Client ID and Client Secret** - you'll need these for configuration

## Step 5: Configure DiveStreams Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Google Calendar Integration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

For production/staging deployments, set these in your VPS environment:

```bash
# On the VPS (via SSH or control panel)
cd /docker/divestreams-v2  # or /docker/divestreams-staging
echo "GOOGLE_CLIENT_ID=your-client-id-here" >> .env
echo "GOOGLE_CLIENT_SECRET=your-client-secret-here" >> .env

# Restart the application
docker-compose restart app
```

## Step 6: Connect Google Calendar in DiveStreams

1. Log in to your DiveStreams admin panel
2. Navigate to **Settings > Integrations**
3. Find the **Google Calendar** card
4. Click **Connect**
5. You'll be redirected to Google's consent screen
6. Review the permissions and click **Allow**
7. You'll be redirected back to DiveStreams

## Step 7: Configure Calendar Sync Settings

After connecting, configure your sync preferences:

1. **Select Calendar**: Choose which Google Calendar to sync with (default is "Primary")
2. **Enable Auto-Sync**: Toggle automatic synchronization
3. **Sync Direction**: One-way (DiveStreams → Google) or Two-way (coming soon)

## Features

### Automatic Sync

When auto-sync is enabled, the following events trigger calendar updates:

- **Trip Created**: New calendar event is created
- **Trip Updated**: Calendar event is updated (date, time, details)
- **Trip Status Changed**: Event title reflects status (confirmed, completed, cancelled)
- **Trip Deleted**: Calendar event is removed
- **Booking Created**: Customer added as attendee to trip event
- **Booking Cancelled**: Customer removed from attendees

### Manual Sync

You can manually trigger a bulk sync of all trips:

1. Go to **Settings > Integrations > Google Calendar**
2. Click **Sync Now**
3. Select date range (default: next 90 days)
4. Review sync results

### Calendar Event Structure

Each trip synced to Google Calendar includes:

- **Title**: `[Tour Name] - [Status]`
- **Description**: Trip details, booking link, and notes
- **Start Time**: Trip start date and time
- **End Time**: Trip end date and time (or +2 hours if not specified)
- **Location**: Dive site location (if available)
- **Attendees**: Customers with confirmed bookings (if enabled)

## Troubleshooting

### "Access Denied" Error

- Ensure you've added the correct redirect URIs in Google Cloud Console
- Check that the redirect URI exactly matches (including protocol and trailing slashes)
- Verify the Client ID and Client Secret are correctly set in environment variables

### Calendar Events Not Syncing

- Check integration status in Settings > Integrations
- Review sync logs for error messages
- Verify the integration hasn't expired (refresh tokens automatically)
- Try disconnecting and reconnecting the integration

### Token Expired

The integration automatically refreshes expired access tokens. If you see persistent token errors:

1. Disconnect the integration
2. Reconnect to get fresh tokens
3. If issues persist, check Google Cloud Console for API quota limits

### Events Duplicated

If you see duplicate events:

1. Go to Settings > Integrations > Google Calendar
2. Click **Disconnect**
3. In Google Calendar, manually delete duplicate events
4. Reconnect the integration
5. Click **Sync Now** to resync

## Security Notes

- OAuth tokens are encrypted before storage in the database using AES-256-GCM
- Refresh tokens are used to automatically renew expired access tokens
- Integration can be disconnected at any time, removing all stored credentials
- Access can be revoked from Google Account settings at any time

## API Rate Limits

Google Calendar API has the following limits:

- **Queries per day**: 1,000,000
- **Queries per 100 seconds per user**: 1,000

DiveStreams handles rate limiting automatically and will retry failed requests.

## Support

If you need help with Google Calendar integration:

1. Check the sync logs in Settings > Integrations > Google Calendar
2. Review the troubleshooting section above
3. Contact DiveStreams support with integration ID and error messages

## Appendix: OAuth Scopes Explained

| Scope | Purpose | Required |
|-------|---------|----------|
| `calendar.events` | Create, update, and delete calendar events | Yes |
| `calendar.readonly` | Read calendar list and event details | Yes |
| `userinfo.email` | Display connected account email | Yes |
| `userinfo.profile` | Display connected account name | Yes |

## Next Steps

- Configure notification preferences for calendar updates
- Set up team member calendar access
- Explore Zapier integration for advanced workflows
- Review analytics for booking patterns based on calendar availability
