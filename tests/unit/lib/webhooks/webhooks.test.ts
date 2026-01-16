/**
 * Webhook Utilities Tests
 *
 * Tests for webhook signature generation, verification, and helper functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateWebhookSecret,
  signPayload,
  verifySignature,
  WEBHOOK_EVENT_DESCRIPTIONS,
  WEBHOOK_EVENTS,
} from "../../../../lib/webhooks/index.server";

describe("webhooks", () => {
  // ============================================================================
  // Constants Tests
  // ============================================================================
  describe("constants", () => {
    it("exports WEBHOOK_EVENTS array", () => {
      expect(WEBHOOK_EVENTS).toBeDefined();
      expect(Array.isArray(WEBHOOK_EVENTS)).toBe(true);
      expect(WEBHOOK_EVENTS.length).toBeGreaterThan(0);
    });

    it("has descriptions for all webhook events", () => {
      WEBHOOK_EVENTS.forEach((event) => {
        expect(WEBHOOK_EVENT_DESCRIPTIONS[event]).toBeDefined();
        expect(typeof WEBHOOK_EVENT_DESCRIPTIONS[event]).toBe("string");
        expect(WEBHOOK_EVENT_DESCRIPTIONS[event].length).toBeGreaterThan(0);
      });
    });

    it("contains expected webhook events", () => {
      expect(WEBHOOK_EVENTS).toContain("booking.created");
      expect(WEBHOOK_EVENTS).toContain("booking.updated");
      expect(WEBHOOK_EVENTS).toContain("booking.cancelled");
      expect(WEBHOOK_EVENTS).toContain("customer.created");
      expect(WEBHOOK_EVENTS).toContain("customer.updated");
      expect(WEBHOOK_EVENTS).toContain("payment.received");
      expect(WEBHOOK_EVENTS).toContain("payment.refunded");
      expect(WEBHOOK_EVENTS).toContain("trip.completed");
    });

    it("has meaningful event descriptions", () => {
      expect(WEBHOOK_EVENT_DESCRIPTIONS["booking.created"]).toContain("booking");
      expect(WEBHOOK_EVENT_DESCRIPTIONS["customer.created"]).toContain("customer");
      expect(WEBHOOK_EVENT_DESCRIPTIONS["payment.received"]).toContain("payment");
    });
  });

  // ============================================================================
  // generateWebhookSecret Tests
  // ============================================================================
  describe("generateWebhookSecret", () => {
    it("generates a secret with whsec_ prefix", () => {
      const secret = generateWebhookSecret();
      expect(secret.startsWith("whsec_")).toBe(true);
    });

    it("generates a secret of correct length", () => {
      const secret = generateWebhookSecret();
      // whsec_ (6 chars) + 64 hex chars = 70 chars
      expect(secret.length).toBe(70);
    });

    it("generates unique secrets", () => {
      const secrets = new Set<string>();
      for (let i = 0; i < 100; i++) {
        secrets.add(generateWebhookSecret());
      }
      expect(secrets.size).toBe(100);
    });

    it("generates hex characters after prefix", () => {
      const secret = generateWebhookSecret();
      const hexPart = secret.slice(6);
      expect(hexPart).toMatch(/^[0-9a-f]+$/);
    });
  });

  // ============================================================================
  // signPayload Tests
  // ============================================================================
  describe("signPayload", () => {
    const payload = { event: "test", data: { id: "123" } };
    const secret = "whsec_abcdef1234567890";
    const timestamp = 1704067200; // 2024-01-01 00:00:00 UTC

    it("returns signature in correct format", () => {
      const signature = signPayload(payload, secret, timestamp);
      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
    });

    it("includes timestamp in signature", () => {
      const signature = signPayload(payload, secret, timestamp);
      expect(signature).toContain(`t=${timestamp}`);
    });

    it("generates consistent signatures for same inputs", () => {
      const sig1 = signPayload(payload, secret, timestamp);
      const sig2 = signPayload(payload, secret, timestamp);
      expect(sig1).toBe(sig2);
    });

    it("generates different signatures for different payloads", () => {
      const sig1 = signPayload({ event: "a" }, secret, timestamp);
      const sig2 = signPayload({ event: "b" }, secret, timestamp);
      expect(sig1).not.toBe(sig2);
    });

    it("generates different signatures for different secrets", () => {
      const sig1 = signPayload(payload, "whsec_secret1", timestamp);
      const sig2 = signPayload(payload, "whsec_secret2", timestamp);
      expect(sig1).not.toBe(sig2);
    });

    it("generates different signatures for different timestamps", () => {
      const sig1 = signPayload(payload, secret, 1000);
      const sig2 = signPayload(payload, secret, 2000);
      expect(sig1).not.toBe(sig2);
    });

    it("handles secret without whsec_ prefix", () => {
      const secretWithoutPrefix = "abcdef1234567890";
      const secretWithPrefix = "whsec_abcdef1234567890";

      const sig1 = signPayload(payload, secretWithoutPrefix, timestamp);
      const sig2 = signPayload(payload, secretWithPrefix, timestamp);

      // Both should produce valid signatures
      expect(sig1).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
      expect(sig2).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
    });

    it("uses current time when timestamp not provided", () => {
      const before = Math.floor(Date.now() / 1000);
      const signature = signPayload(payload, secret);
      const after = Math.floor(Date.now() / 1000);

      const match = signature.match(/t=(\d+)/);
      expect(match).not.toBeNull();
      const sigTimestamp = parseInt(match![1], 10);

      expect(sigTimestamp).toBeGreaterThanOrEqual(before);
      expect(sigTimestamp).toBeLessThanOrEqual(after);
    });

    it("handles complex nested payloads", () => {
      const complexPayload = {
        event: "booking.created",
        data: {
          id: "booking-123",
          customer: {
            id: "cust-456",
            name: "John Doe",
            email: "john@example.com",
          },
          items: [
            { trip: "trip-1", participants: 2 },
            { trip: "trip-2", participants: 1 },
          ],
          total: 299.99,
        },
      };

      const signature = signPayload(complexPayload, secret, timestamp);
      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
    });
  });

  // ============================================================================
  // verifySignature Tests
  // ============================================================================
  describe("verifySignature", () => {
    const payload = { event: "test", data: { id: "123" } };
    const secret = "whsec_abcdef1234567890";

    it("returns true for valid signature", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signPayload(payload, secret, timestamp);

      const result = verifySignature(payload, signature, secret);
      expect(result).toBe(true);
    });

    it("returns false for invalid signature", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const invalidSignature = `t=${timestamp},v1=invalidhash123`;

      const result = verifySignature(payload, invalidSignature, secret);
      expect(result).toBe(false);
    });

    it("returns false for wrong secret", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signPayload(payload, secret, timestamp);
      const wrongSecret = "whsec_wrongsecret";

      const result = verifySignature(payload, signature, wrongSecret);
      expect(result).toBe(false);
    });

    it("returns false for modified payload", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signPayload(payload, secret, timestamp);
      const modifiedPayload = { ...payload, data: { id: "456" } };

      const result = verifySignature(modifiedPayload, signature, secret);
      expect(result).toBe(false);
    });

    it("returns false for expired signature (outside tolerance)", () => {
      // Use a timestamp from 10 minutes ago
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const signature = signPayload(payload, secret, oldTimestamp);

      const result = verifySignature(payload, signature, secret, 300); // 5 min tolerance
      expect(result).toBe(false);
    });

    it("returns true for signature within tolerance", () => {
      // Use a timestamp from 2 minutes ago
      const recentTimestamp = Math.floor(Date.now() / 1000) - 120;
      const signature = signPayload(payload, secret, recentTimestamp);

      const result = verifySignature(payload, signature, secret, 300); // 5 min tolerance
      expect(result).toBe(true);
    });

    it("returns false for malformed signature (missing timestamp)", () => {
      const result = verifySignature(payload, "v1=abc123", secret);
      expect(result).toBe(false);
    });

    it("returns false for malformed signature (missing version)", () => {
      const result = verifySignature(payload, "t=1234567890", secret);
      expect(result).toBe(false);
    });

    it("returns false for empty signature", () => {
      const result = verifySignature(payload, "", secret);
      expect(result).toBe(false);
    });

    it("handles custom tolerance values", () => {
      // Use a timestamp from 5 minutes ago
      const timestamp = Math.floor(Date.now() / 1000) - 300;
      const signature = signPayload(payload, secret, timestamp);

      // Should fail with 1 second tolerance
      expect(verifySignature(payload, signature, secret, 1)).toBe(false);

      // Should pass with 10 minute tolerance
      expect(verifySignature(payload, signature, secret, 600)).toBe(true);
    });

    it("uses default tolerance of 300 seconds", () => {
      // Use a timestamp from 4 minutes ago (within default 5 min)
      const timestamp = Math.floor(Date.now() / 1000) - 240;
      const signature = signPayload(payload, secret, timestamp);

      const result = verifySignature(payload, signature, secret);
      expect(result).toBe(true);
    });

    it("handles signature verification errors gracefully", () => {
      // Completely invalid signature format
      const result = verifySignature(payload, "not-a-signature", secret);
      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// CRUD Operations Tests (with mocked database)
// ============================================================================

// Use vi.hoisted to ensure mock variables are created before vi.mock
const { dbMock, mockReturning } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const mockReturning = vi.fn();

  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.returning = mockReturning;

  // Make chain itself thenable for terminal operations
  chain.then = (resolve: (value: unknown[]) => void) => {
    resolve([]);
    return chain;
  };

  return { dbMock: chain, mockReturning };
});

vi.mock("../../../../lib/db", () => ({
  db: dbMock,
}));

vi.mock("../../../../lib/db/schema/webhooks", () => ({
  webhooks: {
    id: "id",
    organizationId: "organizationId",
    url: "url",
    secret: "secret",
    events: "events",
    isActive: "isActive",
    description: "description",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  webhookDeliveries: {
    id: "id",
    webhookId: "webhookId",
    event: "event",
    payload: "payload",
    status: "status",
    attempts: "attempts",
    maxAttempts: "maxAttempts",
    nextRetryAt: "nextRetryAt",
    createdAt: "createdAt",
  },
  WEBHOOK_EVENTS: [
    "booking.created",
    "booking.updated",
    "booking.cancelled",
    "customer.created",
    "customer.updated",
    "payment.received",
    "payment.refunded",
    "trip.completed",
  ],
}));

describe("webhook CRUD operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWebhook", () => {
    it("throws error when no valid events provided", async () => {
      const { createWebhook } = await import("../../../../lib/webhooks/index.server");

      await expect(
        createWebhook("org-1", "https://example.com/webhook", [])
      ).rejects.toThrow("At least one valid event type is required");
    });

    it("throws error for invalid URL", async () => {
      const { createWebhook } = await import("../../../../lib/webhooks/index.server");

      await expect(
        createWebhook("org-1", "not-a-url", ["booking.created"])
      ).rejects.toThrow("Invalid webhook URL");
    });

    it("accepts valid URL and events", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "wh-1",
          organizationId: "org-1",
          url: "https://example.com/webhook",
          secret: "whsec_test123",
          events: ["booking.created"],
          isActive: true,
          description: "Test webhook",
        },
      ]);

      const { createWebhook } = await import("../../../../lib/webhooks/index.server");

      const webhook = await createWebhook(
        "org-1",
        "https://example.com/webhook",
        ["booking.created"],
        "Test webhook"
      );

      expect(webhook).toBeDefined();
      expect(webhook.url).toBe("https://example.com/webhook");
    });

    it("filters out invalid event types", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "wh-1",
          organizationId: "org-1",
          url: "https://example.com/webhook",
          events: ["booking.created"],
          isActive: true,
        },
      ]);

      const { createWebhook } = await import("../../../../lib/webhooks/index.server");

      // Mix of valid and invalid events - should filter to only valid ones
      const webhook = await createWebhook(
        "org-1",
        "https://example.com/webhook",
        ["booking.created", "invalid.event" as any]
      );

      expect(webhook).toBeDefined();
    });

    it("rejects when all events are invalid", async () => {
      const { createWebhook } = await import("../../../../lib/webhooks/index.server");

      await expect(
        createWebhook("org-1", "https://example.com/webhook", ["invalid.event" as any])
      ).rejects.toThrow("At least one valid event type is required");
    });
  });

  describe("updateWebhook", () => {
    it("throws error for invalid URL in update", async () => {
      const { updateWebhook } = await import("../../../../lib/webhooks/index.server");

      await expect(
        updateWebhook("wh-1", "org-1", { url: "not-a-valid-url" })
      ).rejects.toThrow("Invalid webhook URL");
    });

    it("throws error when no valid events in update", async () => {
      const { updateWebhook } = await import("../../../../lib/webhooks/index.server");

      await expect(
        updateWebhook("wh-1", "org-1", { events: ["invalid.event" as any] })
      ).rejects.toThrow("At least one valid event type is required");
    });

    it("throws error when webhook not found", async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { updateWebhook } = await import("../../../../lib/webhooks/index.server");

      await expect(
        updateWebhook("nonexistent", "org-1", { isActive: false })
      ).rejects.toThrow("Webhook not found");
    });

    it("successfully updates webhook", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "wh-1",
          organizationId: "org-1",
          url: "https://example.com/webhook",
          isActive: false,
        },
      ]);

      const { updateWebhook } = await import("../../../../lib/webhooks/index.server");

      const webhook = await updateWebhook("wh-1", "org-1", { isActive: false });
      expect(webhook).toBeDefined();
      expect(webhook.isActive).toBe(false);
    });

    it("updates description field", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "wh-1",
          organizationId: "org-1",
          description: "New description",
        },
      ]);

      const { updateWebhook } = await import("../../../../lib/webhooks/index.server");

      const webhook = await updateWebhook("wh-1", "org-1", {
        description: "New description",
      });
      expect(webhook.description).toBe("New description");
    });

    it("validates and filters events on update", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "wh-1",
          events: ["booking.created", "customer.created"],
        },
      ]);

      const { updateWebhook } = await import("../../../../lib/webhooks/index.server");

      const webhook = await updateWebhook("wh-1", "org-1", {
        events: ["booking.created", "customer.created"],
      });
      expect(webhook.events).toContain("booking.created");
    });
  });

  describe("deleteWebhook", () => {
    it("throws error when webhook not found", async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { deleteWebhook } = await import("../../../../lib/webhooks/index.server");

      await expect(deleteWebhook("nonexistent", "org-1")).rejects.toThrow(
        "Webhook not found"
      );
    });

    it("successfully deletes webhook", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "wh-1" }]);

      const { deleteWebhook } = await import("../../../../lib/webhooks/index.server");

      await expect(deleteWebhook("wh-1", "org-1")).resolves.toBeUndefined();
    });

    it("requires both webhook ID and organization ID", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "wh-1" }]);

      const { deleteWebhook } = await import("../../../../lib/webhooks/index.server");

      // Should work when webhook belongs to org
      await deleteWebhook("wh-1", "org-1");
      expect(dbMock.delete).toHaveBeenCalled();
    });
  });

  describe("getWebhook", () => {
    it("returns null when webhook not found", async () => {
      dbMock.limit.mockResolvedValueOnce([]);

      const { getWebhook } = await import("../../../../lib/webhooks/index.server");

      const webhook = await getWebhook("nonexistent", "org-1");
      expect(webhook).toBeNull();
    });

    it("returns webhook when found", async () => {
      dbMock.limit.mockResolvedValueOnce([
        {
          id: "wh-1",
          organizationId: "org-1",
          url: "https://example.com/webhook",
        },
      ]);

      const { getWebhook } = await import("../../../../lib/webhooks/index.server");

      const webhook = await getWebhook("wh-1", "org-1");
      expect(webhook).toBeDefined();
      expect(webhook?.id).toBe("wh-1");
    });
  });

  describe("listWebhooks", () => {
    it("returns empty array when no webhooks", async () => {
      // Make chain thenable for orderBy terminal operation
      dbMock.orderBy.mockImplementationOnce(() => Promise.resolve([]));

      const { listWebhooks } = await import("../../../../lib/webhooks/index.server");

      const webhooks = await listWebhooks("org-1");
      expect(Array.isArray(webhooks)).toBe(true);
    });

    it("returns webhooks for organization", async () => {
      dbMock.orderBy.mockImplementationOnce(() =>
        Promise.resolve([
          { id: "wh-1", url: "https://example.com/webhook1" },
          { id: "wh-2", url: "https://example.com/webhook2" },
        ])
      );

      const { listWebhooks } = await import("../../../../lib/webhooks/index.server");

      const webhooks = await listWebhooks("org-1");
      expect(webhooks.length).toBe(2);
    });
  });

  describe("regenerateWebhookSecret", () => {
    it("throws error when webhook not found", async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { regenerateWebhookSecret } = await import("../../../../lib/webhooks/index.server");

      await expect(
        regenerateWebhookSecret("nonexistent", "org-1")
      ).rejects.toThrow("Webhook not found");
    });

    it("returns webhook with new secret", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "wh-1",
          secret: "whsec_newsecret123",
        },
      ]);

      const { regenerateWebhookSecret } = await import("../../../../lib/webhooks/index.server");

      const webhook = await regenerateWebhookSecret("wh-1", "org-1");
      expect(webhook.secret).toBeDefined();
      expect(webhook.secret.startsWith("whsec_")).toBe(true);
    });
  });

  describe("triggerWebhook", () => {
    it("returns empty array when no subscribed webhooks", async () => {
      // No active webhooks subscribed to this event
      dbMock.where.mockImplementationOnce(() => Promise.resolve([]));

      const { triggerWebhook } = await import("../../../../lib/webhooks/index.server");

      const deliveryIds = await triggerWebhook("org-1", "booking.created", {
        bookingId: "123",
      });

      expect(Array.isArray(deliveryIds)).toBe(true);
      expect(deliveryIds.length).toBe(0);
    });
  });

  describe("getWebhookDeliveries", () => {
    it("returns empty array when no deliveries", async () => {
      dbMock.limit.mockResolvedValueOnce([]);

      const { getWebhookDeliveries } = await import("../../../../lib/webhooks/index.server");

      const deliveries = await getWebhookDeliveries("wh-1");
      expect(Array.isArray(deliveries)).toBe(true);
    });

    it("accepts custom limit parameter", async () => {
      dbMock.limit.mockResolvedValueOnce([]);

      const { getWebhookDeliveries } = await import("../../../../lib/webhooks/index.server");

      await getWebhookDeliveries("wh-1", 50);
      expect(dbMock.limit).toHaveBeenCalled();
    });
  });

  describe("createTestDelivery", () => {
    it("throws error when webhook not found", async () => {
      dbMock.limit.mockResolvedValueOnce([]);

      const { createTestDelivery } = await import("../../../../lib/webhooks/index.server");

      await expect(createTestDelivery("nonexistent", "org-1")).rejects.toThrow(
        "Webhook not found"
      );
    });

    it("creates test delivery for valid webhook", async () => {
      // First call - getWebhook
      dbMock.limit.mockResolvedValueOnce([
        {
          id: "wh-1",
          organizationId: "org-1",
        },
      ]);

      // Second call - insert returning
      mockReturning.mockResolvedValueOnce([
        {
          id: "delivery-1",
          webhookId: "wh-1",
          event: "booking.created",
          status: "pending",
        },
      ]);

      const { createTestDelivery } = await import("../../../../lib/webhooks/index.server");

      const deliveryId = await createTestDelivery("wh-1", "org-1");
      expect(deliveryId).toBe("delivery-1");
    });
  });
});
