import { describe, it, expect } from "vitest";
import { formatCurrency } from "../../../../lib/email/triggers";

describe("formatCurrency", () => {
  describe("basic formatting", () => {
    it("should format cents to USD currency", () => {
      expect(formatCurrency(1000)).toBe("$10.00");
      expect(formatCurrency(2550)).toBe("$25.50");
      expect(formatCurrency(9999)).toBe("$99.99");
    });

    it("should handle zero cents", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("should format whole dollars", () => {
      expect(formatCurrency(100)).toBe("$1.00");
      expect(formatCurrency(10000)).toBe("$100.00");
      expect(formatCurrency(100000)).toBe("$1,000.00");
    });

    it("should include two decimal places", () => {
      expect(formatCurrency(150)).toBe("$1.50");
      expect(formatCurrency(1)).toBe("$0.01");
      expect(formatCurrency(99)).toBe("$0.99");
    });
  });

  describe("large amounts", () => {
    it("should format thousands with commas", () => {
      expect(formatCurrency(100000)).toBe("$1,000.00");
      expect(formatCurrency(250000)).toBe("$2,500.00");
      expect(formatCurrency(999999)).toBe("$9,999.99");
    });

    it("should format millions", () => {
      expect(formatCurrency(1000000)).toBe("$10,000.00");
      expect(formatCurrency(10000000)).toBe("$100,000.00");
      expect(formatCurrency(100000000)).toBe("$1,000,000.00");
    });

    it("should handle very large amounts", () => {
      expect(formatCurrency(123456789)).toBe("$1,234,567.89");
      expect(formatCurrency(999999999)).toBe("$9,999,999.99");
    });
  });

  describe("small amounts", () => {
    it("should format single cents", () => {
      expect(formatCurrency(1)).toBe("$0.01");
      expect(formatCurrency(5)).toBe("$0.05");
      expect(formatCurrency(10)).toBe("$0.10");
    });

    it("should format amounts under one dollar", () => {
      expect(formatCurrency(25)).toBe("$0.25");
      expect(formatCurrency(50)).toBe("$0.50");
      expect(formatCurrency(75)).toBe("$0.75");
      expect(formatCurrency(99)).toBe("$0.99");
    });
  });

  describe("edge cases", () => {
    it("should handle negative amounts", () => {
      expect(formatCurrency(-1000)).toBe("-$10.00");
      expect(formatCurrency(-250)).toBe("-$2.50");
    });

    it("should round fractional cents (if input is decimal)", () => {
      // Even though input should be cents, test fractional handling
      expect(formatCurrency(100.5)).toBe("$1.01");
      expect(formatCurrency(100.4)).toBe("$1.00");
    });

    it("should format typical booking amounts", () => {
      // Common dive booking prices
      expect(formatCurrency(5000)).toBe("$50.00");     // $50
      expect(formatCurrency(7500)).toBe("$75.00");     // $75
      expect(formatCurrency(10000)).toBe("$100.00");   // $100
      expect(formatCurrency(15000)).toBe("$150.00");   // $150
      expect(formatCurrency(25000)).toBe("$250.00");   // $250
    });

    it("should format deposit amounts", () => {
      // Typical 50% deposits
      expect(formatCurrency(2500)).toBe("$25.00");     // $25 deposit
      expect(formatCurrency(5000)).toBe("$50.00");     // $50 deposit
      expect(formatCurrency(7500)).toBe("$75.00");     // $75 deposit
    });
  });

  describe("currency symbol and format", () => {
    it("should include dollar sign", () => {
      const result = formatCurrency(1000);
      expect(result).toContain('$');
      expect(result.startsWith('$')).toBe(true);
    });

    it("should use US locale formatting", () => {
      // US format: $1,234.56 (comma for thousands, period for decimals)
      const result = formatCurrency(123456);
      expect(result).toBe("$1,234.56");
      expect(result).toContain(','); // Thousands separator
      expect(result).toContain('.'); // Decimal separator
    });

    it("should not include currency code", () => {
      const result = formatCurrency(1000);
      expect(result).not.toContain('USD');
      expect(result).not.toContain('US');
    });
  });

  describe("precision", () => {
    it("should always show exactly 2 decimal places", () => {
      const amounts = [100, 1000, 10000, 100000];

      for (const amount of amounts) {
        const result = formatCurrency(amount);
        const parts = result.split('.');

        expect(parts).toHaveLength(2);
        expect(parts[1]).toHaveLength(2);
      }
    });

    it("should not round to nearest dollar", () => {
      // Should keep cents precision
      expect(formatCurrency(1001)).toBe("$10.01");
      expect(formatCurrency(1099)).toBe("$10.99");
      expect(formatCurrency(1050)).toBe("$10.50");
    });
  });

  describe("real-world scenarios", () => {
    it("should format common dive trip prices", () => {
      expect(formatCurrency(8500)).toBe("$85.00");     // Local dive
      expect(formatCurrency(15000)).toBe("$150.00");   // 2-tank dive
      expect(formatCurrency(45000)).toBe("$450.00");   // Specialty course
      expect(formatCurrency(125000)).toBe("$1,250.00"); // Liveaboard
    });

    it("should format equipment rental prices", () => {
      expect(formatCurrency(2500)).toBe("$25.00");     // BCD rental
      expect(formatCurrency(3500)).toBe("$35.00");     // Full gear
      expect(formatCurrency(1000)).toBe("$10.00");     // Wetsuit
    });

    it("should format retail prices", () => {
      expect(formatCurrency(29999)).toBe("$299.99");   // Dive computer
      expect(formatCurrency(59995)).toBe("$599.95");   // Regulator
      expect(formatCurrency(89900)).toBe("$899.00");   // Full gear package
    });
  });
});
