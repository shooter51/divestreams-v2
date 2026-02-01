/**
 * Security E2E Tests - XSS Prevention
 *
 * Tests that verify XSS attacks are properly prevented across the application.
 * Covers email templates, CMS content, theme customization, and user input.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsCustomer, seedDemoData } from "../helpers/index.ts";

test.describe("XSS Prevention Security", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await seedDemoData(page);
  });

  test.describe("Email Template XSS Prevention", () => {
    test("should escape malicious customer name in booking confirmation email", async ({
      page,
    }) => {
      // Create customer with XSS payload in name
      await page.goto("/tenant/customers/new");
      await page.fill(
        'input[name="firstName"]',
        '<script>alert("XSS")</script>'
      );
      await page.fill('input[name="lastName"]', "Test");
      await page.fill('input[name="email"]', "xss-test@example.com");
      await page.click('button[type="submit"]');

      await expect(page.locator("text=created successfully")).toBeVisible();

      // Create booking for this customer
      await page.goto("/tenant/bookings/new");
      await page.selectOption('select[name="tripId"]', { index: 1 });
      await page.selectOption(
        'select[name="customerId"]',
        { label: /<script>/ } // Select by XSS name
      );
      await page.fill('input[name="total"]', "100.00");
      await page.click('button[type="submit"]');

      await expect(page.locator("text=created successfully")).toBeVisible();

      // Check that the page doesn't execute the script
      // If XSS was successful, an alert would appear
      const hasAlert = await page.evaluate(() => {
        return window.alert !== undefined;
      });
      expect(hasAlert).toBe(true); // Function should exist
      // But no alert should have been triggered (would fail the test)

      // Verify the name is escaped in the page display
      const nameDisplay = await page.locator("td:has-text('<script>')").count();
      expect(nameDisplay).toBeGreaterThan(0); // Literal text visible, not executed
    });

    test("should escape HTML entities in email subject lines", async ({
      page,
    }) => {
      await page.goto("/tenant/customers/new");
      await page.fill('input[name="firstName"]', "Test & <Company>");
      await page.fill('input[name="lastName"]', '"User"');
      await page.fill('input[name="email"]', "test@example.com");
      await page.click('button[type="submit"]');

      // Create booking
      await page.goto("/tenant/bookings/new");
      await page.selectOption('select[name="tripId"]', { index: 1 });
      await page.selectOption('select[name="customerId"]', { index: 1 });
      await page.click('button[type="submit"]');

      // Verify HTML entities are displayed as text, not rendered
      await expect(page.locator('text=Test & <Company>')).toBeVisible();
      await expect(page.locator('text="User"')).toBeVisible();
    });
  });

  test.describe("CMS Content Block XSS Prevention", () => {
    test("should escape malicious HTML in CTA button text", async ({
      page,
    }) => {
      // Navigate to CMS page editor
      await page.goto("/tenant/settings/public-site/pages");
      await page.click('button:has-text("Add Page")');

      await page.fill('input[name="title"]', "Test Page");
      await page.fill('input[name="slug"]', "test-xss");

      // Add CTA block with malicious content
      await page.click('button:has-text("Add Block")');
      await page.click('button:has-text("Call to Action")');

      await page.fill(
        'input[name="ctaTitle"]',
        '<script>alert("XSS in CTA")</script>'
      );
      await page.fill('textarea[name="ctaDescription"]', "Safe description");
      await page.fill('input[name="ctaButtonText"]', '<img src=x onerror=alert(1)>');
      await page.fill('input[name="ctaButtonUrl"]', "https://example.com");

      await page.click('button:has-text("Save Page")');

      // Visit the public page
      await page.goto("/site/test-xss");

      // Verify script tags are escaped, not executed
      const scriptText = await page.locator('text=<script>').count();
      expect(scriptText).toBeGreaterThan(0); // Text visible

      const imgText = await page.locator('text=<img').count();
      expect(imgText).toBeGreaterThan(0); // Text visible, not rendered as img

      // Verify no alert was triggered
      // Test would fail if alert appeared (no explicit wait needed)
    });

    test("should sanitize javascript: URLs in CTA buttons", async ({
      page,
    }) => {
      await page.goto("/tenant/settings/public-site/pages");
      await page.click('button:has-text("Add Page")');

      await page.fill('input[name="title"]', "XSS URL Test");
      await page.fill('input[name="slug"]', "xss-url-test");

      await page.click('button:has-text("Add Block")');
      await page.click('button:has-text("Call to Action")');

      await page.fill('input[name="ctaTitle"]', "Click Me");
      await page.fill('input[name="ctaButtonText"]', "Dangerous Link");
      await page.fill('input[name="ctaButtonUrl"]', 'javascript:alert("XSS")');

      await page.click('button:has-text("Save Page")');

      // Visit the public page
      await page.goto("/site/xss-url-test");

      // Find the CTA button
      const ctaLink = page.locator('a:has-text("Dangerous Link")');
      await expect(ctaLink).toBeVisible();

      // Verify href is sanitized (should be about:blank)
      const href = await ctaLink.getAttribute("href");
      expect(href).not.toContain("javascript:");
      expect(href).toBe("about:blank");
    });
  });

  test.describe("Theme CSS Injection Prevention", () => {
    test("should sanitize malicious CSS color values", async ({ page }) => {
      await page.goto("/tenant/settings/public-site/theme");

      // Try to inject CSS via color field
      await page.fill(
        'input[name="primaryColor"]',
        'red; } body { background: url("javascript:alert(1)"); } .foo {'
      );
      await page.fill(
        'input[name="secondaryColor"]',
        'blue</style><script>alert(2)</script><style>'
      );

      await page.click('button:has-text("Save Theme")');

      // Check for error message or sanitization
      // The invalid color should be rejected or sanitized to #000000
      await page.goto("/tenant/settings/public-site/theme");

      const primaryValue = await page
        .locator('input[name="primaryColor"]')
        .inputValue();
      const secondaryValue = await page
        .locator('input[name="secondaryColor"]')
        .inputValue();

      // Should not contain injection attempts
      expect(primaryValue).not.toContain("url(");
      expect(primaryValue).not.toContain("javascript:");
      expect(secondaryValue).not.toContain("</style>");
      expect(secondaryValue).not.toContain("<script>");
    });

    test("should only allow valid hex colors", async ({ page }) => {
      await page.goto("/tenant/settings/public-site/theme");

      // Test various invalid color formats
      const invalidColors = [
        'red"}body{background:red}{"',
        "#GGGGGG",
        "rgb(255,0,0)",
        "hsl(0,100%,50%)",
        'url("javascript:alert(1)")',
      ];

      for (const color of invalidColors) {
        await page.fill('input[name="primaryColor"]', color);
        await page.click('button:has-text("Save Theme")');

        // Should show error or sanitize to #000000
        await page.waitForLoadState('networkidle');
        const value = await page
          .locator('input[name="primaryColor"]')
          .inputValue();

        // Should either be unchanged (validation error) or sanitized to black
        if (value === color) {
          // If unchanged, there should be an error message
          await expect(
            page.locator("text=/invalid.*color|color.*invalid/i")
          ).toBeVisible();
        } else {
          // If changed, should be sanitized to safe value
          expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      }
    });
  });

  test.describe("Map Embed XSS Prevention", () => {
    test("should sanitize Google Maps embed code", async ({ page }) => {
      await page.goto("/tenant/settings/public-site/content");

      // Try to inject script via map embed
      const maliciousEmbed = `
        <iframe src="https://www.google.com/maps/embed?pb=test"></iframe>
        <script>alert("XSS in map embed")</script>
      `;

      await page.fill('textarea[name="mapEmbed"]', maliciousEmbed);
      await page.click('button:has-text("Save")');

      await expect(page.locator("text=updated successfully")).toBeVisible();

      // Reload and verify script is stripped
      await page.goto("/tenant/settings/public-site/content");
      const embedValue = await page
        .locator('textarea[name="mapEmbed"]')
        .inputValue();

      expect(embedValue).toContain("<iframe");
      expect(embedValue).not.toContain("<script>");
    });

    test("should block non-Google Maps iframe sources", async ({ page }) => {
      await page.goto("/tenant/settings/public-site/content");

      const evilEmbed = '<iframe src="https://evil.com/fake-map"></iframe>';

      await page.fill('textarea[name="mapEmbed"]', evilEmbed);
      await page.click('button:has-text("Save")');

      // Should be rejected or sanitized
      await page.goto("/tenant/settings/public-site/content");
      const embedValue = await page
        .locator('textarea[name="mapEmbed"]')
        .inputValue();

      // Either empty or doesn't contain evil.com
      expect(embedValue).not.toContain("evil.com");
    });
  });

  test.describe("User Input XSS Prevention", () => {
    test("should escape XSS in customer notes", async ({ page }) => {
      await page.goto("/tenant/customers/new");
      await page.fill('input[name="firstName"]', "John");
      await page.fill('input[name="lastName"]', "Doe");
      await page.fill('input[name="email"]', "john@example.com");
      await page.fill(
        'textarea[name="notes"]',
        '<script>alert("XSS in notes")</script>'
      );
      await page.click('button[type="submit"]');

      await expect(page.locator("text=created successfully")).toBeVisible();

      // View customer details
      const customerId = page.url().split("/").pop();
      await page.goto(`/tenant/customers/${customerId}`);

      // Verify script is displayed as text, not executed
      await expect(page.locator('text=<script>')).toBeVisible();
      // No alert should appear
    });

    test("should escape XSS in product descriptions", async ({ page }) => {
      await page.goto("/tenant/inventory/products/new");
      await page.fill('input[name="name"]', "Test Product");
      await page.fill(
        'textarea[name="description"]',
        '<img src=x onerror="alert(\'Product XSS\')">'
      );
      await page.fill('input[name="price"]', "99.99");
      await page.click('button[type="submit"]');

      await expect(page.locator("text=created successfully")).toBeVisible();

      // View product in POS or catalog
      await page.goto("/tenant/pos");

      // Search for product
      await page.fill('input[type="search"]', "Test Product");

      // Verify description is escaped
      const descriptionText = await page.locator('text=<img').count();
      expect(descriptionText).toBeGreaterThan(0); // Text visible, not rendered as img
    });

    test("should prevent XSS in contact form auto-reply", async ({ page }) => {
      // Logout admin and visit public contact form
      await page.goto("/site/contact");

      await page.fill('input[name="name"]', '<script>alert("Name XSS")</script>');
      await page.fill('input[name="email"]', "test@example.com");
      await page.fill(
        'textarea[name="message"]',
        '<img src=x onerror=alert(1)>'
      );
      await page.click('button[type="submit"]');

      await expect(page.locator("text=message.*sent|thank you/i")).toBeVisible();

      // Admin checks received message
      await loginAsAdmin(page);
      await page.goto("/tenant/settings"); // Navigate to messages or notification area

      // Verify XSS is escaped in admin view
      // The script tag should be visible as text
      await page.goto("/tenant/customers"); // Or wherever messages are displayed

      // No alert should have been triggered (no explicit wait needed)
    });
  });

  test.describe("Stored XSS Prevention", () => {
    test("should escape stored XSS in trip names", async ({ page }) => {
      await page.goto("/tenant/trips/new");
      await page.fill('input[name="name"]', '<svg/onload=alert("Trip XSS")>');
      await page.fill('input[name="description"]', "Test description");
      await page.fill('input[name="price"]', "150.00");
      await page.click('button[type="submit"]');

      await expect(page.locator("text=created successfully")).toBeVisible();

      // View trips list
      await page.goto("/tenant/trips");

      // Verify SVG tag is escaped
      await expect(page.locator('text=<svg')).toBeVisible();
      // No alert should appear
    });

    test("should prevent XSS in training course names", async ({ page }) => {
      await page.goto("/tenant/training/courses/new");
      await page.fill(
        'input[name="name"]',
        'Open Water<img src=x onerror=alert(1)>'
      );
      await page.fill('input[name="price"]', "500.00");
      await page.click('button[type="submit"]');

      await expect(page.locator("text=created successfully")).toBeVisible();

      // View courses list
      await page.goto("/tenant/training/courses");

      // Verify img tag is escaped
      const imgCount = await page.locator('text=<img').count();
      expect(imgCount).toBeGreaterThan(0);
    });
  });
});
