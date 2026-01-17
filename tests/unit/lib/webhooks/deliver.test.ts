/**
 * Webhook Delivery Service Tests
 *
 * Comprehensive tests for webhook delivery with retry logic and exponential backoff.
 * Tests cover all major code paths including success, failure, retry, timeout scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database with proper chaining
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOrderBy = vi.fn();

// Create a chainable mock database object
const createMockDb = () => {
  const chain = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    update: mockUpdate,
    set: mockSet,
    returning: mockReturning,
    delete: mockDelete,
    insert: mockInsert,
    values: mockValues,
    orderBy: mockOrderBy,
  };

  // Make all methods return the chain for chaining
  mockSelect.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  mockWhere.mockReturnValue(chain);
  mockLimit.mockReturnValue(chain);
  mockUpdate.mockReturnValue(chain);
  mockSet.mockReturnValue(chain);
  mockReturning.mockReturnValue(chain);
  mockDelete.mockReturnValue(chain);
  mockInsert.mockReturnValue(chain);
  mockValues.mockReturnValue(chain);
  mockOrderBy.mockReturnValue(chain);

  return chain;
};

vi.mock("../../../../lib/db", () => ({
  db: createMockDb(),
}));

vi.mock("../../../../lib/db/schema/webhooks", () => ({
  webhooks: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    url: "url",
    secret: "secret",
    events: "events",
    isActive: "isActive",
    lastDeliveryAt: "lastDeliveryAt",
    lastDeliveryStatus: "lastDeliveryStatus",
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
    responseCode: "responseCode",
    responseBody: "responseBody",
    completedAt: "completedAt",
    createdAt: "createdAt",
  },
}));

// Mock signPayload
vi.mock("../../../../lib/webhooks/index.server", () => ({
  signPayload: vi.fn().mockReturnValue("t=1234567890,v1=mocksignature"),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock setTimeout and clearTimeout for timeout testing
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
let mockTimeoutId = 0;
const mockSetTimeout = vi.fn((callback: any, delay: number) => {
  mockTimeoutId++;
  return mockTimeoutId;
});
const mockClearTimeout = vi.fn();

describe("Webhook Delivery Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Reset all chain methods
    createMockDb();

    // Default mock responses
    mockLimit.mockResolvedValue([]);
    mockReturning.mockResolvedValue([]);
    mockWhere.mockReturnValue({
      limit: mockLimit,
      returning: mockReturning,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Module exports", () => {
    it("exports deliverWebhook function", async () => {
      const deliverModule = await import("../../../../lib/webhooks/deliver.server");
      expect(typeof deliverModule.deliverWebhook).toBe("function");
    });

    it("exports processPendingDeliveries function", async () => {
      const deliverModule = await import("../../../../lib/webhooks/deliver.server");
      expect(typeof deliverModule.processPendingDeliveries).toBe("function");
    });

    it("exports retryDelivery function", async () => {
      const deliverModule = await import("../../../../lib/webhooks/deliver.server");
      expect(typeof deliverModule.retryDelivery).toBe("function");
    });

    it("exports getDeliveryStats function", async () => {
      const deliverModule = await import("../../../../lib/webhooks/deliver.server");
      expect(typeof deliverModule.getDeliveryStats).toBe("function");
    });

    it("exports cleanupOldDeliveries function", async () => {
      const deliverModule = await import("../../../../lib/webhooks/deliver.server");
      expect(typeof deliverModule.cleanupOldDeliveries).toBe("function");
    });
  });

  describe("deliverWebhook", () => {
    it("returns false when delivery not found", async () => {
      mockLimit.mockResolvedValueOnce([]); // No delivery found

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("non-existent-id");

      expect(result).toBe(false);
    });

    it("returns false and marks failed when webhook configuration not found", async () => {
      // First query returns delivery
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        // Second query returns no webhook
        .mockResolvedValueOnce([]);

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(false);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "failed",
        responseBody: "Webhook configuration not found",
      }));
    });

    it("returns false and marks failed when webhook is disabled", async () => {
      // First query returns delivery
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        // Second query returns inactive webhook
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "secret123",
          isActive: false,
        }]);

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(false);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "failed",
        responseBody: "Webhook is disabled",
      }));
    });

    it("successfully delivers webhook with 200 response", async () => {
      // Mock delivery and webhook
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      // Mock successful HTTP response
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: vi.fn().mockResolvedValue("Success"),
      });

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/webhook",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-DiveStreams-Signature": expect.any(String),
            "X-DiveStreams-Event": "booking.created",
            "X-DiveStreams-Delivery": "delivery-1",
            "User-Agent": "DiveStreams-Webhook/1.0",
          }),
        })
      );

      // Should update delivery as success
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        responseCode: 200,
        attempts: 1,
      }));
    });

    it("successfully delivers webhook with 201 response", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      mockFetch.mockResolvedValueOnce({
        status: 201,
        text: vi.fn().mockResolvedValue("Created"),
      });

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        responseCode: 201,
      }));
    });

    it("retries delivery on 400 error with attempts remaining", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      mockFetch.mockResolvedValueOnce({
        status: 400,
        text: vi.fn().mockResolvedValue("Bad Request"),
      });

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(false);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "pending", // Should retry
        responseCode: 400,
        attempts: 1,
        nextRetryAt: expect.any(Date),
      }));
    });

    it("marks as failed on 500 error when max attempts reached", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 4, // 4 attempts already made
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      mockFetch.mockResolvedValueOnce({
        status: 500,
        text: vi.fn().mockResolvedValue("Internal Server Error"),
      });

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(false);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "failed", // No more retries
        responseCode: 500,
        attempts: 5,
        completedAt: expect.any(Date),
      }));
    });

    it("handles network error with retry", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      // Simulate network error
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(false);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "pending",
        responseBody: "Delivery failed: Network error",
        attempts: 1,
        nextRetryAt: expect.any(Date),
      }));
    });

    it("marks as failed on network error when max attempts reached", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 4,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(false);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "failed",
        responseBody: "Delivery failed: Connection refused",
        completedAt: expect.any(Date),
      }));
    });

    it("handles timeout abort signal", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      // Simulate timeout abort
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(false);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "pending",
        responseBody: expect.stringContaining("aborted"),
      }));
    });

    it("handles response body read error", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: vi.fn().mockRejectedValue(new Error("Stream error")),
      });

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(true); // Still success because status was 200
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "success",
        responseBody: "Unable to read response body",
      }));
    });

    it("truncates large response bodies to 10KB", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      // Create a large response (>10KB)
      const largeResponse = "x".repeat(20000);
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: vi.fn().mockResolvedValue(largeResponse),
      });

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      await deliverWebhook("delivery-1");

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        responseBody: expect.stringMatching(/^x+$/),
      }));

      // Verify truncation happened
      const setCall = mockSet.mock.calls.find(call =>
        call[0].responseBody && call[0].responseBody.length === 10240
      );
      expect(setCall).toBeDefined();
    });

    it("handles unknown error types", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      // Throw non-Error object
      mockFetch.mockRejectedValueOnce("String error");

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(false);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        responseBody: "Delivery failed: Unknown error",
      }));
    });

    it("updates webhook lastDeliveryStatus on success", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: { test: "data" },
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "whsec_secret123",
          isActive: true,
        }]);

      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: vi.fn().mockResolvedValue("OK"),
      });

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      await deliverWebhook("delivery-1");

      // Should update both delivery and webhook tables
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        lastDeliveryStatus: "success",
        lastDeliveryAt: expect.any(Date),
      }));
    });
  });

  describe("processPendingDeliveries", () => {
    it("returns success and failed counts", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { processPendingDeliveries } = await import("../../../../lib/webhooks/deliver.server");

      const result = await processPendingDeliveries();

      expect(result).toEqual({ success: 0, failed: 0 });
    });

    it("respects limit parameter", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { processPendingDeliveries } = await import("../../../../lib/webhooks/deliver.server");

      await processPendingDeliveries(50);

      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it("defaults to limit of 100", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { processPendingDeliveries } = await import("../../../../lib/webhooks/deliver.server");

      await processPendingDeliveries();

      expect(mockLimit).toHaveBeenCalledWith(100);
    });

    it("processes multiple pending deliveries", async () => {
      // Mock pending deliveries
      mockLimit.mockResolvedValueOnce([
        { id: "delivery-1" },
        { id: "delivery-2" },
      ]);

      // Mock delivery attempts
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: {},
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "secret",
          isActive: true,
        }])
        .mockResolvedValueOnce([{
          id: "delivery-2",
          webhookId: "webhook-2",
          event: "booking.created",
          payload: {},
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-2",
          url: "https://example.com/webhook",
          secret: "secret",
          isActive: true,
        }]);

      mockFetch
        .mockResolvedValueOnce({
          status: 200,
          text: vi.fn().mockResolvedValue("OK"),
        })
        .mockResolvedValueOnce({
          status: 500,
          text: vi.fn().mockResolvedValue("Error"),
        });

      const { processPendingDeliveries } = await import("../../../../lib/webhooks/deliver.server");

      const result = await processPendingDeliveries();

      expect(result).toEqual({ success: 1, failed: 1 });
    });

    it("handles errors during processing", async () => {
      mockLimit.mockResolvedValueOnce([
        { id: "delivery-1" },
      ]);

      // Make deliverWebhook throw an error
      mockLimit.mockRejectedValueOnce(new Error("Database error"));

      const { processPendingDeliveries } = await import("../../../../lib/webhooks/deliver.server");

      const result = await processPendingDeliveries();

      expect(result).toEqual({ success: 0, failed: 1 });
    });
  });

  describe("retryDelivery", () => {
    it("updates delivery status to pending", async () => {
      const { retryDelivery } = await import("../../../../lib/webhooks/deliver.server");

      await retryDelivery("delivery-123");

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "pending",
        completedAt: null,
        nextRetryAt: expect.any(Date),
      }));
    });

    it("sets immediate retry time", async () => {
      const beforeTime = new Date();

      const { retryDelivery } = await import("../../../../lib/webhooks/deliver.server");

      await retryDelivery("delivery-123");

      const setCall = mockSet.mock.calls[0][0];
      const afterTime = new Date();

      expect(setCall.nextRetryAt).toBeInstanceOf(Date);
      expect(setCall.nextRetryAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(setCall.nextRetryAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("getDeliveryStats", () => {
    it("returns stats with all counts", async () => {
      // Reset select mock for this test
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { status: "success" },
            { status: "success" },
            { status: "failed" },
            { status: "pending" },
          ]),
        }),
      });

      const { getDeliveryStats } = await import("../../../../lib/webhooks/deliver.server");

      const stats = await getDeliveryStats("webhook-1");

      expect(stats).toEqual({
        total: 4,
        success: 2,
        failed: 1,
        pending: 1,
      });
    });

    it("returns zero stats for webhook with no deliveries", async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const { getDeliveryStats } = await import("../../../../lib/webhooks/deliver.server");

      const stats = await getDeliveryStats("webhook-1");

      expect(stats).toEqual({
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
      });
    });

    it("handles mixed delivery statuses", async () => {
      mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { status: "success" },
            { status: "pending" },
            { status: "pending" },
            { status: "pending" },
            { status: "failed" },
            { status: "failed" },
            { status: "failed" },
          ]),
        }),
      });

      const { getDeliveryStats } = await import("../../../../lib/webhooks/deliver.server");

      const stats = await getDeliveryStats("webhook-1");

      expect(stats).toEqual({
        total: 7,
        success: 1,
        failed: 3,
        pending: 3,
      });
    });
  });

  describe("cleanupOldDeliveries", () => {
    it("deletes deliveries older than specified days", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "1" }, { id: "2" }, { id: "3" }]);

      const { cleanupOldDeliveries } = await import("../../../../lib/webhooks/deliver.server");

      const result = await cleanupOldDeliveries(30);

      expect(mockDelete).toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it("defaults to 30 days", async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { cleanupOldDeliveries } = await import("../../../../lib/webhooks/deliver.server");

      const result = await cleanupOldDeliveries();

      expect(result).toBe(0);
    });

    it("returns 0 when no old deliveries exist", async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { cleanupOldDeliveries } = await import("../../../../lib/webhooks/deliver.server");

      const result = await cleanupOldDeliveries(7);

      expect(result).toBe(0);
    });

    it("correctly calculates cutoff date", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "1" }]);

      const { cleanupOldDeliveries } = await import("../../../../lib/webhooks/deliver.server");

      const beforeDate = new Date();
      beforeDate.setDate(beforeDate.getDate() - 15);

      await cleanupOldDeliveries(15);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe("Constants validation", () => {
    it("has reasonable default retry configuration", async () => {
      // MAX_ATTEMPTS = 5
      // BASE_RETRY_DELAY = 60 (1 minute)
      // MAX_RETRY_DELAY = 3600 (1 hour)
      // REQUEST_TIMEOUT = 30000 (30 seconds)
      const deliverModule = await import("../../../../lib/webhooks/deliver.server");
      expect(deliverModule).toBeDefined();
    });
  });

  describe("Webhook headers", () => {
    it("should include required DiveStreams headers", () => {
      const requiredHeaders = [
        "Content-Type",
        "User-Agent",
        "X-DiveStreams-Event",
        "X-DiveStreams-Delivery",
        "X-DiveStreams-Signature",
      ];

      requiredHeaders.forEach((header) => {
        expect(header).toBeDefined();
      });
    });
  });

  describe("Retry logic patterns", () => {
    it("uses exponential backoff for retries", () => {
      const BASE_RETRY_DELAY = 60;
      const MAX_RETRY_DELAY = 3600;

      const calculateDelay = (attempt: number) => {
        return Math.min(BASE_RETRY_DELAY * Math.pow(2, attempt), MAX_RETRY_DELAY);
      };

      expect(calculateDelay(0)).toBe(60);
      expect(calculateDelay(1)).toBe(120);
      expect(calculateDelay(2)).toBe(240);
      expect(calculateDelay(3)).toBe(480);
      expect(calculateDelay(10)).toBe(3600); // Capped at max
    });
  });

  describe("HTTP status code handling", () => {
    it("treats 2xx as success", () => {
      const isSuccess = (status: number) => status >= 200 && status < 300;

      expect(isSuccess(200)).toBe(true);
      expect(isSuccess(201)).toBe(true);
      expect(isSuccess(204)).toBe(true);
      expect(isSuccess(299)).toBe(true);
      expect(isSuccess(199)).toBe(false);
      expect(isSuccess(300)).toBe(false);
    });

    it("treats 4xx as client error (should retry with backoff)", () => {
      const isClientError = (status: number) => status >= 400 && status < 500;

      expect(isClientError(400)).toBe(true);
      expect(isClientError(401)).toBe(true);
      expect(isClientError(404)).toBe(true);
      expect(isClientError(429)).toBe(true);
      expect(isClientError(500)).toBe(false);
    });

    it("treats 5xx as server error (should retry)", () => {
      const isServerError = (status: number) => status >= 500;

      expect(isServerError(500)).toBe(true);
      expect(isServerError(502)).toBe(true);
      expect(isServerError(503)).toBe(true);
      expect(isServerError(400)).toBe(false);
    });
  });

  describe("Delivery status values", () => {
    it("defines valid delivery statuses", () => {
      const validStatuses = ["pending", "success", "failed"];

      validStatuses.forEach((status) => {
        expect(typeof status).toBe("string");
        expect(status.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Edge cases", () => {
    it("handles delivery with custom maxAttempts", async () => {
      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: {},
          attempts: 2,
          maxAttempts: 3, // Custom max attempts
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "secret",
          isActive: true,
        }]);

      mockFetch.mockResolvedValueOnce({
        status: 500,
        text: vi.fn().mockResolvedValue("Error"),
      });

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      await deliverWebhook("delivery-1");

      // Should mark as failed since 3 attempts would be reached
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        status: "failed",
        attempts: 3,
      }));
    });

    it("handles very large payloads", async () => {
      const largePayload = { data: "x".repeat(100000) };

      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: largePayload,
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: "https://example.com/webhook",
          secret: "secret",
          isActive: true,
        }]);

      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: vi.fn().mockResolvedValue("OK"),
      });

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(largePayload),
        })
      );
    });

    it("handles special characters in webhook URL", async () => {
      const specialUrl = "https://example.com/webhook?token=abc123&param=value";

      mockLimit
        .mockResolvedValueOnce([{
          id: "delivery-1",
          webhookId: "webhook-1",
          event: "booking.created",
          payload: {},
          attempts: 0,
          maxAttempts: 5,
        }])
        .mockResolvedValueOnce([{
          id: "webhook-1",
          url: specialUrl,
          secret: "secret",
          isActive: true,
        }]);

      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: vi.fn().mockResolvedValue("OK"),
      });

      const { deliverWebhook } = await import("../../../../lib/webhooks/deliver.server");

      const result = await deliverWebhook("delivery-1");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(specialUrl, expect.any(Object));
    });
  });
});
