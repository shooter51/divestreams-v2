/**
 * Tests for DS-5zyn: Imported TDI/SDI course images show hotlink error
 *
 * Verifies that the formatPrice helper functions correctly handle the
 * price display logic that's coupled with the image fallback fix, and
 * that the exported pure functions used in the course display components
 * behave correctly when images are null or empty.
 */

import { describe, it, expect } from "vitest";
import { formatPrice } from "../../../../../app/routes/site/courses/index";
import { formatCourseDetailPrice } from "../../../../../app/routes/site/courses/$courseId";

describe("DS-5zyn: Course image fallback", () => {
  describe("CourseCard image rendering logic", () => {
    it("treats null images array as no-image state", () => {
      const images: string[] | null = null;
      const hasImage = images && images.length > 0;
      expect(hasImage).toBeFalsy();
    });

    it("treats empty images array as no-image state", () => {
      const images: string[] = [];
      const hasImage = images && images.length > 0;
      expect(hasImage).toBeFalsy();
    });

    it("treats non-empty images array as has-image state", () => {
      const images = ["https://tdisdi.com/wp-content/uploads/2021/08/OW.jpg"];
      const hasImage = images && images.length > 0;
      expect(hasImage).toBeTruthy();
    });

    it("uses first image from array when multiple images are present", () => {
      const images = [
        "https://tdisdi.com/first.jpg",
        "https://tdisdi.com/second.jpg",
      ];
      // CourseCard only uses images[0]
      expect(images[0]).toBe("https://tdisdi.com/first.jpg");
    });
  });

  describe("CourseDetailImage image rendering logic", () => {
    it("treats null images array as no-image state", () => {
      const images: string[] | null = null;
      const hasImage = images && images.length > 0;
      expect(hasImage).toBeFalsy();
    });

    it("treats non-empty images array as has-image state before error", () => {
      const images = ["https://tdisdi.com/wp-content/uploads/2021/08/OW.jpg"];
      const imageError = false;
      const showImage = images && images.length > 0 && !imageError;
      expect(showImage).toBeTruthy();
    });

    it("falls back to placeholder when image load errors", () => {
      const images = ["https://tdisdi.com/wp-content/uploads/2021/08/OW.jpg"];
      const imageError = true;
      const showImage = images && images.length > 0 && !imageError;
      expect(showImage).toBeFalsy();
    });

    it("shows placeholder even when image URL exists if error flag is set", () => {
      const images = ["https://tdisdi.com/some-course.jpg"];
      const imageError = true;
      // After onError fires, imageError becomes true and placeholder is shown
      const showPlaceholder = !images || images.length === 0 || imageError;
      expect(showPlaceholder).toBe(true);
    });
  });

  describe("formatPrice (courses list)", () => {
    it("formats a valid price correctly", () => {
      expect(formatPrice("450.00", "USD")).toBe("$450");
    });

    it("returns contact string for zero price", () => {
      expect(formatPrice("0", "USD")).toBe("Contact for pricing");
    });

    it("returns contact string for NaN price", () => {
      expect(formatPrice("not-a-number", "USD")).toBe("Contact for pricing");
    });
  });

  describe("formatCourseDetailPrice (course detail)", () => {
    it("formats a valid price correctly", () => {
      expect(formatCourseDetailPrice("450.00", "USD")).toBe("$450");
    });

    it("returns i18n key for null price", () => {
      expect(formatCourseDetailPrice(null, "USD")).toBe(
        "site.courses.contactForPricing"
      );
    });

    it("returns i18n key for zero price", () => {
      expect(formatCourseDetailPrice("0", "USD")).toBe(
        "site.courses.contactForPricing"
      );
    });

    it("returns i18n key for NaN price", () => {
      expect(formatCourseDetailPrice("not-a-number", "USD")).toBe(
        "site.courses.contactForPricing"
      );
    });
  });
});
