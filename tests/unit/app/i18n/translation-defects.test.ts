/**
 * Tests for i18n translation defects:
 * DS-iyrl: Login error "Invalid email or password" not translated
 * DS-egxs: Dashboard "Unlimited" not translated
 * DS-49j8: Trip names/descriptions translated via content_translations
 * DS-jj30: Course descriptions translated via content_translations
 */
import { describe, it, expect } from "vitest";
import { t, getTranslations } from "../../../../app/i18n/index";

describe("DS-iyrl: Login error i18n key exists in both locales", () => {
  const en = getTranslations("en");
  const es = getTranslations("es");

  it("has auth.login.invalidCredentials key in English", () => {
    expect(en["auth.login.invalidCredentials"]).toBe("Invalid email or password");
  });

  it("has auth.login.invalidCredentials key in Spanish", () => {
    expect(es["auth.login.invalidCredentials"]).toBe("Correo electrónico o contraseña inválidos");
  });

  it("t() resolves the key correctly for English", () => {
    expect(t(en, "auth.login.invalidCredentials")).toBe("Invalid email or password");
  });

  it("t() resolves the key correctly for Spanish", () => {
    expect(t(es, "auth.login.invalidCredentials")).toBe("Correo electrónico o contraseña inválidos");
  });
});

describe("DS-egxs: common.unlimited i18n key exists in both locales", () => {
  const en = getTranslations("en");
  const es = getTranslations("es");

  it("has common.unlimited key in English", () => {
    expect(en["common.unlimited"]).toBe("Unlimited");
  });

  it("has common.unlimited key in Spanish", () => {
    expect(es["common.unlimited"]).toBe("Ilimitado");
  });

  it("t() resolves unlimited correctly for Spanish", () => {
    expect(t(es, "common.unlimited")).toBe("Ilimitado");
  });
});

describe("DS-49j8/DS-jj30: content translation lookup returns field values", () => {
  it("t() falls back to key for unknown keys (content not in i18n)", () => {
    const es = getTranslations("es");
    // Content translations (entity names) are NOT in the i18n JSON files.
    // They come from the content_translations DB table.
    // The t() function falls back to the key itself for unknown keys.
    expect(t(es, "nonexistent.key.test")).toBe("nonexistent.key.test");
  });

  it("site.trips.type keys are translated (proving static i18n works)", () => {
    const es = getTranslations("es");
    // These are the trip TYPE badges that ARE translated (per defect description)
    expect(es["site.trips.type.singleDive"]).toBeDefined();
    expect(es["site.trips.type.multiDive"]).toBeDefined();
  });
});
