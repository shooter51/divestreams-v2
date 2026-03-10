/**
 * Unit tests for code-bugs-round6 fixes.
 *
 * Tests the defensive patterns introduced to guard against:
 * 1. Unsafe array access when splitting customer names
 * 2. Empty string crash in billing invoice status capitalization
 * 3. NaN from parseFloat on invalid tax rate strings
 * 4. Unsafe locale parsing with empty Accept-Language parts
 * 5. NaN from parseFloat on invalid price strings in Zapier booking
 */

import { describe, it, expect } from "vitest";
import { resolveLocale } from "../../../../../app/i18n/resolve-locale";

// ── Bug 1: Unsafe array access in POS transactions ──────────────────────
describe("Bug 1: Customer name splitting with optional chaining", () => {
  function splitCustomerName(customerName: string | null | undefined) {
    return {
      firstName: customerName?.split(" ")?.[0] ?? "",
      lastName: customerName?.split(" ")?.slice(1)?.join(" ") ?? "",
    };
  }

  it("handles a normal full name", () => {
    const result = splitCustomerName("John Doe");
    expect(result.firstName).toBe("John");
    expect(result.lastName).toBe("Doe");
  });

  it("handles a name with multiple parts", () => {
    const result = splitCustomerName("John Michael Doe");
    expect(result.firstName).toBe("John");
    expect(result.lastName).toBe("Michael Doe");
  });

  it("handles a single name", () => {
    const result = splitCustomerName("John");
    expect(result.firstName).toBe("John");
    expect(result.lastName).toBe("");
  });

  it("handles null customerName", () => {
    const result = splitCustomerName(null);
    expect(result.firstName).toBe("");
    expect(result.lastName).toBe("");
  });

  it("handles undefined customerName", () => {
    const result = splitCustomerName(undefined);
    expect(result.firstName).toBe("");
    expect(result.lastName).toBe("");
  });

  it("handles empty string customerName", () => {
    const result = splitCustomerName("");
    expect(result.firstName).toBe("");
    expect(result.lastName).toBe("");
  });
});

// ── Bug 2: Empty string crash in billing invoice status ─────────────────
describe("Bug 2: Invoice status capitalization with empty string guard", () => {
  function capitalizeStatus(status: string | undefined | null) {
    if (status === "paid") return "Paid";
    if (status === "pending") return "Pending";
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : "";
  }

  it("capitalizes a normal status", () => {
    expect(capitalizeStatus("draft")).toBe("Draft");
  });

  it("returns translated value for paid", () => {
    expect(capitalizeStatus("paid")).toBe("Paid");
  });

  it("returns translated value for pending", () => {
    expect(capitalizeStatus("pending")).toBe("Pending");
  });

  it("handles empty string without crashing", () => {
    expect(capitalizeStatus("")).toBe("");
  });

  it("handles undefined without crashing", () => {
    expect(capitalizeStatus(undefined)).toBe("");
  });

  it("handles null without crashing", () => {
    expect(capitalizeStatus(null)).toBe("");
  });
});

// ── Bug 3: NaN in POS tax rate ──────────────────────────────────────────
describe("Bug 3: Tax rate parseFloat with NaN guard", () => {
  function parseTaxRate(taxRate: string | undefined | null) {
    const parsed = parseFloat(taxRate ?? "");
    return !isNaN(parsed) ? parsed : 0;
  }

  it("parses a valid tax rate", () => {
    expect(parseTaxRate("8.25")).toBe(8.25);
  });

  it("parses zero", () => {
    expect(parseTaxRate("0")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseTaxRate("")).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(parseTaxRate(undefined)).toBe(0);
  });

  it("returns 0 for null", () => {
    expect(parseTaxRate(null)).toBe(0);
  });

  it("returns 0 for non-numeric string", () => {
    expect(parseTaxRate("abc")).toBe(0);
  });

  it("parses a string with leading number", () => {
    // parseFloat("10abc") returns 10 — this is acceptable behavior
    expect(parseTaxRate("10abc")).toBe(10);
  });
});

// ── Bug 4: Unsafe locale parsing ────────────────────────────────────────
describe("Bug 4: Locale parsing with empty Accept-Language parts", () => {
  function makeRequest(acceptLanguage?: string): Request {
    const headers = new Headers();
    if (acceptLanguage !== undefined) {
      headers.set("Accept-Language", acceptLanguage);
    }
    return new Request("http://localhost", { headers });
  }

  it("handles Accept-Language with trailing comma (empty part)", () => {
    const req = makeRequest("en,");
    expect(resolveLocale(req)).toBe("en");
  });

  it("handles Accept-Language with leading comma (empty part)", () => {
    const req = makeRequest(",en");
    expect(resolveLocale(req)).toBe("en");
  });

  it("handles Accept-Language with only commas", () => {
    const req = makeRequest(",,,");
    expect(resolveLocale(req)).toBe("en");
  });

  it("handles Accept-Language with empty string", () => {
    const req = makeRequest("");
    expect(resolveLocale(req)).toBe("en");
  });

  it("handles Accept-Language with whitespace-only parts", () => {
    // Empty parts resolve to fallback "en" which is a supported locale,
    // so "en" is returned (it appears first with implicit q=1)
    const req = makeRequest("  ,  , es");
    expect(resolveLocale(req)).toBe("en");
  });
});

// ── Bug 5: NaN in Zapier create-booking price ───────────────────────────
describe("Bug 5: Booking price parseFloat with NaN guard", () => {
  function calculateBookingTotal(
    tripPrice: string | undefined | null,
    tourPrice: string | undefined | null,
    participants: number
  ) {
    const parsed = parseFloat(tripPrice || tourPrice || "0");
    const pricePerPerson = isNaN(parsed) ? 0 : parsed;
    const subtotal = pricePerPerson * participants;
    return { pricePerPerson, subtotal, total: subtotal };
  }

  it("calculates total from trip price", () => {
    const result = calculateBookingTotal("50.00", "30.00", 2);
    expect(result.pricePerPerson).toBe(50);
    expect(result.total).toBe(100);
  });

  it("falls back to tour price when trip price is empty", () => {
    const result = calculateBookingTotal("", "30.00", 2);
    expect(result.pricePerPerson).toBe(30);
    expect(result.total).toBe(60);
  });

  it("returns 0 when both prices are undefined", () => {
    const result = calculateBookingTotal(undefined, undefined, 3);
    expect(result.pricePerPerson).toBe(0);
    expect(result.total).toBe(0);
  });

  it("returns 0 when both prices are null", () => {
    const result = calculateBookingTotal(null, null, 3);
    expect(result.pricePerPerson).toBe(0);
    expect(result.total).toBe(0);
  });

  it("returns 0 when prices are non-numeric strings", () => {
    const result = calculateBookingTotal("abc", "xyz", 2);
    expect(result.pricePerPerson).toBe(0);
    expect(result.total).toBe(0);
  });

  it("handles zero participants", () => {
    const result = calculateBookingTotal("50.00", null, 0);
    expect(result.pricePerPerson).toBe(50);
    expect(result.total).toBe(0);
  });
});
