/**
 * Webhooks Module Tests
 *
 * Tests for pure functions in the webhooks module.
 * Database operations are tested separately in integration tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module - needs to be done before importing the module
vi.mock("../../../../lib/db", async () => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock("../../../../lib/db/schema/webhooks", () => ({
  webhooks: { id: "id", organizationId: "organizationId" },
  webhookDeliveries: { id: "id", webhookId: "webhookId" },
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

// Import after mocks
import {
  generateWebhookSecret,
  signPayload,
  verifySignature,
  WEBHOOK_EVENT_DESCRIPTIONS,
  WEBHOOK_EVENTS,
} from "../../../../lib/webhooks/index.server";

describe("Webhooks Module", () => {
  // ============================================================================
  // generateWebhookSecret Tests
  // ============================================================================

  describe("generateWebhookSecret", () => {
    it("should generate a secret with whsec_ prefix", () => {
      const secret = generateWebhookSecret();
      expect(secret).toMatch(/^whsec_[a-f0-9]{64}$/);
    });

    it("should generate unique secrets each time", () => {
      const secret1 = generateWebhookSecret();
      const secret2 = generateWebhookSecret();
      expect(secret1).not.toBe(secret2);
    });

    it("should generate secrets with consistent length", () => {
      const secret = generateWebhookSecret();
      // whsec_ = 6 chars, 32 bytes hex = 64 chars = 70 total
      expect(secret.length).toBe(70);
    });
  });

  // ============================================================================
  // signPayload Tests
  // ============================================================================

  describe("signPayload", () => {
    const testPayload = { type: "booking.created", data: { id: "123" } };
    const testSecret = "whsec_abc123def456";
    const fixedTimestamp = 1704067200; // 2024-01-01 00:00:00 UTC

    it("should return signature in t=timestamp,v1=signature format", () => {
      const signature = signPayload(testPayload, testSecret, fixedTimestamp);
      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    });

    it("should include the provided timestamp", () => {
      const signature = signPayload(testPayload, testSecret, fixedTimestamp);
      expect(signature).toContain(`t=${fixedTimestamp}`);
    });

    it("should produce consistent signatures for same inputs", () => {
      const sig1 = signPayload(testPayload, testSecret, fixedTimestamp);
      const sig2 = signPayload(testPayload, testSecret, fixedTimestamp);
      expect(sig1).toBe(sig2);
    });

    it("should produce different signatures for different payloads", () => {
      const payload1 = { type: "booking.created", data: { id: "123" } };
      const payload2 = { type: "booking.updated", data: { id: "123" } };

      const sig1 = signPayload(payload1, testSecret, fixedTimestamp);
      const sig2 = signPayload(payload2, testSecret, fixedTimestamp);
      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different secrets", () => {
      const secret1 = "whsec_secret1";
      const secret2 = "whsec_secret2";

      const sig1 = signPayload(testPayload, secret1, fixedTimestamp);
      const sig2 = signPayload(testPayload, secret2, fixedTimestamp);
      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different timestamps", () => {
      const sig1 = signPayload(testPayload, testSecret, 1000);
      const sig2 = signPayload(testPayload, testSecret, 2000);
      expect(sig1).not.toBe(sig2);
    });

    it("should handle secret with whsec_ prefix", () => {
      const sig1 = signPayload(testPayload, "whsec_abc123", fixedTimestamp);
      // Should not throw and should return valid signature
      expect(sig1).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    });

    it("should handle secret without whsec_ prefix", () => {
      const sig1 = signPayload(testPayload, "abc123", fixedTimestamp);
      // Should not throw and should return valid signature
      expect(sig1).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    });

    it("should use current timestamp if not provided", () => {
      const before = Math.floor(Date.now() / 1000);
      const signature = signPayload(testPayload, testSecret);
      const after = Math.floor(Date.now() / 1000);

      const timestampMatch = signature.match(/^t=(\d+)/);
      expect(timestampMatch).not.toBeNull();
      const timestamp = parseInt(timestampMatch![1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  // ============================================================================
  // verifySignature Tests
  // ============================================================================

  describe("verifySignature", () => {
    const testPayload = { type: "booking.created", data: { id: "123" } };
    const testSecret = "whsec_abc123def456";

    it("should verify a valid signature", () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = signPayload(testPayload, testSecret, now);
      const isValid = verifySignature(testPayload, signature, testSecret);
      expect(isValid).toBe(true);
    });

    it("should reject signature with wrong payload", () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = signPayload(testPayload, testSecret, now);
      const wrongPayload = { type: "booking.updated", data: { id: "123" } };
      const isValid = verifySignature(wrongPayload, signature, testSecret);
      expect(isValid).toBe(false);
    });

    it("should reject signature with wrong secret", () => {
      const now = Math.floor(Date.now() / 1000);
      const signature = signPayload(testPayload, testSecret, now);
      const wrongSecret = "whsec_wrongsecret";
      const isValid = verifySignature(testPayload, signature, wrongSecret);
      expect(isValid).toBe(false);
    });

    it("should reject expired signature (older than tolerance)", () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
      const signature = signPayload(testPayload, testSecret, oldTimestamp);
      const isValid = verifySignature(testPayload, signature, testSecret, 300); // 300 second tolerance
      expect(isValid).toBe(false);
    });

    it("should accept signature within tolerance", () => {
      const recentTimestamp = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago
      const signature = signPayload(testPayload, testSecret, recentTimestamp);
      const isValid = verifySignature(testPayload, signature, testSecret, 300);
      expect(isValid).toBe(true);
    });

    it("should reject malformed signature without t=", () => {
      const isValid = verifySignature(testPayload, "v1=abc123", testSecret);
      expect(isValid).toBe(false);
    });

    it("should reject malformed signature without v1=", () => {
      const isValid = verifySignature(testPayload, "t=123456", testSecret);
      expect(isValid).toBe(false);
    });

    it("should reject empty signature", () => {
      const isValid = verifySignature(testPayload, "", testSecret);
      expect(isValid).toBe(false);
    });

    it("should handle future timestamp within tolerance", () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 100; // 100 seconds in future
      const signature = signPayload(testPayload, testSecret, futureTimestamp);
      const isValid = verifySignature(testPayload, signature, testSecret, 300);
      expect(isValid).toBe(true);
    });

    it("should reject future timestamp outside tolerance", () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 400; // 400 seconds in future
      const signature = signPayload(testPayload, testSecret, futureTimestamp);
      const isValid = verifySignature(testPayload, signature, testSecret, 300);
      expect(isValid).toBe(false);
    });

    it("should use default tolerance of 300 seconds", () => {
      const edgeTimestamp = Math.floor(Date.now() / 1000) - 290; // 290 seconds ago
      const signature = signPayload(testPayload, testSecret, edgeTimestamp);
      const isValid = verifySignature(testPayload, signature, testSecret);
      expect(isValid).toBe(true);
    });
  });

  // ============================================================================
  // Webhook Events Tests
  // ============================================================================

  describe("WEBHOOK_EVENTS", () => {
    it("should export booking events", () => {
      expect(WEBHOOK_EVENTS).toContain("booking.created");
      expect(WEBHOOK_EVENTS).toContain("booking.updated");
      expect(WEBHOOK_EVENTS).toContain("booking.cancelled");
    });

    it("should export customer events", () => {
      expect(WEBHOOK_EVENTS).toContain("customer.created");
      expect(WEBHOOK_EVENTS).toContain("customer.updated");
    });

    it("should export payment events", () => {
      expect(WEBHOOK_EVENTS).toContain("payment.received");
      expect(WEBHOOK_EVENTS).toContain("payment.refunded");
    });

    it("should export trip events", () => {
      expect(WEBHOOK_EVENTS).toContain("trip.completed");
    });
  });

  describe("WEBHOOK_EVENT_DESCRIPTIONS", () => {
    it("should have descriptions for all events", () => {
      expect(WEBHOOK_EVENT_DESCRIPTIONS["booking.created"]).toBe("When a new booking is created");
      expect(WEBHOOK_EVENT_DESCRIPTIONS["booking.updated"]).toBe("When a booking is modified");
      expect(WEBHOOK_EVENT_DESCRIPTIONS["booking.cancelled"]).toBe("When a booking is cancelled");
      expect(WEBHOOK_EVENT_DESCRIPTIONS["customer.created"]).toBe("When a new customer is added");
      expect(WEBHOOK_EVENT_DESCRIPTIONS["customer.updated"]).toBe("When customer details are updated");
      expect(WEBHOOK_EVENT_DESCRIPTIONS["payment.received"]).toBe("When a payment is received");
      expect(WEBHOOK_EVENT_DESCRIPTIONS["payment.refunded"]).toBe("When a payment is refunded");
      expect(WEBHOOK_EVENT_DESCRIPTIONS["trip.completed"]).toBe("When a trip is marked as completed");
    });
  });

  // ============================================================================
  // Signature workflow integration test
  // ============================================================================

  describe("Webhook signature workflow", () => {
    it("should complete full sign-verify cycle", () => {
      const secret = generateWebhookSecret();
      const payload = {
        id: crypto.randomUUID(),
        type: "booking.created",
        created: Math.floor(Date.now() / 1000),
        data: { bookingId: "BK123", customerId: "C456" },
      };

      // Sign the payload
      const signature = signPayload(payload, secret);

      // Verify the signature
      const isValid = verifySignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it("should detect tampered payload", () => {
      const secret = generateWebhookSecret();
      const originalPayload = {
        id: "event-1",
        type: "payment.received",
        data: { amount: 100 },
      };

      const signature = signPayload(originalPayload, secret);

      // Tamper with the payload
      const tamperedPayload = {
        id: "event-1",
        type: "payment.received",
        data: { amount: 1000 }, // Changed amount
      };

      const isValid = verifySignature(tamperedPayload, signature, secret);
      expect(isValid).toBe(false);
    });
  });
});
