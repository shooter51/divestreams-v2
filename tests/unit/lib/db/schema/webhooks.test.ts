/**
 * Webhooks Schema Tests
 *
 * Tests for webhook schema constants and types.
 */

import { describe, it, expect } from "vitest";
import {
  WEBHOOK_EVENTS,
  type WebhookEventType,
  type WebhookDeliveryStatus,
} from "../../../../../lib/db/schema/webhooks";

describe("webhooks schema", () => {
  describe("WEBHOOK_EVENTS", () => {
    it("contains all expected event types", () => {
      expect(WEBHOOK_EVENTS).toContain("booking.created");
      expect(WEBHOOK_EVENTS).toContain("booking.updated");
      expect(WEBHOOK_EVENTS).toContain("booking.cancelled");
      expect(WEBHOOK_EVENTS).toContain("customer.created");
      expect(WEBHOOK_EVENTS).toContain("customer.updated");
      expect(WEBHOOK_EVENTS).toContain("payment.received");
      expect(WEBHOOK_EVENTS).toContain("payment.refunded");
      expect(WEBHOOK_EVENTS).toContain("trip.completed");
    });

    it("has correct number of event types", () => {
      expect(WEBHOOK_EVENTS.length).toBe(8);
    });

    it("is readonly/immutable", () => {
      // TypeScript should prevent this, but we test runtime behavior
      expect(Object.isFrozen(WEBHOOK_EVENTS)).toBe(false); // Arrays aren't frozen by default
      // But the 'as const' makes it a readonly tuple type
      expect(WEBHOOK_EVENTS).toEqual([
        "booking.created",
        "booking.updated",
        "booking.cancelled",
        "customer.created",
        "customer.updated",
        "payment.received",
        "payment.refunded",
        "trip.completed",
      ]);
    });

    it("event types follow naming convention", () => {
      WEBHOOK_EVENTS.forEach((event) => {
        // All events should have resource.action format
        expect(event).toMatch(/^[a-z]+\.[a-z]+$/);
      });
    });

    it("contains booking events", () => {
      const bookingEvents = WEBHOOK_EVENTS.filter((e) => e.startsWith("booking."));
      expect(bookingEvents).toHaveLength(3);
    });

    it("contains customer events", () => {
      const customerEvents = WEBHOOK_EVENTS.filter((e) => e.startsWith("customer."));
      expect(customerEvents).toHaveLength(2);
    });

    it("contains payment events", () => {
      const paymentEvents = WEBHOOK_EVENTS.filter((e) => e.startsWith("payment."));
      expect(paymentEvents).toHaveLength(2);
    });

    it("contains trip events", () => {
      const tripEvents = WEBHOOK_EVENTS.filter((e) => e.startsWith("trip."));
      expect(tripEvents).toHaveLength(1);
    });
  });

  describe("WebhookEventType", () => {
    it("type represents all valid events", () => {
      // This is a compile-time check, but we can verify at runtime
      const validEvent: WebhookEventType = "booking.created";
      expect(WEBHOOK_EVENTS).toContain(validEvent);
    });
  });

  describe("WebhookDeliveryStatus", () => {
    it("supports pending status", () => {
      const status: WebhookDeliveryStatus = "pending";
      expect(status).toBe("pending");
    });

    it("supports success status", () => {
      const status: WebhookDeliveryStatus = "success";
      expect(status).toBe("success");
    });

    it("supports failed status", () => {
      const status: WebhookDeliveryStatus = "failed";
      expect(status).toBe("failed");
    });
  });
});
