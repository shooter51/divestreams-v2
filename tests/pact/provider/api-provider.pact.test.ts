/**
 * Pact Provider Verification Tests - DiveStreams API
 *
 * Verifies that the DiveStreams API provider honors the contracts
 * created by consumers (Frontend, Zapier, OAuth providers, Stripe).
 *
 * NOTE: This test requires the DiveStreams server to be running on port 5173.
 * Run `npm run dev` in a separate terminal before running this test.
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { Verifier } from "@pact-foundation/pact";
import path from "path";
import { createHash } from "crypto";

// Skip provider tests in CI - they require a running dev server
// Provider verification happens in the pact-tests.yml workflow instead
describe.skipIf(process.env.CI === "true")(
  "DiveStreams API Provider Verification",
  () => {
    const PORT = 5173; // Use default dev server port
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let _dbClient: unknown = null;
    let redisClient: { quit: () => Promise<void> } | null = null;

  beforeAll(async () => {
    console.log("[PACT] Preparing for provider verification...");

    // Import database and Redis connections
    const { db } = await import("../../../lib/db");
    const { getRedisConnection } = await import("../../../lib/redis.server");

    _dbClient = db;
    redisClient = getRedisConnection();

    // Wait for server to be ready (poll health endpoint)
    console.log("[PACT] Waiting for dev server on port", PORT);
    try {
      await waitForServer(`http://localhost:${PORT}/api/health`, 10000);
      console.log("[PACT] Server is ready for verification");
    } catch (error) {
      console.error(
        "[PACT] Server not ready. Please run `npm run dev` in a separate terminal."
      );
      throw error;
    }
  });

  afterAll(async () => {
    console.log("[PACT] Cleaning up...");

    // Close Redis connection
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch {
        // Ignore errors on cleanup
      }
    }

    console.log("[PACT] Cleanup complete");
  });

  it("validates contracts from all consumers", async () => {
    const opts = {
      // Provider details
      provider: "DiveStreamsAPI",
      providerBaseUrl: `http://localhost:${PORT}`,

      // Pact files to verify
      pactUrls: [
        path.resolve(
          process.cwd(),
          "pacts/contracts/DiveStreamsFrontend-DiveStreamsAPI.json"
        ),
        path.resolve(
          process.cwd(),
          "pacts/contracts/Zapier-DiveStreamsAPI.json"
        ),
        path.resolve(
          process.cwd(),
          "pacts/contracts/OAuthProvider-DiveStreamsAPI.json"
        ),
        path.resolve(
          process.cwd(),
          "pacts/contracts/Stripe-DiveStreamsAPI.json"
        ),
      ],

      // State handlers to set up test data before each interaction
      stateHandlers: {
        // =====================================================================
        // HEALTH CHECK STATES
        // =====================================================================

        "all services are healthy": async () => {
          console.log("[STATE] Setting up: all services healthy");
          // No special setup - DB and Redis should be running
          return Promise.resolve({ description: "DB and Redis are healthy" });
        },

        "database is unavailable": async () => {
          console.log("[STATE] Setting up: database unavailable");
          // Note: We can't truly mock DB failure without breaking the app
          // This state relies on the health endpoint's error handling
          return Promise.resolve({ description: "DB failure state" });
        },

        "redis is unavailable": async () => {
          console.log("[STATE] Setting up: redis unavailable");
          // Note: We can't truly mock Redis failure without breaking the app
          // This state relies on the health endpoint's error handling
          return Promise.resolve({ description: "Redis failure state" });
        },

        // =====================================================================
        // ZAPIER API KEY STATES
        // =====================================================================

        "valid API key exists for organization": async () => {
          console.log("[STATE] Setting up: valid API key for organization");
          await setupTestOrgWithApiKey();
          return Promise.resolve({ description: "Created test org with valid API key" });
        },

        "API key is invalid": async () => {
          console.log("[STATE] Setting up: invalid API key");
          // No setup needed - invalid key won't match any DB record
          return Promise.resolve({ description: "No matching API key in database" });
        },

        "valid API key exists": async () => {
          console.log("[STATE] Setting up: valid API key exists");
          await setupTestOrgWithApiKey();
          return Promise.resolve({ description: "Created test org with valid API key" });
        },

        "valid API key and event type": async () => {
          console.log("[STATE] Setting up: valid API key and event type");
          await setupTestOrgWithApiKey();
          return Promise.resolve({ description: "Test org with API key ready for events" });
        },

        "valid API key and trip exists": async () => {
          console.log("[STATE] Setting up: valid API key and trip");
          await setupTestOrgWithApiKeyAndTrip();
          return Promise.resolve({ description: "Created test org, API key, and trip" });
        },

        // =====================================================================
        // OAUTH CALLBACK STATES (Google, QuickBooks, Xero, Mailchimp)
        // =====================================================================

        "valid OAuth state and code": async () => {
          console.log("[STATE] Setting up: valid OAuth state and code");
          // OAuth state is base64url-encoded JSON with orgId - no storage needed
          await setupTestOrg();
          return Promise.resolve({ description: "Test org ready for OAuth callback" });
        },

        "OAuth error occurred": async () => {
          console.log("[STATE] Setting up: OAuth error occurred");
          // No setup needed - error parameter in URL triggers error flow
          return Promise.resolve({ description: "OAuth error flow" });
        },

        "code parameter is missing": async () => {
          console.log("[STATE] Setting up: code parameter missing");
          // No setup needed - missing code triggers error
          return Promise.resolve({ description: "Missing code parameter flow" });
        },

        "valid QuickBooks OAuth parameters": async () => {
          console.log("[STATE] Setting up: valid QuickBooks OAuth parameters");
          await setupTestOrg();
          return Promise.resolve({ description: "Test org ready for QuickBooks OAuth" });
        },

        "realmId parameter is missing": async () => {
          console.log("[STATE] Setting up: realmId parameter missing");
          // No setup needed - missing realmId triggers error
          return Promise.resolve({ description: "Missing realmId parameter flow" });
        },

        "valid Xero OAuth parameters": async () => {
          console.log("[STATE] Setting up: valid Xero OAuth parameters");
          await setupTestOrg();
          return Promise.resolve({ description: "Test org ready for Xero OAuth" });
        },

        "Xero OAuth error occurred": async () => {
          console.log("[STATE] Setting up: Xero OAuth error occurred");
          // No setup needed - error parameter triggers error flow
          return Promise.resolve({ description: "Xero OAuth error flow" });
        },

        "valid Mailchimp OAuth parameters": async () => {
          console.log("[STATE] Setting up: valid Mailchimp OAuth parameters");
          await setupTestOrg();
          return Promise.resolve({ description: "Test org ready for Mailchimp OAuth" });
        },

        "state parameter is missing": async () => {
          console.log("[STATE] Setting up: state parameter missing");
          // No setup needed - missing state triggers error
          return Promise.resolve({ description: "Missing state parameter flow" });
        },

        // =====================================================================
        // STRIPE WEBHOOK STATES
        // =====================================================================

        "valid Stripe signature": async () => {
          console.log("[STATE] Setting up: valid Stripe signature");
          // Note: Actual signature validation happens in Stripe SDK
          // Contract tests use valid signatures generated by the SDK
          return Promise.resolve({ description: "Valid Stripe signature expected" });
        },

        "invalid Stripe signature": async () => {
          console.log("[STATE] Setting up: invalid Stripe signature");
          // Contract tests use invalid signatures to trigger error flow
          return Promise.resolve({ description: "Invalid Stripe signature expected" });
        },
      },

      // Logging
      logLevel: "info",

      // Publish verification results (when using Pact Broker)
      publishVerificationResult: process.env.CI === "true",
      providerVersion: process.env.GITHUB_SHA || "dev",
      providerVersionBranch: process.env.GITHUB_REF_NAME || "local",
    };

    // Run verification
    const verifier = new Verifier(opts);

    try {
      await verifier.verifyProvider();
      console.log("[PACT] ✅ Provider verification complete!");
    } catch (error) {
      console.error("[PACT] ❌ Provider verification failed:", error);
      throw error;
    }
  }, 120000); // 120 second timeout for provider verification
  }
);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Wait for server to be ready by polling health endpoint
 */
async function waitForServer(url: string, timeout: number): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 503) {
        // Server is running (even if degraded)
        return;
      }
    } catch {
      // Server not ready yet, keep polling
    }

    // Wait 500ms before next attempt
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Server did not start within ${timeout}ms`);
}

/**
 * Set up a test organization
 */
async function setupTestOrg(): Promise<string> {
  const { db } = await import("../../../lib/db");
  const { organization, subscriptionPlan } = await import("../../../lib/db/schema/auth");
  const { eq } = await import("drizzle-orm");

  const testOrgId = "org-pact-test";

  // Check if org exists
  const existing = await db
    .select()
    .from(organization)
    .where(eq(organization.id, testOrgId))
    .limit(1);

  if (existing.length > 0) {
    return testOrgId;
  }

  // Get or create a subscription plan
  let planId: string;
  const plans = await db
    .select()
    .from(subscriptionPlan)
    .limit(1);

  if (plans.length === 0) {
    const [newPlan] = await db
      .insert(subscriptionPlan)
      .values({
        name: "Free Plan",
        slug: "free",
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: {},
        limits: {},
        isActive: true,
      })
      .returning();
    planId = newPlan.id;
  } else {
    planId = plans[0].id;
  }

  // Create test organization
  await db.insert(organization).values({
    id: testOrgId,
    name: "Test Dive Shop",
    slug: "test-dive-shop",
    email: "test@pacttest.com",
    subscriptionPlanId: planId,
  });

  return testOrgId;
}

/**
 * Set up test organization with a valid API key
 */
async function setupTestOrgWithApiKey(): Promise<{ orgId: string; apiKey: string }> {
  const orgId = await setupTestOrg();

  const { db } = await import("../../../lib/db");
  const { zapierApiKeys } = await import("../../../lib/db/schema/zapier");
  const { eq, and } = await import("drizzle-orm");

  const testApiKey = "valid-key-123";
  const keyHash = createHash("sha256").update(testApiKey).digest("hex");

  // Check if API key exists
  const existing = await db
    .select()
    .from(zapierApiKeys)
    .where(and(
      eq(zapierApiKeys.organizationId, orgId),
      eq(zapierApiKeys.keyHash, keyHash)
    ))
    .limit(1);

  if (existing.length > 0) {
    return { orgId, apiKey: testApiKey };
  }

  // Create API key
  await db.insert(zapierApiKeys).values({
    organizationId: orgId,
    keyHash,
    keyPrefix: "valid-ke",
    label: "Pact Test Key",
    isActive: true,
  });

  return { orgId, apiKey: testApiKey };
}

/**
 * Set up test organization with API key and a trip
 */
async function setupTestOrgWithApiKeyAndTrip(): Promise<void> {
  const { orgId } = await setupTestOrgWithApiKey();

  const { db } = await import("../../../lib/db");
  const { trips, tours } = await import("../../../lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const testTripId = "trip-123";

  // Check if trip exists
  const existing = await db
    .select()
    .from(trips)
    .where(eq(trips.id, testTripId))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  // Create a tour first (required for trip)
  const [tour] = await db
    .insert(tours)
    .values({
      organizationId: orgId,
      name: "Test Dive Tour",
      description: "Test tour for Pact verification",
      price: 100,
      duration: 120,
      maxParticipants: 10,
    })
    .returning();

  // Create trip
  await db.insert(trips).values({
    id: testTripId,
    organizationId: orgId,
    tourId: tour.id,
    startTime: new Date("2024-06-01T09:00:00Z"),
    endTime: new Date("2024-06-01T11:00:00Z"),
    maxParticipants: 10,
    availableSpots: 10,
    status: "scheduled",
  });
}
