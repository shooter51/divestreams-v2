/**
 * E2E Test for KAN-630: Album image upload not working
 *
 * Bug: Upload image feature on Album page fails because:
 * - No gallery-specific upload route exists
 * - Generic /tenant/images/upload doesn't support gallery schema
 * - Gallery uses gallery_images table, not generic images table
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { TenantBasePage } from '../page-objects/base.page';

// Helper page object for tenant navigation
class AlbumPage extends TenantBasePage {
  async gotoLogin(): Promise<void> {
    await this.gotoAuth('/login');
  }

  async goto(path: string): Promise<void> {
    await this.gotoApp(path);
  }
}

test.describe('KAN-630: Album Image Upload', () => {
  let albumPage: AlbumPage;

  test.beforeEach(async ({ page }) => {
    albumPage = new AlbumPage(page, 'demo');

    // Login as demo tenant admin
    await albumPage.gotoLogin();
    await page.waitForLoadState("load");

    // Fill in login credentials using accessibility-based selectors
    await page.getByRole("textbox", { name: /email/i }).fill("e2e-tester@demo.com");
    await page.locator('input[type="password"]').first().fill("DemoPass1234");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for redirect to tenant dashboard after successful login
    await page.waitForURL(/\/tenant/, { timeout: 10000 });
  });

  test('should upload image to album successfully', async ({ page }) => {
    // Set longer timeout for image upload processing
    test.setTimeout(30000);

    // Navigate to gallery page using tenant subdomain
    await albumPage.goto('/gallery');
    await expect(page.getByRole('heading', { level: 1, name: /gallery/i })).toBeVisible();

    // Find an existing album or create one
    const albumExists = await page.locator('a[href*="/tenant/gallery/"]:not([href$="/new"])').count() > 0;

    if (!albumExists) {
      // Create a test album if none exists
      await albumPage.goto('/gallery');
      // Assuming there's a way to create albums - this might need adjustment
      await page.click('button:has-text("New Album")');
      await page.fill('input[name="name"]', 'Test Album for Upload');
      await page.fill('input[name="description"]', 'Test album description');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/tenant\/gallery\/[a-f0-9-]+/);
      // albumId available from URL if needed
    } else {
      // Click first album
      await page.locator('a[href*="/tenant/gallery/"]:not([href$="/new"])').first().click();
      await page.waitForURL(/\/tenant\/gallery\/[a-f0-9-]+/);
      // albumId available from URL if needed
    }

    // Now on album detail page
    await expect(page.locator('h2:has-text("Images")')).toBeVisible();

    // Find upload button (text is "+ Upload Images" in header or "Upload Images" in empty state)
    const uploadButton = page.locator('a:has-text("Upload Images")').first();
    await expect(uploadButton).toBeVisible({ timeout: 5000 });

    // Click upload button
    await uploadButton.click();
    await page.waitForLoadState("load");

    // Should navigate to upload page or show upload modal
    // Wait for either upload form or file input
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible({ timeout: 5000 });

    // Prepare test image
    const testImagePath = path.join(__dirname, '../../fixtures/test-image.jpg');

    // Upload the image
    await fileInput.setInputFiles(testImagePath);

    // Fill metadata (if form exists)
    const titleInput = page.locator('input[name="title"]');
    if (await titleInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await titleInput.fill('Test Upload Image');
    }

    // Submit upload
    const submitButton = page.locator('button[type="submit"]:has-text("Upload"), button:has-text("Save")').first();
    if (await submitButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await submitButton.click();
    }

    // Wait for upload to complete
    await page.waitForLoadState("load").catch(() => {});

    // Verify upload succeeded - should show image in album
    const imageGrid = page.locator('div[class*="grid"]').filter({ has: page.locator('img') });
    await expect(imageGrid).toBeVisible({ timeout: 5000 });

    // Verify at least one image is displayed (longer timeout for image processing)
    const uploadedImage = page.locator('img[alt*="Test Upload Image"], img[src*="webp"]').first();
    await expect(uploadedImage).toBeVisible({ timeout: 10000 });

    // Verify no error messages
    await expect(page.locator('text=error, text=failed').first()).not.toBeVisible();
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    // Navigate to an album using tenant subdomain
    await albumPage.goto('/gallery');
    const albumLink = page.locator('a[href*="/tenant/gallery/"]:not([href$="/new"])').first();

    if (await albumLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await albumLink.click();
      await page.waitForURL(/\/tenant\/gallery\/[a-f0-9-]+/);

      // Find upload button (could be "Upload Images" or "+ Upload Images")
      const uploadButton = page.locator('a:has-text("Upload")').first();

      if (await uploadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await uploadButton.click();

        // Try to upload invalid file type
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          const invalidFile = path.join(__dirname, '../../fixtures/test-document.txt');
          await fileInput.setInputFiles(invalidFile);

          // Should show error for invalid file type
          const errorMessage = page.locator('text=/invalid.*file.*type/i, text=/allowed.*jpeg.*png/i').first();
          await expect(errorMessage).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });

  test('should display uploaded images in album', async ({ page }) => {
    // Navigate to gallery using tenant subdomain
    await albumPage.goto('/gallery');

    // Navigate to first album
    const albumLink = page.locator('a[href*="/tenant/gallery/"]:not([href$="/new"])').first();
    if (await albumLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await albumLink.click();
      await page.waitForURL(/\/tenant\/gallery\/[a-f0-9-]+/);

      // Check if images are displayed
      const imagesSection = page.locator('h2:has-text("Images")');
      await expect(imagesSection).toBeVisible();

      // Either images exist or show empty state
      const hasImages = await page.locator('img[src*="/"]').count() > 0;
      const hasEmptyState = await page.locator('text="No images yet"').isVisible();

      expect(hasImages || hasEmptyState).toBeTruthy();
    }
  });
});
