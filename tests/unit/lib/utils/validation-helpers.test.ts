import { describe, it, expect } from "vitest";
import {
  validateMoneyAmount,
  validatePercentage,
  validateInteger,
} from "../../../../lib/utils/validation-helpers";

describe("validateMoneyAmount", () => {
  describe("valid inputs", () => {
    it("validates positive amounts", () => {
      expect(validateMoneyAmount("25.50")).toEqual({
        valid: true,
        amount: 25.5,
      });

      expect(validateMoneyAmount(100)).toEqual({
        valid: true,
        amount: 100,
      });
    });

    it("validates zero when allowed", () => {
      expect(validateMoneyAmount("0")).toEqual({
        valid: true,
        amount: 0,
      });

      expect(validateMoneyAmount(0, { allowZero: true })).toEqual({
        valid: true,
        amount: 0,
      });
    });

    it("rounds to 2 decimal places", () => {
      expect(validateMoneyAmount("25.999")).toEqual({
        valid: true,
        amount: 26.0,
      });

      expect(validateMoneyAmount("10.005")).toEqual({
        valid: true,
        amount: 10.01,
      });

      expect(validateMoneyAmount("15.994")).toEqual({
        valid: true,
        amount: 15.99,
      });
    });

    it("handles string and number inputs", () => {
      expect(validateMoneyAmount("42.50")).toEqual({
        valid: true,
        amount: 42.5,
      });

      expect(validateMoneyAmount(42.5)).toEqual({
        valid: true,
        amount: 42.5,
      });
    });

    it("trims whitespace", () => {
      expect(validateMoneyAmount("  25.50  ")).toEqual({
        valid: true,
        amount: 25.5,
      });
    });

    it("validates within min/max range", () => {
      expect(validateMoneyAmount("50", { min: 10, max: 100 })).toEqual({
        valid: true,
        amount: 50,
      });

      expect(validateMoneyAmount("10", { min: 10 })).toEqual({
        valid: true,
        amount: 10,
      });

      expect(validateMoneyAmount("100", { max: 100 })).toEqual({
        valid: true,
        amount: 100,
      });
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      const result = validateMoneyAmount("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount is required");
    });

    it("rejects non-numeric input", () => {
      const result = validateMoneyAmount("abc");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount must be a valid number");
    });

    it("rejects zero when not allowed", () => {
      const result = validateMoneyAmount("0", { allowZero: false });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount must be greater than $0.00");
    });

    it("rejects amounts below minimum", () => {
      const result = validateMoneyAmount("5", { min: 10 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount must be at least $10.00");
    });

    it("rejects amounts above maximum", () => {
      const result = validateMoneyAmount("150", { max: 100 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount must not exceed $100.00");
    });

    it("rejects negative amounts by default", () => {
      const result = validateMoneyAmount("-10");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount must be at least $0.00");
    });

    it("uses custom field name in error messages", () => {
      const result = validateMoneyAmount("", { fieldName: "Price" });
      expect(result.error).toBe("Price is required");

      const result2 = validateMoneyAmount("abc", { fieldName: "Payment" });
      expect(result2.error).toBe("Payment must be a valid number");
    });
  });

  describe("edge cases", () => {
    it("handles very small amounts", () => {
      expect(validateMoneyAmount("0.01")).toEqual({
        valid: true,
        amount: 0.01,
      });
    });

    it("handles very large amounts", () => {
      expect(validateMoneyAmount("999999.99")).toEqual({
        valid: true,
        amount: 999999.99,
      });
    });

    it("handles scientific notation", () => {
      expect(validateMoneyAmount("1e2")).toEqual({
        valid: true,
        amount: 100,
      });
    });

    it("handles leading zeros", () => {
      expect(validateMoneyAmount("00025.50")).toEqual({
        valid: true,
        amount: 25.5,
      });
    });
  });
});

describe("validatePercentage", () => {
  describe("valid inputs", () => {
    it("validates percentages in 0-100 range", () => {
      expect(validatePercentage("50")).toEqual({
        valid: true,
        percentage: 50,
      });

      expect(validatePercentage(75)).toEqual({
        valid: true,
        percentage: 75,
      });
    });

    it("validates zero", () => {
      expect(validatePercentage("0")).toEqual({
        valid: true,
        percentage: 0,
      });
    });

    it("validates 100", () => {
      expect(validatePercentage("100")).toEqual({
        valid: true,
        percentage: 100,
      });
    });

    it("validates decimal percentages", () => {
      expect(validatePercentage("25.5")).toEqual({
        valid: true,
        percentage: 25.5,
      });

      expect(validatePercentage("99.99")).toEqual({
        valid: true,
        percentage: 99.99,
      });
    });

    it("handles string and number inputs", () => {
      expect(validatePercentage("42")).toEqual({
        valid: true,
        percentage: 42,
      });

      expect(validatePercentage(42)).toEqual({
        valid: true,
        percentage: 42,
      });
    });

    it("trims whitespace", () => {
      expect(validatePercentage("  50  ")).toEqual({
        valid: true,
        percentage: 50,
      });
    });

    it("validates custom min/max range", () => {
      expect(validatePercentage("15", { min: 10, max: 20 })).toEqual({
        valid: true,
        percentage: 15,
      });
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      const result = validatePercentage("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Percentage is required");
    });

    it("rejects non-numeric input", () => {
      const result = validatePercentage("abc");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Percentage must be a valid number");
    });

    it("rejects negative percentages", () => {
      const result = validatePercentage("-10");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Percentage must be at least 0%");
    });

    it("rejects percentages above 100", () => {
      const result = validatePercentage("150");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Percentage must not exceed 100%");
    });

    it("rejects percentages below custom minimum", () => {
      const result = validatePercentage("5", { min: 10 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Percentage must be at least 10%");
    });

    it("rejects percentages above custom maximum", () => {
      const result = validatePercentage("25", { max: 20 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Percentage must not exceed 20%");
    });

    it("uses custom field name in error messages", () => {
      const result = validatePercentage("", { fieldName: "Discount" });
      expect(result.error).toBe("Discount is required");

      const result2 = validatePercentage("abc", { fieldName: "Tax Rate" });
      expect(result2.error).toBe("Tax Rate must be a valid number");
    });
  });

  describe("edge cases", () => {
    it("handles very small percentages", () => {
      expect(validatePercentage("0.01")).toEqual({
        valid: true,
        percentage: 0.01,
      });
    });

    it("handles scientific notation", () => {
      expect(validatePercentage("5e1")).toEqual({
        valid: true,
        percentage: 50,
      });
    });

    it("handles leading zeros", () => {
      expect(validatePercentage("00050")).toEqual({
        valid: true,
        percentage: 50,
      });
    });
  });
});

describe("validateInteger", () => {
  describe("valid inputs", () => {
    it("validates positive integers", () => {
      expect(validateInteger("5")).toEqual({
        valid: true,
        value: 5,
      });

      expect(validateInteger(10)).toEqual({
        valid: true,
        value: 10,
      });
    });

    it("validates zero", () => {
      expect(validateInteger("0")).toEqual({
        valid: true,
        value: 0,
      });
    });

    it("handles string and number inputs", () => {
      expect(validateInteger("42")).toEqual({
        valid: true,
        value: 42,
      });

      expect(validateInteger(42)).toEqual({
        valid: true,
        value: 42,
      });
    });

    it("trims whitespace", () => {
      expect(validateInteger("  25  ")).toEqual({
        valid: true,
        value: 25,
      });
    });

    it("validates within min/max range", () => {
      expect(validateInteger("5", { min: 1, max: 10 })).toEqual({
        valid: true,
        value: 5,
      });

      expect(validateInteger("1", { min: 1 })).toEqual({
        valid: true,
        value: 1,
      });

      expect(validateInteger("10", { max: 10 })).toEqual({
        valid: true,
        value: 10,
      });
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty string", () => {
      const result = validateInteger("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value is required");
    });

    it("rejects non-numeric input", () => {
      const result = validateInteger("abc");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value must be a valid number");
    });

    it("rejects decimal numbers", () => {
      const result = validateInteger("5.5");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value must be a whole number");
    });

    it("accepts numbers with trailing .0", () => {
      // "10.0" is mathematically an integer (10.0 === 10)
      const result = validateInteger("10.0");
      expect(result.valid).toBe(true);
      expect(result.value).toBe(10);
    });

    it("rejects negative numbers by default", () => {
      const result = validateInteger("-5");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value must be at least 0");
    });

    it("rejects values below minimum", () => {
      const result = validateInteger("5", { min: 10 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value must be at least 10");
    });

    it("rejects values above maximum", () => {
      const result = validateInteger("15", { max: 10 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value must not exceed 10");
    });

    it("uses custom field name in error messages", () => {
      const result = validateInteger("", { fieldName: "Quantity" });
      expect(result.error).toBe("Quantity is required");

      const result2 = validateInteger("5.5", { fieldName: "Count" });
      expect(result2.error).toBe("Count must be a whole number");
    });
  });

  describe("edge cases", () => {
    it("handles large integers", () => {
      expect(validateInteger("999999")).toEqual({
        valid: true,
        value: 999999,
      });
    });

    it("handles leading zeros", () => {
      expect(validateInteger("00025")).toEqual({
        valid: true,
        value: 25,
      });
    });

    it("allows negative minimum", () => {
      expect(validateInteger("-5", { min: -10 })).toEqual({
        valid: true,
        value: -5,
      });
    });

    it("rejects scientific notation with decimals", () => {
      const result = validateInteger("1.23e1"); // 1.23e1 = 12.3 (not an integer)
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Value must be a whole number");
    });

    it("accepts scientific notation for whole numbers", () => {
      // Note: "1e2" becomes "100" when converted to string, so it's parsed correctly
      expect(validateInteger("1e2")).toEqual({
        valid: true,
        value: 100,
      });
    });
  });
});
