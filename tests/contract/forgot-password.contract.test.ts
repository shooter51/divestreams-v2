import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";
import routes from "../../app/routes";

/**
 * Contract Tests for Forgot Password Feature (KAN-664)
 *
 * Validates that the forgot-password and reset-password routes are properly
 * registered in the route configuration, ensuring they return 200 (not 404).
 */

// Helper to flatten nested route config and extract all routes
function flattenRoutes(
  routeConfig: any[],
  parentPath = ""
): Array<{ path: string; file: string }> {
  const result: Array<{ path: string; file: string }> = [];

  for (const route of routeConfig) {
    if (route.path !== undefined && route.file) {
      const fullPath = parentPath ? `${parentPath}/${route.path}` : route.path;
      result.push({ path: fullPath, file: route.file });
    }

    if (route.index && route.file) {
      result.push({ path: parentPath || "/", file: route.file });
    }

    if (route.children) {
      result.push(...flattenRoutes(route.children, route.path || parentPath));
    }
  }

  return result;
}

describe("KAN-664: Forgot Password Route Contracts", () => {
  const allRoutes = flattenRoutes(routes);
  const projectRoot = resolve(__dirname, "../..");

  describe("Tenant forgot-password route registration", () => {
    it("should have tenant/forgot-password route configured", () => {
      const forgotPasswordRoute = allRoutes.find(
        (r) => r.path === "tenant/forgot-password"
      );
      expect(forgotPasswordRoute).toBeDefined();
      expect(forgotPasswordRoute?.file).toBe("routes/tenant/forgot-password.tsx");
    });

    it("should have tenant/reset-password route configured", () => {
      const resetPasswordRoute = allRoutes.find(
        (r) => r.path === "tenant/reset-password"
      );
      expect(resetPasswordRoute).toBeDefined();
      expect(resetPasswordRoute?.file).toBe("routes/tenant/reset-password.tsx");
    });

    it("tenant forgot-password file should exist on disk", () => {
      const route = allRoutes.find((r) => r.path === "tenant/forgot-password");
      expect(route).toBeDefined();
      const filePath = resolve(projectRoot, "app", route!.file);
      expect(existsSync(filePath)).toBe(true);
    });

    it("tenant reset-password file should exist on disk", () => {
      const route = allRoutes.find((r) => r.path === "tenant/reset-password");
      expect(route).toBeDefined();
      const filePath = resolve(projectRoot, "app", route!.file);
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe("Auth forgot-password route registration", () => {
    it("should have auth/forgot-password route configured", () => {
      const forgotPasswordRoute = allRoutes.find(
        (r) => r.path === "auth/forgot-password"
      );
      expect(forgotPasswordRoute).toBeDefined();
      expect(forgotPasswordRoute?.file).toBe("routes/auth/forgot-password.tsx");
    });

    it("should have auth/reset-password route configured", () => {
      const resetPasswordRoute = allRoutes.find(
        (r) => r.path === "auth/reset-password"
      );
      expect(resetPasswordRoute).toBeDefined();
      expect(resetPasswordRoute?.file).toBe("routes/auth/reset-password.tsx");
    });

    it("auth forgot-password file should exist on disk", () => {
      const route = allRoutes.find((r) => r.path === "auth/forgot-password");
      expect(route).toBeDefined();
      const filePath = resolve(projectRoot, "app", route!.file);
      expect(existsSync(filePath)).toBe(true);
    });

    it("auth reset-password file should exist on disk", () => {
      const route = allRoutes.find((r) => r.path === "auth/reset-password");
      expect(route).toBeDefined();
      const filePath = resolve(projectRoot, "app", route!.file);
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe("Route placement", () => {
    it("tenant forgot-password should be outside the tenant layout (no auth required)", () => {
      // The forgot-password route should be at the same level as tenant/login,
      // NOT nested inside the layout that requires auth
      const routeStrings = allRoutes.map((r) => r.path);
      const forgotIndex = routeStrings.indexOf("tenant/forgot-password");
      const loginIndex = routeStrings.indexOf("tenant/login");

      expect(forgotIndex).toBeGreaterThan(-1);
      expect(loginIndex).toBeGreaterThan(-1);

      // forgot-password should be near login (both outside layout)
      // They should be adjacent or very close in the route config
      expect(Math.abs(forgotIndex - loginIndex)).toBeLessThanOrEqual(2);
    });

    it("tenant reset-password should be outside the tenant layout (no auth required)", () => {
      const routeStrings = allRoutes.map((r) => r.path);
      const resetIndex = routeStrings.indexOf("tenant/reset-password");
      const loginIndex = routeStrings.indexOf("tenant/login");

      expect(resetIndex).toBeGreaterThan(-1);
      expect(loginIndex).toBeGreaterThan(-1);

      expect(Math.abs(resetIndex - loginIndex)).toBeLessThanOrEqual(2);
    });
  });

  describe("Site login forgot-password link target", () => {
    it("auth/forgot-password route should exist (target of site login link)", () => {
      // The site login page links to /auth/forgot-password
      // This route must exist to avoid 404
      const authForgotRoute = allRoutes.find(
        (r) => r.path === "auth/forgot-password"
      );
      expect(authForgotRoute).toBeDefined();
    });
  });
});
