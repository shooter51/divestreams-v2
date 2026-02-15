/**
 * Pact Consumer Contract Tests - Zapier API
 *
 * Tests the contract between Zapier (consumer) and DiveStreams API (provider)
 * for Zapier integration endpoints.
 */

import { describe, it, expect } from "vitest";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";
import path from "path";

const { like, eachLike, datetime } = MatchersV3;

const provider = new PactV3({
  consumer: "Zapier",
  provider: "DiveStreamsAPI",
  dir: path.resolve(process.cwd(), "pacts/contracts"),
});

describe("Zapier API Contract", () => {
  describe("GET /api/zapier/test", () => {
    it("validates API key and returns organization details", () => {
      return provider
        .given("valid API key exists for organization")
        .uponReceiving("a request to test API connection")
        .withRequest({
          method: "GET",
          path: "/api/zapier/test",
          headers: {
            "X-API-Key": "valid-key-123",
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            success: like(true),
            message: like("API key is valid"),
            organization: {
              id: like("org-123"),
              name: like("Test Dive Shop"),
              slug: like("test-dive-shop"),
            },
            timestamp: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2024-01-01T12:00:00.000Z"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/zapier/test`, {
            headers: { "X-API-Key": "valid-key-123" },
          });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.success).toBe(true);
          expect(data.organization).toBeDefined();
          expect(data.organization.id).toBeDefined();
        });
    });

    it("returns 401 when API key is invalid", () => {
      return provider
        .given("API key is invalid")
        .uponReceiving("a request with invalid API key")
        .withRequest({
          method: "GET",
          path: "/api/zapier/test",
          headers: {
            "X-API-Key": "invalid-key",
          },
        })
        .willRespondWith({
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            error: like("Invalid API key"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/zapier/test`, {
            headers: { "X-API-Key": "invalid-key" },
          });
          const data = await response.json();

          expect(response.status).toBe(401);
          expect(data.error).toBe("Invalid API key");
        });
    });
  });

  describe("GET /api/zapier/triggers", () => {
    it("returns list of available triggers", () => {
      return provider
        .given("valid API key exists")
        .uponReceiving("a request for available triggers")
        .withRequest({
          method: "GET",
          path: "/api/zapier/triggers",
          headers: {
            "X-API-Key": "valid-key-123",
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            triggers: eachLike({
              key: like("booking.created"),
              name: like("Booking Created"),
              description: like("Triggered when a new booking is created"),
              sample: {
                id: like(123),
                booking_number: like("BK001"),
                customer_id: like(1),
                trip_id: like(5),
                participants: like(2),
                total: like(300.0),
                status: like("confirmed"),
              },
            }),
            count: like(3),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/zapier/triggers`, {
            headers: { "X-API-Key": "valid-key-123" },
          });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.triggers).toBeInstanceOf(Array);
          expect(data.count).toBeGreaterThan(0);
          expect(data.triggers[0]).toHaveProperty("key");
          expect(data.triggers[0]).toHaveProperty("sample");
        });
    });
  });

  describe("POST /api/zapier/subscribe", () => {
    it("creates webhook subscription", () => {
      return provider
        .given("valid API key and event type")
        .uponReceiving("a request to subscribe to trigger")
        .withRequest({
          method: "POST",
          path: "/api/zapier/subscribe",
          headers: {
            "X-API-Key": "valid-key-123",
            "Content-Type": "application/json",
          },
          body: {
            event_type: like("booking.created"),
            target_url: like("https://hooks.zapier.com/hooks/catch/123456/abcdef"),
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            id: like("sub-xyz"),
            event_type: like("booking.created"),
            target_url: like("https://hooks.zapier.com/hooks/catch/123456/abcdef"),
            created_at: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2024-01-01T12:00:00.000Z"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/zapier/subscribe`, {
            method: "POST",
            headers: {
              "X-API-Key": "valid-key-123",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              event_type: "booking.created",
              target_url: "https://hooks.zapier.com/hooks/catch/123456/abcdef",
            }),
          });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.id).toBeDefined();
          expect(data.event_type).toBe("booking.created");
          expect(data.created_at).toBeDefined();
        });
    });
  });

  describe("POST /api/zapier/actions/create-booking", () => {
    it("creates a new booking", () => {
      return provider
        .given("valid API key and trip exists")
        .uponReceiving("a request to create booking")
        .withRequest({
          method: "POST",
          path: "/api/zapier/actions/create-booking",
          headers: {
            "X-API-Key": "valid-key-123",
            "Content-Type": "application/json",
          },
          body: {
            trip_id: like("trip-123"),
            customer_email: like("customer@example.com"),
            customer_first_name: like("John"),
            customer_last_name: like("Doe"),
            participants: like(2),
            notes: like("Special request: vegetarian meals"),
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            id: like("booking-abc123"),
            booking_number: like("BK-booking-"),
            trip_id: like("trip-123"),
            customer_id: like("cust-1"),
            status: like("pending"),
            participants: like(2),
            created_at: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2024-01-01T12:00:00.000Z"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/zapier/actions/create-booking`,
            {
              method: "POST",
              headers: {
                "X-API-Key": "valid-key-123",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                trip_id: "trip-123",
                customer_email: "customer@example.com",
                customer_first_name: "John",
                customer_last_name: "Doe",
                participants: 2,
                notes: "Special request: vegetarian meals",
              }),
            }
          );
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.id).toBeDefined();
          expect(data.booking_number).toBeDefined();
          expect(data.status).toBe("pending");
        });
    });
  });
});
