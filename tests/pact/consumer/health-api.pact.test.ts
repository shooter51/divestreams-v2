/**
 * Pact Consumer Contract Tests - Health API
 *
 * Tests the contract between Frontend (consumer) and DiveStreams API (provider)
 * for the health check endpoint.
 */

import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";
import path from "path";

const { like, datetime } = MatchersV3;

// Create a Pact instance
const provider = new PactV3({
  consumer: "DiveStreamsFrontend",
  provider: "DiveStreamsAPI",
  dir: path.resolve(process.cwd(), "pacts/contracts"),
});

describe("Health API Contract", () => {
  describe("GET /api/health", () => {
    it("returns health status when all services are healthy", () => {
      return provider
        .given("all services are healthy")
        .uponReceiving("a request for health status")
        .withRequest({
          method: "GET",
          path: "/api/health",
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            status: like("ok"),
            timestamp: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2024-01-01T12:00:00.000Z"),
            version: like("2.0.0"),
            checks: {
              database: like("ok"),
              redis: like("ok"),
            },
          },
        })
        .executeTest(async (mockServer) => {
          // Act - Make request to mock server
          const response = await fetch(`${mockServer.url}/api/health`);
          const data = await response.json();

          // Assert
          expect(response.status).toBe(200);
          expect(data.status).toBe("ok");
          expect(data.timestamp).toBeDefined();
          expect(data.version).toMatch(/^\d+\.\d+\.\d+$/);
          expect(data.checks.database).toBe("ok");
          expect(data.checks.redis).toBe("ok");
        });
    });

    it("returns degraded status when database is down", () => {
      return provider
        .given("database is unavailable")
        .uponReceiving("a request for health status with DB down")
        .withRequest({
          method: "GET",
          path: "/api/health",
        })
        .willRespondWith({
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            status: like("degraded"),
            timestamp: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2024-01-01T12:00:00.000Z"),
            version: like("2.0.0"),
            checks: {
              database: like("error"),
              redis: like("ok"),
            },
          },
        })
        .executeTest(async (mockServer) => {
          // Act
          const response = await fetch(`${mockServer.url}/api/health`);
          const data = await response.json();

          // Assert
          expect(response.status).toBe(503);
          expect(data.status).toBe("degraded");
          expect(data.checks.database).toBe("error");
          expect(data.checks.redis).toBe("ok");
        });
    });

    it("returns degraded status when Redis is down", () => {
      return provider
        .given("redis is unavailable")
        .uponReceiving("a request for health status with Redis down")
        .withRequest({
          method: "GET",
          path: "/api/health",
        })
        .willRespondWith({
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            status: like("degraded"),
            timestamp: datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", "2024-01-01T12:00:00.000Z"),
            version: like("2.0.0"),
            checks: {
              database: like("ok"),
              redis: like("error"),
            },
          },
        })
        .executeTest(async (mockServer) => {
          // Act
          const response = await fetch(`${mockServer.url}/api/health`);
          const data = await response.json();

          // Assert
          expect(response.status).toBe(503);
          expect(data.status).toBe("degraded");
          expect(data.checks.database).toBe("ok");
          expect(data.checks.redis).toBe("error");
        });
    });
  });
});
