/**
 * Verify Stripe Webhook Configuration
 *
 * Phase 3: Fix webhook status update (KAN-627)
 * Checks if webhook endpoints are registered and working.
 *
 * Usage:
 *   npx tsx scripts/verify-stripe-webhooks.ts
 */

import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const APP_URL = process.env.APP_URL || process.env.AUTH_URL || "https://staging.divestreams.com";

if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY environment variable not set");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const REQUIRED_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "checkout.session.completed",
];

async function verifyWebhooks() {
  console.log("🔍 Verifying Stripe webhook configuration...\n");
  console.log(`App URL: ${APP_URL}\n`);

  try {
    // List all webhook endpoints
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });

    console.log(`Found ${endpoints.data.length} webhook endpoint(s):\n`);

    if (endpoints.data.length === 0) {
      console.log("⚠️  No webhook endpoints found!");
      console.log("\nTo register a webhook endpoint:");
      console.log("1. Go to: https://dashboard.stripe.com/webhooks");
      console.log("2. Click 'Add endpoint'");
      console.log(`3. Enter URL: ${APP_URL}/api/stripe-webhook`);
      console.log("4. Select events:");
      REQUIRED_EVENTS.forEach((event) => console.log(`   - ${event}`));
      console.log("\nOr run this script with --register flag to auto-register\n");
      return false;
    }

    let hasValidEndpoint = false;

    for (const endpoint of endpoints.data) {
      console.log(`📌 Endpoint: ${endpoint.id}`);
      console.log(`   URL: ${endpoint.url}`);
      console.log(`   Status: ${endpoint.status}`);
      console.log(`   API Version: ${endpoint.api_version || "default"}`);
      console.log(`   Events (${endpoint.enabled_events.length}):`);

      const missingEvents = REQUIRED_EVENTS.filter(
        (event) => !endpoint.enabled_events.includes(event)
      );

      if (endpoint.enabled_events.includes("*")) {
        console.log(`   ✅ Listening to ALL events (wildcard *)`);
      } else {
        REQUIRED_EVENTS.forEach((event) => {
          const hasEvent = endpoint.enabled_events.includes(event);
          console.log(`   ${hasEvent ? "✅" : "❌"} ${event}`);
        });
      }

      // Check if this endpoint is for our app
      const isOurEndpoint =
        endpoint.url.includes("/api/stripe-webhook") ||
        endpoint.url.includes("/stripe/webhook");

      const hasAllEvents =
        endpoint.enabled_events.includes("*") || missingEvents.length === 0;

      if (isOurEndpoint && endpoint.status === "enabled" && hasAllEvents) {
        hasValidEndpoint = true;
        console.log(`   ✅ Valid endpoint for this app\n`);
      } else {
        if (!isOurEndpoint) {
          console.log(`   ⚠️  URL does not match app URL (${APP_URL})`);
        }
        if (endpoint.status !== "enabled") {
          console.log(`   ⚠️  Endpoint is disabled`);
        }
        if (!hasAllEvents) {
          console.log(`   ⚠️  Missing required events: ${missingEvents.join(", ")}`);
        }
        console.log();
      }
    }

    if (!hasValidEndpoint) {
      console.log("❌ No valid webhook endpoint found for this app\n");
      console.log(`Expected URL: ${APP_URL}/api/stripe-webhook\n`);
      console.log("To register a webhook endpoint:");
      console.log("1. Go to: https://dashboard.stripe.com/webhooks");
      console.log("2. Click 'Add endpoint'");
      console.log(`3. Enter URL: ${APP_URL}/api/stripe-webhook`);
      console.log("4. Select events:");
      REQUIRED_EVENTS.forEach((event) => console.log(`   - ${event}`));
      console.log("\nOr run this script with --register flag to auto-register\n");
      return false;
    }

    console.log("✅ Webhook configuration is valid!\n");
    return true;

  } catch (error: any) {
    console.error("❌ Failed to verify webhooks:", error.message);
    return false;
  }
}

async function registerWebhook() {
  console.log("📝 Registering webhook endpoint...\n");

  const webhookUrl = `${APP_URL}/api/stripe-webhook`;

  try {
    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: REQUIRED_EVENTS,
      api_version: "2023-10-16", // Use a specific API version for consistency
    });

    console.log("✅ Webhook endpoint registered successfully!\n");
    console.log(`Endpoint ID: ${endpoint.id}`);
    console.log(`URL: ${endpoint.url}`);
    console.log(`Secret: ${endpoint.secret} (save this to STRIPE_WEBHOOK_SECRET)\n`);
    console.log("⚠️  IMPORTANT: Add this to your environment variables:");
    console.log(`STRIPE_WEBHOOK_SECRET="${endpoint.secret}"\n`);

    return true;
  } catch (error: any) {
    console.error("❌ Failed to register webhook:", error.message);

    if (error.type === "StripeInvalidRequestError") {
      console.error("\nPossible reasons:");
      console.error("- Webhook URL is not accessible from the internet");
      console.error("- Webhook URL already exists");
      console.error("- Invalid API key\n");
    }

    return false;
  }
}

async function testWebhook(endpointId: string) {
  console.log("🧪 Testing webhook endpoint...\n");

  try {
    // Trigger a test event
    const event = await stripe.events.create({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_test_123",
          status: "active",
          metadata: {
            organizationId: "test-org",
          },
          items: {
            data: [
              {
                price: {
                  id: "price_test_123",
                },
              },
            ],
          },
        } as any,
      },
    } as any);

    console.log(`✅ Test event created: ${event.id}\n`);
    console.log("Check your application logs to verify the webhook was received.\n");

    return true;
  } catch (error: any) {
    console.error("❌ Failed to create test event:", error.message);
    console.log("\nNote: Event simulation requires Stripe CLI (stripe trigger)\n");
    return false;
  }
}

async function main() {
  console.log("🚀 Stripe Webhook Verification Script (KAN-627)\n");

  const shouldRegister = process.argv.includes("--register");
  const shouldTest = process.argv.includes("--test");

  if (shouldRegister) {
    const success = await registerWebhook();
    if (!success) {
      process.exit(1);
    }
  } else {
    const isValid = await verifyWebhooks();

    if (!isValid) {
      console.log("Run with --register flag to automatically create a webhook endpoint\n");
      process.exit(1);
    }

    if (shouldTest) {
      // Get the first enabled endpoint
      const endpoints = await stripe.webhookEndpoints.list({ limit: 1 });
      if (endpoints.data.length > 0) {
        await testWebhook(endpoints.data[0].id);
      }
    }
  }

  console.log("=".repeat(60));
  console.log("✅ Webhook verification complete!");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
