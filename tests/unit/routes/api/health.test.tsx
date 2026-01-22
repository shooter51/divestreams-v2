/**
 * API Health Check Route Tests
 *
 * Tests the health check API endpoint.
 */

import { describe, it, expect } from "vitest";
import { loader } from "../../../../app/routes/api/health";

describe("Route: api/health.tsx", () => {
  describe("loader", () => {
    it("should return health check status", async () => {
      // Arrange
      const request = new Request("http://test.com/api/health");

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(data.status).toBe("ok");
      expect(data.version).toBe("2.0.0");
      expect(data.timestamp).toBeDefined();
    });

    it("should return valid ISO timestamp", async () => {
      // Arrange
      const request = new Request("http://test.com/api/health");

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert - timestamp should be valid ISO string
      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it("should return fresh timestamp on each call", async () => {
      // Arrange
      const request = new Request("http://test.com/api/health");

      // Act
      const response1 = await loader({ request, params: {}, context: {} });
      const data1 = await response1.json();

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 10));

      const response2 = await loader({ request, params: {}, context: {} });
      const data2 = await response2.json();

      // Assert - timestamps should be different
      expect(data1.timestamp).not.toBe(data2.timestamp);
    });
  });
});
