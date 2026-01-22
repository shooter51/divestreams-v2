/**
 * Site Account Logout Route Tests
 *
 * Tests the logout action and loader.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action, loader } from "../../../../../app/routes/site/account/logout";

// Mock customer auth
vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  logoutCustomer: vi.fn(),
}));

// Import mocked module
import { logoutCustomer } from "../../../../../lib/auth/customer-auth.server";

describe("Route: site/account/logout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("action", () => {
    it("should logout customer and redirect to login with valid session", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account/logout",
        method: "POST",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (logoutCustomer as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(logoutCustomer).toHaveBeenCalledWith("valid-token");
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/login");
    });

    it("should redirect to login without calling logoutCustomer when no session", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account/logout",
        method: "POST",
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(logoutCustomer).not.toHaveBeenCalled();
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/login");
    });
  });

  describe("loader", () => {
    it("should redirect to account page", async () => {
      // Act
      const result = await loader({ request: {} as Request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/account");
    });
  });
});
