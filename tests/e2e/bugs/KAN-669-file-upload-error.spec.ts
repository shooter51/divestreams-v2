/**
 * E2E Test for KAN-669: File upload error doesn't specify which file is too large
 *
 * Bug: When uploading an oversized file, the error message was generic:
 *   "File too large. Maximum size: 10MB"
 * Fix: Error now includes the filename and actual size:
 *   '"big-photo.jpg" is too large (15.0MB). Maximum size: 10MB'
 *
 * The improved error format is in /tenant/images/upload (entity-based uploads).
 * Gallery uploads (/tenant/gallery/upload) use redirect notifications with filename.
 */

import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { TenantBasePage } from "../page-objects/base.page";

class ImageUploadPage extends TenantBasePage {
  async gotoLogin(): Promise<void> {
    await this.gotoAuth("/login");
  }

  async goto(pagePath: string): Promise<void> {
    await this.gotoApp(pagePath);
  }
}

test.describe("KAN-669: File upload error specifies filename", () => {
  let uploadPage: ImageUploadPage;

  test.beforeEach(async ({ page }) => {
    uploadPage = new ImageUploadPage(page, "demo");

    // Login as demo tenant admin
    await uploadPage.gotoLogin();
    await page.waitForLoadState("load");

    await page.getByRole("textbox", { name: /email/i }).fill("e2e-tester@demo.com");
    await page.locator('input[type="password"]').first().fill("DemoPass1234");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/tenant/, { timeout: 10000 });
  });

  test("oversized file upload shows error with filename and size", async ({
    page,
  }) => {
    test.setTimeout(30000);

    // Test the /tenant/images/upload API endpoint directly — this is the route
    // that was fixed to include filename in the error message.
    // Using page.request preserves the authenticated session cookies.
    const baseUrl = uploadPage["tenantUrl"];

    // Get CSRF token from the upload-images form page (has <CsrfInput /> in the form).
    // The /tenant/images/upload endpoint calls requireOrgContext which runs requireCsrf,
    // so we must include the _csrf token in multipart requests.
    await page.goto(`${baseUrl}/tenant/gallery/upload-images`);
    await page.waitForLoadState("networkidle");
    const csrfToken = await page.evaluate(() => {
      const input = document.querySelector('input[name="_csrf"]') as HTMLInputElement;
      return input?.value ?? null;
    });

    const response = await page.request.post(
      `${baseUrl}/tenant/images/upload`,
      {
        multipart: {
          file: {
            name: "oversized-test-image.jpg",
            mimeType: "image/jpeg",
            buffer: Buffer.alloc(11 * 1024 * 1024),
          },
          entityType: "tour",
          entityId: "test-entity-1",
          ...(csrfToken ? { _csrf: csrfToken } : {}),
        },
      }
    );

    // The API should return 400 with the improved error message
    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("oversized-test-image.jpg");
    expect(json.error).toContain("too large");
    expect(json.error).toContain("Maximum size: 10MB");
  });

  test("valid file upload succeeds without error", async ({ page }) => {
    test.setTimeout(30000);

    // Navigate to gallery and find an album to test upload flow
    await uploadPage.goto("/gallery");

    const albumLink = page
      .locator('a[href*="/tenant/gallery/"]:not([href$="/new"]):not([href$="/upload"]):not([href*="/upload-images"])')
      .first();
    if (!(await albumLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "No albums available for upload test");
      return;
    }

    await albumLink.click();
    await page.waitForURL(/\/tenant\/gallery\/[a-f0-9-]+/);

    const uploadLink = page.getByRole("link", { name: /upload images/i }).first();
    if (!(await uploadLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "Upload link not found on album page");
      return;
    }

    await uploadLink.click();
    await page.waitForURL(/\/tenant\/gallery\/upload-images/);

    const fileInput = page.locator('input[type="file"][name="file"]');
    if (!(await fileInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, "File input not found on upload page");
      return;
    }

    const testImagePath = path.join(__dirname, "../../fixtures/test-image.jpg");
    if (!fs.existsSync(testImagePath)) {
      test.skip(true, "Test image fixture not found");
      return;
    }

    await fileInput.setInputFiles(testImagePath);

    // Submit the upload form
    await page.getByRole("button", { name: /upload/i }).click();

    // Wait for redirect back to gallery after upload
    await page.waitForURL(/\/tenant\/gallery/, { timeout: 15000 });

    // Should not show "too large" error — either success or storage-not-configured
    const pageContent = await page.content();
    expect(pageContent).not.toContain("too large");
  });

  test("error message includes filename via API", async ({ page }) => {
    test.setTimeout(30000);

    // Use API route directly to verify error format
    const baseUrl = uploadPage["tenantUrl"];

    // Get CSRF token from the upload-images form page (requireOrgContext checks CSRF).
    await page.goto(`${baseUrl}/tenant/gallery/upload-images`);
    await page.waitForLoadState("networkidle");
    const csrfToken = await page.evaluate(() => {
      const input = document.querySelector('input[name="_csrf"]') as HTMLInputElement;
      return input?.value ?? null;
    });

    const response = await page.request.post(
      `${baseUrl}/tenant/images/upload`,
      {
        multipart: {
          file: {
            name: "test-visible-error.jpg",
            mimeType: "image/jpeg",
            buffer: Buffer.alloc(11 * 1024 * 1024),
          },
          entityType: "tour",
          entityId: "tour-1",
          ...(csrfToken ? { _csrf: csrfToken } : {}),
        },
      }
    );

    // Verify the API returns the improved error message with filename
    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("test-visible-error.jpg");
    expect(json.error).toContain("too large");
    expect(json.error).toContain("Maximum size: 10MB");
  });
});
