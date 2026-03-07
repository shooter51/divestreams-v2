import { describe, it, expect, vi, beforeEach } from "vitest";
import { t, getTranslations } from "../../../../app/i18n/index";

describe("i18n core", () => {
  describe("t()", () => {
    it("returns correct translation for existing key", () => {
      const translations = getTranslations("es");
      expect(t(translations, "nav.home")).toBe("Inicio");
    });

    it("falls back to English when key missing in target locale", () => {
      // Use a partial translations object missing a key that exists in en
      const partial: Record<string, string> = { "nav.home": "Casa" };
      // "nav.about" not in partial, should fall back to English
      expect(t(partial, "nav.about")).toBe("About");
    });

    it("falls back to key itself when missing from all locales", () => {
      const translations = getTranslations("en");
      expect(t(translations, "nonexistent.key.xyz")).toBe("nonexistent.key.xyz");
    });

    it("handles {{name}} interpolation", () => {
      const translations: Record<string, string> = {
        "site.trips.spotsLeft": "{{count}} spots left",
      };
      expect(t(translations, "site.trips.spotsLeft", { count: 5 })).toBe("5 spots left");
    });

    it("handles multiple interpolation params", () => {
      const translations: Record<string, string> = {
        "common.pageOf": "Page {{page}} of {{total}}",
      };
      expect(t(translations, "common.pageOf", { page: 2, total: 10 })).toBe("Page 2 of 10");
    });

    it("handles special regex characters in param keys safely", () => {
      const translations: Record<string, string> = {
        greeting: "Hello {{user.name}}!",
      };
      expect(t(translations, "greeting", { "user.name": "Alice" })).toBe("Hello Alice!");
    });
  });

  describe("getTranslations()", () => {
    it("returns translations for valid locale", () => {
      const es = getTranslations("es");
      expect(es["nav.home"]).toBe("Inicio");
    });

    it("returns English for unknown locale fallback", () => {
      const unknown = getTranslations("fr" as any);
      expect(unknown["nav.home"]).toBe("Home");
    });

    it("caches translations on second call", () => {
      const first = getTranslations("en");
      const second = getTranslations("en");
      expect(first).toBe(second); // same reference
    });
  });
});
