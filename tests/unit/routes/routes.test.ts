import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";
import routes from "../../../app/routes";

/**
 * Route Configuration Tests
 *
 * These tests verify that routes are properly configured in routes.ts
 * and would catch issues like "No routes matched location" errors.
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

    // Handle index routes
    if (route.index && route.file) {
      result.push({ path: parentPath || "/", file: route.file });
    }

    // Handle nested children
    if (route.children) {
      result.push(...flattenRoutes(route.children, route.path || parentPath));
    }
  }

  return result;
}

// Helper to check if a route pattern matches a given path
function routeMatches(pattern: string, path: string): boolean {
  // Convert route pattern to regex
  // :id becomes a capture group for any non-slash characters
  const regexPattern = pattern
    .replace(/:[^/]+/g, "[^/]+") // Replace :param with [^/]+
    .replace(/\//g, "\\/"); // Escape slashes

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

describe("Route Configuration", () => {
  const allRoutes = flattenRoutes(routes);

  describe("Tour Routes", () => {
    it("should have tour edit route configured", () => {
      const tourEditRoute = allRoutes.find(
        (r) => r.path === "tenant/tours/:id/edit"
      );

      expect(tourEditRoute).toBeDefined();
      expect(tourEditRoute?.file).toContain("tours");
      expect(tourEditRoute?.file).toContain("edit");
    });

    it("should match /tenant/tours/:uuid/edit pattern", () => {
      const testPath = "tours/8a24c176-6327-476b-9713-5bcaf37e1c31/edit";

      // Find a route that would match this path
      const matchingRoute = allRoutes.find((r) => {
        const pattern = r.path.replace(/^tenant\//, ""); // Remove tenant prefix for comparison
        return routeMatches(pattern, testPath) || routeMatches(r.path, testPath);
      });

      expect(matchingRoute).toBeDefined();
      expect(matchingRoute?.path).toMatch(/tours\/:id\/edit/);
    });

    it("tour edit route should come before tour detail route in config", () => {
      // This is critical - more specific routes must come before dynamic routes
      const routeStrings = allRoutes.map((r) => r.path);

      const editIndex = routeStrings.findIndex((p) => p.includes("tours/:id/edit"));
      const detailIndex = routeStrings.findIndex(
        (p) => p.match(/tours\/:id$/) // Exact match for tours/:id
      );

      // Edit route must exist
      expect(editIndex).toBeGreaterThan(-1);

      // If both exist, edit must come before detail
      if (detailIndex > -1) {
        expect(editIndex).toBeLessThan(detailIndex);
      }
    });

    it("should have tour list route", () => {
      const tourListRoute = allRoutes.find(
        (r) => r.path === "tenant/tours"
      );
      expect(tourListRoute).toBeDefined();
    });

    it("should have tour new route", () => {
      const tourNewRoute = allRoutes.find(
        (r) => r.path === "tenant/tours/new"
      );
      expect(tourNewRoute).toBeDefined();
    });

    it("should have tour detail route", () => {
      const tourDetailRoute = allRoutes.find(
        (r) => r.path === "tenant/tours/:id"
      );
      expect(tourDetailRoute).toBeDefined();
    });
  });

  describe("Route File Existence", () => {
    it("tour edit route should point to existing file path", () => {
      const tourEditRoute = allRoutes.find((r) =>
        r.path.includes("tours/:id/edit") || r.path.includes("tours") && r.file.includes("edit")
      );

      expect(tourEditRoute).toBeDefined();
      // The file path should be: routes/tenant/tours/$id/edit.tsx
      expect(tourEditRoute?.file).toMatch(/routes\/tenant\/tours\/\$id\/edit\.tsx$/);
    });

    it("tour edit file should exist on disk", () => {
      const tourEditRoute = allRoutes.find((r) => r.path === "tenant/tours/:id/edit");
      expect(tourEditRoute).toBeDefined();

      // Resolve the full path from the project root
      const projectRoot = resolve(__dirname, "../../..");
      const filePath = resolve(projectRoot, "app", tourEditRoute!.file);

      expect(existsSync(filePath)).toBe(true);
    });

    it("all configured routes should have existing files", () => {
      const projectRoot = resolve(__dirname, "../../..");
      const missingFiles: string[] = [];

      for (const route of allRoutes) {
        if (route.file) {
          const filePath = resolve(projectRoot, "app", route.file);
          if (!existsSync(filePath)) {
            missingFiles.push(`${route.path} -> ${route.file}`);
          }
        }
      }

      expect(missingFiles).toEqual([]);
    });
  });

  describe("Image Routes", () => {
    it("should have image upload route", () => {
      const imageUploadRoute = allRoutes.find(
        (r) => r.path.includes("images/upload")
      );
      expect(imageUploadRoute).toBeDefined();
    });

    it("should have image delete route", () => {
      const imageDeleteRoute = allRoutes.find(
        (r) => r.path.includes("images/delete")
      );
      expect(imageDeleteRoute).toBeDefined();
    });

    it("should have image reorder route", () => {
      const imageReorderRoute = allRoutes.find(
        (r) => r.path.includes("images/reorder")
      );
      expect(imageReorderRoute).toBeDefined();
    });
  });

  describe("Route Order Validation", () => {
    // More specific routes should come before dynamic routes
    const routePatterns = [
      { specific: "bookings/new", dynamic: "bookings/:id" },
      { specific: "bookings/:id/edit", dynamic: "bookings/:id" },
      { specific: "customers/new", dynamic: "customers/:id" },
      { specific: "customers/:id/edit", dynamic: "customers/:id" },
      { specific: "tours/new", dynamic: "tours/:id" },
      { specific: "tours/:id/edit", dynamic: "tours/:id" },
      { specific: "trips/new", dynamic: "trips/:id" },
      { specific: "trips/:id/edit", dynamic: "trips/:id" },
      { specific: "dive-sites/new", dynamic: "dive-sites/:id" },
      { specific: "dive-sites/:id/edit", dynamic: "dive-sites/:id" },
      { specific: "boats/new", dynamic: "boats/:id" },
      { specific: "boats/:id/edit", dynamic: "boats/:id" },
      { specific: "equipment/new", dynamic: "equipment/:id" },
      { specific: "equipment/:id/edit", dynamic: "equipment/:id" },
    ];

    for (const { specific, dynamic } of routePatterns) {
      it(`${specific} should come before ${dynamic}`, () => {
        const routeStrings = allRoutes.map((r) => r.path);

        const specificIndex = routeStrings.findIndex((p) =>
          p.includes(specific)
        );
        const dynamicIndex = routeStrings.findIndex((p) => {
          // Match exact dynamic route, not the specific one
          const pattern = dynamic.replace(/\//g, "\\/").replace(/:id/g, ":id");
          return new RegExp(`${pattern}$`).test(p);
        });

        if (specificIndex > -1 && dynamicIndex > -1) {
          expect(specificIndex).toBeLessThan(dynamicIndex);
        }
      });
    }
  });

  describe("Critical Route Matching", () => {
    const criticalPaths = [
      { path: "tours/8a24c176-6327-476b-9713-5bcaf37e1c31/edit", name: "Tour Edit", pattern: "tenant/tours/:id/edit" },
      { path: "tours/bd0435ee-ba05-4c8c-8d61-d134f2b19e97/edit", name: "Tour Edit (alt UUID)", pattern: "tenant/tours/:id/edit" },
      { path: "bookings/new", name: "New Booking", pattern: "tenant/bookings/new" },
      { path: "customers/abc-123-def", name: "Customer Detail", pattern: "tenant/customers/:id" },
    ];

    for (const { path, name, pattern } of criticalPaths) {
      it(`should match ${name} route: /${path}`, () => {
        const matchingRoute = allRoutes.find((r) => r.path === pattern);

        expect(matchingRoute).toBeDefined();
        expect(routeMatches(matchingRoute!.path, path)).toBe(true);
      });
    }
  });
});
