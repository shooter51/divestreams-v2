/**
 * Tests for DS-pln5: All imported SSI courses show $0.00 price
 *
 * When a course has price=0, the public site should display
 * "Contact for pricing" instead of "$0.00".
 */

import { describe, it, expect } from "vitest";
import { formatPrice } from "../../../../../app/routes/site/courses/index";
import { formatCourseDetailPrice } from "../../../../../app/routes/site/courses/$courseId";

describe("DS-pln5: Zero price courses display 'Contact for pricing'", () => {
  describe("formatPrice (courses list)", () => {
    it("returns 'Contact for pricing' when price is '0.00'", () => {
      expect(formatPrice("0.00", "USD")).toBe("Contact for pricing");
    });

    it("returns 'Contact for pricing' when price is '0'", () => {
      expect(formatPrice("0", "USD")).toBe("Contact for pricing");
    });

    it("returns formatted price when price is greater than zero", () => {
      expect(formatPrice("450.00", "USD")).toBe("$450");
    });

    it("returns 'Contact for pricing' for NaN price", () => {
      expect(formatPrice("invalid", "USD")).toBe("Contact for pricing");
    });
  });

  describe("formatCourseDetailPrice (course detail page)", () => {
    it("returns 'Contact for pricing' when price is '0.00'", () => {
      expect(formatCourseDetailPrice("0.00", "USD")).toBe("site.courses.contactForPricing");
    });

    it("returns 'Contact for pricing' when price is '0'", () => {
      expect(formatCourseDetailPrice("0", "USD")).toBe("site.courses.contactForPricing");
    });

    it("returns formatted price when price is greater than zero", () => {
      expect(formatCourseDetailPrice("450.00", "USD")).toBe("$450");
    });

    it("returns 'Contact for pricing' when price is null", () => {
      expect(formatCourseDetailPrice(null, "USD")).toBe("site.courses.contactForPricing");
    });

    it("returns 'Contact for pricing' for NaN price", () => {
      expect(formatCourseDetailPrice("invalid", "USD")).toBe("site.courses.contactForPricing");
    });
  });
});
