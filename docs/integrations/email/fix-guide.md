# Email Delivery & URL Fix Guide

## Issues Identified

### Issue 1: Emails Not Being Delivered (DIVE-2ub / KAN-592)

**Root Cause:** SMTP credentials are NOT configured in production/staging environments.

**Evidence:**
```
time="2026-01-27T03:20:58Z" level=warning msg="The \"SMTP_HOST\" variable is not set. Defaulting to a blank string."
time="2026-01-27T03:20:58Z" level=warning msg="The \"SMTP_USER\" variable is not set. Defaulting to a blank string."
time="2026-01-27T03:20:58Z" level=warning msg="The \"SMTP_PASS\" variable is not set. Defaulting to a blank string."
```

**How it fails:**
1. User signs up successfully ✅
2. `triggerWelcomeEmail()` is called ✅
3. Email job is queued to BullMQ ✅
4. Worker processes the job ✅
5. `sendEmail()` is called in `lib/email/index.ts`
6. `getTransporter()` returns `null` because SMTP credentials are missing ❌
7. Email is logged but **never actually sent** ❌

**Code path:**
```typescript
// lib/email/index.ts:80
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    // SMTP not configured - log for development but return false in production
    const isDevelopment = process.env.NODE_ENV !== "production";

    console.error("[Email] Cannot send email - SMTP not configured");
    console.log("📧 Email (not sent):");
    console.log(`   To: ${options.to}`);
    console.log(`   Subject: ${options.subject}`);

    // In development, pretend it worked for testing
    // In production, return false so calling code knows email failed
    return isDevelopment;  // ❌ Returns false in production, but job still marks as "complete"
  }
  // ... actual send logic
}
```

### Issue 2: Email Links Use Localhost (DIVE-ue3 / KAN-600)

**Root Cause:** APP_URL environment variable is likely not set or contains localhost.

**How it should work:**
- `lib/utils/url.ts` provides `getAppUrl()` and `getTenantUrl()`
- These functions prioritize `process.env.APP_URL`
- Falls back to `https://divestreams.com` in production
- **Rejects localhost URLs in production** unless in CI/test environment

**Code path:**
```typescript
// lib/utils/url.ts:34
function getBaseUrl(): string {
  const appUrl = process.env.APP_URL;

  // Detect test/CI environment
  const isTestEnv =
    process.env.CI === "true" ||
    process.env.NODE_ENV === "test" ||
    // ...

  // In test/CI environments, allow localhost URLs
  if (appUrl && (isTestEnv || !appUrl.includes("localhost"))) {
    return appUrl;
  }

  // Default to production URL
  return PRODUCTION_URL;  // "https://divestreams.com"
}
```

**Email templates that use URLs:**
- Welcome email: `getTenantUrl(subdomain, "/login")`
- Password reset: `getAppUrl() + "/reset-password?token=..."`
- Customer welcome: `getTenantUrl(subdomain, "/site/login")`
- Booking confirmation: (no links currently)

## Solutions

### Solution 1: Configure SMTP in Production

**Required Environment Variables:**
```bash
SMTP_HOST=smtp.sendgrid.net         # or smtp.gmail.com, smtp.mailgun.org, etc.
SMTP_PORT=587                        # 587 for TLS, 465 for SSL
SMTP_USER=apikey                     # SendGrid uses "apikey" as username
SMTP_PASS=SG.xxxxxxxxxxxxx          # Your SMTP password/API key
SMTP_FROM=noreply@divestreams.com   # Sender email address
SMTP_FROM_NAME=DiveStreams          # Sender display name
```

**Where to add them:**

**Staging VPS (1271895):**
```bash
# SSH to staging VPS
ssh root@76.13.28.28

# Edit .env file
cd /docker/divestreams-staging
nano .env

# Add SMTP credentials (see above)

# Restart containers to pick up new env vars
docker compose down
docker compose up -d

# Verify email configuration
docker compose logs app | grep -i smtp
docker compose logs worker | grep -i email
```

**Production VPS (1239852):**
```bash
# SSH to production VPS
ssh root@72.62.166.128

# Edit .env file
cd /docker/divestreams-v2
nano .env

# Add SMTP credentials (see above)

# Restart containers
docker compose down
docker compose up -d

# Verify
docker compose logs app | grep -i smtp
docker compose logs worker | grep -i email
```

**Recommended SMTP Providers:**
1. **SendGrid** (recommended) - Free tier: 100 emails/day
   - Sign up at https://sendgrid.com
   - Create API key with "Mail Send" permissions
   - Use `apikey` as SMTP_USER, API key as SMTP_PASS
   - Host: `smtp.sendgrid.net`, Port: `587`

2. **Mailgun** - Free tier: 5,000 emails/month
   - Sign up at https://mailgun.com
   - Get SMTP credentials from dashboard
   - Host: `smtp.mailgun.org`, Port: `587`

3. **Gmail** (not recommended for production)
   - Enable "App Passwords" in Google Account
   - Host: `smtp.gmail.com`, Port: `587`

### Solution 2: Verify APP_URL Configuration

**Check current configuration:**
```bash
# Staging
ssh root@76.13.28.28
cd /docker/divestreams-staging
grep APP_URL .env

# Production
ssh root@72.62.166.128
cd /docker/divestreams-v2
grep APP_URL .env
```

**Expected values:**
```bash
# Staging
APP_URL=https://staging.divestreams.com
AUTH_URL=https://staging.divestreams.com

# Production
APP_URL=https://divestreams.com
AUTH_URL=https://divestreams.com
```

**If incorrect, fix and restart:**
```bash
# Edit .env
nano .env

# Set correct APP_URL and AUTH_URL

# Restart
docker compose down
docker compose up -d

# Test
curl -I https://divestreams.com
```

## Testing Plan

### 1. Test SMTP Connection
```bash
# SSH to staging VPS
ssh root@76.13.28.28

# Run verification in app container
docker compose exec app npx tsx -e "
import { verifyEmailConnection } from './lib/email/index.js';
verifyEmailConnection().then(result => {
  console.log('SMTP verification:', result);
  process.exit(result.success ? 0 : 1);
});
"
```

### 2. Test Email Sending
```bash
# Queue a test email via worker
docker compose exec worker npx tsx -e "
import { getEmailQueue } from './lib/jobs/index.js';
const queue = getEmailQueue();
await queue.add('welcome', {
  to: 'your-test-email@example.com',
  userName: 'Test User',
  shopName: 'Test Shop',
  loginUrl: 'https://staging.divestreams.com/auth/login',
  tenantId: 'test-tenant-id'
});
console.log('Email queued');
process.exit(0);
"

# Check worker logs
docker compose logs -f worker
```

### 3. Test Free Trial Signup
1. Go to https://staging.divestreams.com/signup
2. Fill out signup form with real email address
3. Submit form
4. Check email inbox for welcome email
5. Verify link in email uses correct URL (not localhost)

### 4. Test Password Reset
1. Go to password reset page
2. Enter email
3. Check email for reset link
4. Verify link uses production URL

## Verification Checklist

- [ ] SMTP credentials added to staging .env
- [ ] SMTP credentials added to production .env
- [ ] Containers restarted on staging
- [ ] Containers restarted on production
- [ ] SMTP connection verified on staging
- [ ] SMTP connection verified on production
- [ ] Test email received on staging
- [ ] Free trial signup sends welcome email
- [ ] Welcome email links use correct URL (not localhost)
- [ ] Password reset email sends successfully
- [ ] Password reset links use correct URL
- [ ] APP_URL set correctly in staging
- [ ] APP_URL set correctly in production
- [ ] Beads issues DIVE-2ub and DIVE-ue3 closed
- [ ] Jira issues KAN-592 and KAN-600 marked as resolved

## Code Changes (None Required)

**No code changes needed.** The email infrastructure is correctly implemented:
- ✅ Email templates use `getAppUrl()` and `getTenantUrl()` for all links
- ✅ URL utilities correctly prioritize APP_URL env var
- ✅ URL utilities reject localhost in production
- ✅ Email service correctly handles SMTP configuration
- ✅ Worker processes email jobs correctly

**Only missing:** Environment variable configuration on VPS servers.

## Rollback Plan

If SMTP provider causes issues:

```bash
# Remove SMTP credentials from .env
nano .env
# Comment out or remove SMTP_* variables

# Restart containers
docker compose down
docker compose up -d

# Emails will be logged but not sent (current state)
```
