/**
 * Auth Logout Route Tests
 *
 * Tests the logout route that clears session and redirects.
 */

import { describe, it, expect } from "vitest";
import { loader, action } from "../../../../app/routes/auth/logout";

describe("Route: auth/logout.tsx", () => {
  describe("loader", () => {
    it("should redirect to login page", async () => {
      // Arrange
      const request = new Request("http://test.com/auth/logout");

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/login");
    });
  });

  describe("action", () => {
    it("should redirect to login page", async () => {
      // Arrange
      const request = new Request("http://test.com/auth/logout", {
        method: "POST",
      });

      // Act
      const response = await action({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/login");
    });
  });
});
