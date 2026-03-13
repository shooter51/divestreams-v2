import { describe, it, expect } from "vitest";
import { t, getTranslations } from "../../../app/i18n/index";

/**
 * Regression tests for DS-sc8j:
 *  1. tenant.bookings.created — {{date}} placeholder must not appear in output
 *  2. tenant.bookings.internalNotes — must not have trailing colon (colon is added by JSX)
 *  3. tenant.bookings.recordPayment — must not have a leading + prefix (decoration belongs in JSX)
 */
describe("DS-sc8j booking detail i18n fixes", () => {
  const en = getTranslations("en");
  const es = getTranslations("es");

  describe("tenant.bookings.created — {{date}} interpolation", () => {
    it("en: renders date when a valid date string is provided", () => {
      const result = t(en, "tenant.bookings.created", { date: "Mar 13, 2026" });
      expect(result).not.toContain("{{date}}");
      expect(result).toContain("Mar 13, 2026");
    });

    it("es: renders date when a valid date string is provided", () => {
      const result = t(es, "tenant.bookings.created", { date: "13 mar 2026" });
      expect(result).not.toContain("{{date}}");
      expect(result).toContain("13 mar 2026");
    });

    it("en: renders a fallback when date param is empty string (null createdAt)", () => {
      const result = t(en, "tenant.bookings.created", { date: "" });
      // Should not leave an unterminated placeholder visible
      expect(result).not.toContain("{{date}}");
    });

    it("es: renders a fallback when date param is empty string (null createdAt)", () => {
      const result = t(es, "tenant.bookings.created", { date: "" });
      expect(result).not.toContain("{{date}}");
    });
  });

  describe("tenant.bookings.internalNotes — no trailing colon in translation value", () => {
    it("en: value does not end with ':'", () => {
      const value = en["tenant.bookings.internalNotes"];
      expect(value).toBeDefined();
      expect(value.endsWith(":")).toBe(false);
    });

    it("es: value does not end with ':'", () => {
      const value = es["tenant.bookings.internalNotes"];
      expect(value).toBeDefined();
      expect(value.endsWith(":")).toBe(false);
    });
  });

  describe("tenant.bookings.specialRequests — colon is in the translation (label style)", () => {
    it("en: value ends with ':' (label style, no JSX colon added)", () => {
      const value = en["tenant.bookings.specialRequests"];
      expect(value).toBeDefined();
      expect(value.endsWith(":")).toBe(true);
    });

    it("es: value ends with ':' (label style, no JSX colon added)", () => {
      const value = es["tenant.bookings.specialRequests"];
      expect(value).toBeDefined();
      expect(value.endsWith(":")).toBe(true);
    });
  });

  describe("tenant.bookings.recordPayment — no leading '+' prefix in translation value", () => {
    it("en: value does not start with '+'", () => {
      const value = en["tenant.bookings.recordPayment"];
      expect(value).toBeDefined();
      expect(value.startsWith("+")).toBe(false);
    });

    it("es: value does not start with '+'", () => {
      const value = es["tenant.bookings.recordPayment"];
      expect(value).toBeDefined();
      expect(value.startsWith("+")).toBe(false);
    });
  });
});
