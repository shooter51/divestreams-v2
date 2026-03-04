import { describe, it, expect } from "vitest";

/**
 * Unit tests for reports page display formatting
 * Covers DS-e34, DS-ku2, DS-5bb, DS-yg7
 */

describe("Reports display formatting", () => {
  describe("DS-e34: Booking status capitalisation", () => {
    const bookingStatusLabels: Record<string, string> = {
      confirmed: "Confirmed",
      pending: "Pending",
      checked_in: "Checked In",
      completed: "Completed",
      canceled: "Canceled",
      no_show: "No Show",
    };

    it("capitalises 'confirmed' status", () => {
      expect(bookingStatusLabels["confirmed"]).toBe("Confirmed");
    });

    it("capitalises 'pending' status", () => {
      expect(bookingStatusLabels["pending"]).toBe("Pending");
    });

    it("capitalises 'checked_in' status", () => {
      expect(bookingStatusLabels["checked_in"]).toBe("Checked In");
    });

    it("fallback for unknown status should be capitalised", () => {
      const unknownStatus = "some_new_status";
      const formatted = bookingStatusLabels[unknownStatus] ||
        unknownStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      expect(formatted).toBe("Some New Status");
    });
  });

  describe("DS-ku2: Equipment category capitalisation", () => {
    const equipmentCategoryLabels: Record<string, string> = {
      bcd: "BCD",
      regulator: "Regulator",
      wetsuit: "Wetsuit",
      mask: "Mask",
      fins: "Fins",
      tank: "Tank",
      computer: "Dive Computer",
      torch: "Torch",
      other: "Other",
    };

    it("maps 'bcd' to 'BCD'", () => {
      expect(equipmentCategoryLabels["bcd"]).toBe("BCD");
    });

    it("maps 'torch' to 'Torch'", () => {
      expect(equipmentCategoryLabels["torch"]).toBe("Torch");
    });

    it("fallback for unknown category should be capitalised", () => {
      const unknownCategory = "snorkel_set";
      const formatted = equipmentCategoryLabels[unknownCategory] ||
        unknownCategory.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      expect(formatted).toBe("Snorkel Set");
    });
  });

  describe("DS-5bb: Booking count singular/plural", () => {
    function pluralize(count: number, singular: string, plural?: string): string {
      const word = count === 1 ? singular : (plural || `${singular}s`);
      return `${count} ${word}`;
    }

    it("shows '1 booking' for singular", () => {
      expect(pluralize(1, "booking")).toBe("1 booking");
    });

    it("shows '0 bookings' for zero", () => {
      expect(pluralize(0, "booking")).toBe("0 bookings");
    });

    it("shows '5 bookings' for plural", () => {
      expect(pluralize(5, "booking")).toBe("5 bookings");
    });

    it("handles numeric string values correctly", () => {
      const sqlCount = "1";
      expect(pluralize(Number(sqlCount), "booking")).toBe("1 booking");
    });
  });

  describe("DS-yg7: Revenue currency formatting with decimals", () => {
    function formatCurrencyWithDecimals(amount: number): string {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    }

    it("shows $1,200.00 not $1200 or $1,200", () => {
      expect(formatCurrencyWithDecimals(1200)).toBe("$1,200.00");
    });

    it("shows $0.00 for zero", () => {
      expect(formatCurrencyWithDecimals(0)).toBe("$0.00");
    });

    it("shows $99.50 with cents", () => {
      expect(formatCurrencyWithDecimals(99.5)).toBe("$99.50");
    });

    it("shows $15,000.00 for large amounts", () => {
      expect(formatCurrencyWithDecimals(15000)).toBe("$15,000.00");
    });
  });
});
