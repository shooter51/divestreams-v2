/**
 * Health API Route Tests
 */

import { describe, it, expect, vi } from "vitest";
import { loader } from "../../../../app/routes/api/health";

describe("Health API", () => {
  describe("loader", () => {
    it("returns ok status", async () => {
      const request = new Request("http://localhost:3000/api/health");
      const response = await loader({ request, params: {}, context: {} });

      expect(response).toBeInstanceOf(Response);
      const data = await response.json();

      expect(data.status).toBe("ok");
    });

    it("returns timestamp", async () => {
      const request = new Request("http://localhost:3000/api/health");
      const before = new Date().toISOString();
      const response = await loader({ request, params: {}, context: {} });
      const after = new Date().toISOString();

      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(data.timestamp >= before).toBe(true);
      expect(data.timestamp <= after).toBe(true);
    });

    it("returns version", async () => {
      const request = new Request("http://localhost:3000/api/health");
      const response = await loader({ request, params: {}, context: {} });

      const data = await response.json();

      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe("string");
    });

    it("returns JSON content type", async () => {
      const request = new Request("http://localhost:3000/api/health");
      const response = await loader({ request, params: {}, context: {} });

      expect(response.headers.get("content-type")).toContain("application/json");
    });
  });
});
