#!/bin/sh
set -e

echo "DiveStreams v2 - Starting..."

# Wait for database to be ready
echo "Waiting for database..."
MAX_RETRIES=30
RETRY_COUNT=0
until node -e "
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
sql\`SELECT 1\`.then(() => { sql.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "Database connection failed after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "Database not ready yet... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
echo "Database is ready!"

# Always run migrations (they are idempotent)
echo "Running database migrations..."
node /app/scripts/run-migrations.mjs
echo "Migrations complete!"

# Ensure all existing users have emailVerified=true
# Better Auth's requireEmailVerification blocks login for unverified users.
# Tenant signup sets this automatically, but users created via admin panel
# or older code paths may have emailVerified=false/NULL.
echo "Ensuring all user emails are verified..."
node -e "
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
sql\`UPDATE \"user\" SET \"email_verified\" = true WHERE \"email_verified\" = false OR \"email_verified\" IS NULL\`
  .then(result => { console.log('  Updated', result.count, 'users'); return sql.end(); })
  .catch(err => { console.error('  Warning:', err.message); return sql.end(); });
"

# Fix plan features: ensure boolean flags are stored (not just marketing strings)
echo "Ensuring plan features have boolean flags..."
node -e "
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
const plans = {
  free: {has_tours_bookings:true,has_equipment_boats:false,has_training:false,has_pos:false,has_public_site:false,has_advanced_notifications:false,has_integrations:false,has_api_access:false,has_stripe:true,has_google_calendar:false,has_mailchimp:false,has_quickbooks:false,has_zapier:false,has_twilio:false,has_whatsapp:false,has_xero:false},
  starter: {has_tours_bookings:true,has_equipment_boats:true,has_training:false,has_pos:false,has_public_site:true,has_advanced_notifications:false,has_integrations:false,has_api_access:false,has_stripe:true,has_google_calendar:true,has_mailchimp:false,has_quickbooks:false,has_zapier:false,has_twilio:false,has_whatsapp:false,has_xero:false},
  pro: {has_tours_bookings:true,has_equipment_boats:true,has_training:true,has_pos:true,has_public_site:true,has_advanced_notifications:true,has_integrations:true,has_api_access:false,has_stripe:true,has_google_calendar:true,has_mailchimp:true,has_quickbooks:true,has_zapier:true,has_twilio:true,has_whatsapp:false,has_xero:false},
  enterprise: {has_tours_bookings:true,has_equipment_boats:true,has_training:true,has_pos:true,has_public_site:true,has_advanced_notifications:true,has_integrations:true,has_api_access:true,has_stripe:true,has_google_calendar:true,has_mailchimp:true,has_quickbooks:true,has_zapier:true,has_twilio:true,has_whatsapp:true,has_xero:true}
};
(async () => {
  for (const [name, features] of Object.entries(plans)) {
    const rows = await sql\`SELECT id, features FROM subscription_plans WHERE name = \${name}\`;
    if (rows.length && (!rows[0].features || !rows[0].features.has_tours_bookings)) {
      const merged = { ...features, descriptions: Array.isArray(rows[0].features) ? rows[0].features : (rows[0].features?.descriptions || []) };
      await sql\`UPDATE subscription_plans SET features = \${JSON.stringify(merged)}::jsonb WHERE name = \${name}\`;
      console.log('  Fixed', name, 'plan features');
    }
  }
  await sql.end();
})().catch(err => { console.error('  Warning:', err.message); });
"

# Create platform admin if PLATFORM_ADMIN_EMAIL is set
if [ -n "$PLATFORM_ADMIN_EMAIL" ] && [ -n "$PLATFORM_ADMIN_PASSWORD" ]; then
  echo "Checking for platform admin setup..."
  node /app/scripts/setup-admin.mjs
fi

# Start the application
echo "Starting DiveStreams application..."
# If arguments are provided, run them; otherwise run default start command
if [ $# -gt 0 ]; then
  exec "$@"
else
  exec npm run start
fi
