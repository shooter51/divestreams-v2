/**
 * API Auth Handler Route Tests
 *
 * Tests the Better Auth API route handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/api/auth.$";

// Mock auth module
vi.mock("../../../../lib/auth", () => ({
  auth: {
    handler: vi.fn(),
  },
}));

// Import mocked module
import { auth } from "../../../../lib/auth";

describe("Route: api/auth.$.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should delegate to auth.handler", async () => {
      // Arrange
      const request = new Request("http://test.com/api/auth/session");
      const expectedResponse = new Response("session data");
      (auth.handler as any).mockResolvedValue(expectedResponse);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(auth.handler).toHaveBeenCalledWith(request);
      expect(result).toBe(expectedResponse);
    });
  });

  describe("action", () => {
    it("should delegate to auth.handler", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "password123");
      const request = new Request("http://test.com/api/auth/sign-in", {
        method: "POST",
        body: formData,
      });
      const expectedResponse = new Response(JSON.stringify({ success: true }));
      (auth.handler as any).mockResolvedValue(expectedResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.handler).toHaveBeenCalledWith(request);
      expect(result).toBe(expectedResponse);
    });
  });
});
