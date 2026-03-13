import { test, expect, type Page } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";
import { loginToTenant } from "../fixtures/test-fixtures";

/**
 * Smoke tests for tenant static routes (list pages, new forms, settings).
 * All require tenant auth. Asserts 200 and no error boundary.
 */
test.describe("Smoke: Tenant static pages", () => {
  // Unauthenticated tenant routes
  test.describe("Auth pages (no login)", () => {
    const authRoutes = [
      { path: "/tenant/login", name: "Tenant Login" },
      { path: "/tenant/forgot-password", name: "Forgot Password" },
      { path: "/auth/login", name: "Auth Login" },
      { path: "/auth/signup", name: "Auth Signup" },
      { path: "/auth/forgot-password", name: "Auth Forgot Password" },
    ];

    for (const { path, name } of authRoutes) {
      test(`${name} (${path}) renders`, async ({ page }) => {
        const response = await page.goto(getTenantUrl("demo", path), {
          waitUntil: "domcontentloaded",
        });
        // Login pages may redirect, so accept 200 or redirect target
        expect(response?.status()).toBeLessThan(400);

        const body = await page.locator("body").innerText();
        expect(body.length).toBeGreaterThan(0);
      });
    }
  });

  // Authenticated tenant routes
  test.describe("Authenticated routes", () => {
    let authedPage: Page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      authedPage = await context.newPage();
      await loginToTenant(authedPage);
    });

    test.afterAll(async () => {
      await authedPage.context().close();
    });

    const routes = [
      // Dashboard
      { path: "/tenant", name: "Dashboard" },

      // Bookings
      { path: "/tenant/bookings", name: "Bookings" },
      { path: "/tenant/bookings/new", name: "New Booking" },

      // Calendar
      { path: "/tenant/calendar", name: "Calendar" },

      // POS
      { path: "/tenant/pos", name: "POS" },
      { path: "/tenant/pos/products", name: "POS Products" },
      { path: "/tenant/pos/products/new", name: "New POS Product" },
      { path: "/tenant/pos/transactions", name: "POS Transactions" },

      // Customers
      { path: "/tenant/customers", name: "Customers" },
      { path: "/tenant/customers/new", name: "New Customer" },

      // Tours
      { path: "/tenant/tours", name: "Tours" },
      { path: "/tenant/tours/new", name: "New Tour" },

      // Trips
      { path: "/tenant/trips", name: "Trips" },
      { path: "/tenant/trips/new", name: "New Trip" },

      // Dive Sites
      { path: "/tenant/dive-sites", name: "Dive Sites" },
      { path: "/tenant/dive-sites/new", name: "New Dive Site" },

      // Boats
      { path: "/tenant/boats", name: "Boats" },
      { path: "/tenant/boats/new", name: "New Boat" },

      // Equipment
      { path: "/tenant/equipment", name: "Equipment" },
      { path: "/tenant/equipment/new", name: "New Equipment" },
      { path: "/tenant/equipment/rentals", name: "Equipment Rentals" },

      // Products
      { path: "/tenant/products", name: "Products" },

      // Discounts
      { path: "/tenant/discounts", name: "Discounts" },

      // Gallery
      { path: "/tenant/gallery", name: "Gallery" },
      { path: "/tenant/gallery/new", name: "New Album" },

      // Training
      { path: "/tenant/training", name: "Training" },
      { path: "/tenant/training/import", name: "Training Import" },
      { path: "/tenant/training/courses", name: "Training Courses" },
      { path: "/tenant/training/courses/new", name: "New Course" },
      { path: "/tenant/training/series", name: "Training Series" },
      { path: "/tenant/training/series/new", name: "New Series" },
      { path: "/tenant/training/sessions", name: "Training Sessions" },
      { path: "/tenant/training/sessions/new", name: "New Session" },
      { path: "/tenant/training/enrollments", name: "Training Enrollments" },
      { path: "/tenant/training/enrollments/new", name: "New Enrollment" },

      // Reports
      { path: "/tenant/reports", name: "Reports" },

      // Settings
      { path: "/tenant/settings", name: "Settings" },
      { path: "/tenant/settings/profile", name: "Settings Profile" },
      { path: "/tenant/settings/billing", name: "Settings Billing" },
      { path: "/tenant/settings/team", name: "Settings Team" },
      { path: "/tenant/settings/integrations", name: "Settings Integrations" },
      { path: "/tenant/settings/integrations/quickbooks", name: "QuickBooks" },
      { path: "/tenant/settings/integrations/zapier", name: "Zapier" },
      { path: "/tenant/settings/notifications", name: "Notifications" },
      { path: "/tenant/settings/booking-widget", name: "Booking Widget" },
      { path: "/tenant/settings/password", name: "Password" },
      { path: "/tenant/settings/user-profile", name: "User Profile" },
      { path: "/tenant/settings/public-site", name: "Public Site General" },
      { path: "/tenant/settings/public-site/content", name: "Public Site Content" },
      { path: "/tenant/settings/public-site/appearance", name: "Public Site Appearance" },
      { path: "/tenant/settings/public-site/pages", name: "Public Site Pages" },
      { path: "/tenant/settings/public-site/team", name: "Public Site Team" },
      { path: "/tenant/settings/translations", name: "Translations" },
      { path: "/tenant/settings/training/agencies", name: "Training Agencies" },
      { path: "/tenant/settings/training/levels", name: "Training Levels" },
    ];

    for (const { path, name } of routes) {
      test(`${name} (${path}) renders without error`, async () => {
        const response = await authedPage.goto(getTenantUrl("demo", path), {
          waitUntil: "domcontentloaded",
        });
        expect(response?.status(), `${name} should return 200`).toBe(200);

        const body = await authedPage.locator("body").innerText();
        expect(body.length, `${name} should render content`).toBeGreaterThan(0);

        const errorBoundary = await authedPage
          .locator('text="Unexpected Application Error"')
          .count();
        expect(errorBoundary, `${name} should not show error boundary`).toBe(0);
      });
    }
  });
});
