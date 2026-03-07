import { describe, it, expect } from "vitest";
import { t, getTranslations } from "../../../app/i18n/index";

describe("t() translation function", () => {
  const en = getTranslations("en");
  const es = getTranslations("es");

  it("returns the translated value for a known key", () => {
    expect(t(en, "nav.home")).toBe("Home");
    expect(t(es, "nav.home")).toBe("Inicio");
  });

  it("falls back to English when key missing in non-English locale", () => {
    const esWithMissingKey: Record<string, string> = { "nav.home": "Inicio" };
    expect(t(esWithMissingKey, "nav.about")).toBe("About");
  });

  it("falls back to the key itself when not found in any locale", () => {
    expect(t({}, "nonexistent.key")).toBe("nonexistent.key");
  });

  it("interpolates {{param}} placeholders", () => {
    expect(t(en, "site.trips.showingXofY", { count: 5, total: 20 })).toBe(
      "Showing 5 of 20 trips"
    );
  });

  it("interpolates {{name}} in Spanish", () => {
    expect(t(es, "site.account.welcomeBack", { name: "Juan" })).toBe(
      "¡Bienvenido de nuevo, Juan!"
    );
  });

  it("interpolates {{count}} with numbers in home strings", () => {
    expect(t(en, "site.home.xDays", { count: 3 })).toBe("3 days");
    expect(t(es, "site.home.xDays", { count: 3 })).toBe("3 días");
  });

  it("handles multiple occurrences of the same placeholder", () => {
    const translations: Record<string, string> = {
      "test.key": "Hello {{name}}, welcome {{name}}!",
    };
    expect(t(translations, "test.key", { name: "Alice" })).toBe(
      "Hello Alice, welcome Alice!"
    );
  });

  it("returns value unchanged when no params provided for a key with placeholders", () => {
    expect(t(en, "site.trips.showingXofY")).toContain("{{count}}");
  });

  it("all keys in en.json have corresponding keys in es.json", () => {
    const enKeys = Object.keys(en);
    const esKeys = new Set(Object.keys(es));
    const missingInEs = enKeys.filter((k) => !esKeys.has(k));
    expect(missingInEs).toEqual([]);
  });
});
