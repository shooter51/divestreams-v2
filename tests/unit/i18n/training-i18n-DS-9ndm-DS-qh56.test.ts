import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { t, getTranslations } from "../../../app/i18n/index";

/**
 * Tests for i18n fixes in training module:
 * DS-9ndm: Booking and trip status badges not translated — training enrollment statuses
 *   used formatLabel() instead of t("common.status.*")
 * DS-qh56: Dates not localized — " at " connector string was hardcoded English
 */

const ROOT = process.cwd();

function readSource(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

// ============================================================================
// DS-9ndm: Training enrollment status uses t("common.status.*")
// ============================================================================

describe("DS-9ndm: Training enrollment statuses use i18n", () => {
  const en = getTranslations("en");
  const es = getTranslations("es");

  const enrollmentStatuses = ["enrolled", "in_progress", "completed", "dropped"];

  enrollmentStatuses.forEach((status) => {
    it(`en: common.status.${status} is defined`, () => {
      expect(en[`common.status.${status}`]).toBeDefined();
      expect(en[`common.status.${status}`].length).toBeGreaterThan(0);
    });

    it(`es: common.status.${status} is translated (differs from English)`, () => {
      const esVal = es[`common.status.${status}`];
      const enVal = en[`common.status.${status}`];
      expect(esVal).toBeDefined();
      expect(esVal.length).toBeGreaterThan(0);
      expect(esVal).not.toBe(enVal);
    });
  });

  it("training/index.tsx uses t() for enrollment status, not formatLabel()", () => {
    const source = readSource("app/routes/tenant/training/index.tsx");
    // Must use t() with common.status key, not formatLabel
    expect(source).toContain("common.status.");
    expect(source).not.toContain("formatLabel(enrollment.status)");
  });

  it("t() correctly interpolates Spanish enrollment status 'enrolled'", () => {
    const result = t(es, "common.status.enrolled");
    expect(result).not.toBe("enrolled"); // should be translated
    expect(result).toBe("Inscrito");
  });

  it("t() correctly interpolates Spanish enrollment status 'in_progress'", () => {
    const result = t(es, "common.status.in_progress");
    expect(result).not.toBe("in_progress");
    expect(result).toBe("En Progreso");
  });
});

// ============================================================================
// DS-qh56: Training " at " connector string is translated
// ============================================================================

describe("DS-qh56: Training session time connector 'at' uses i18n", () => {
  const en = getTranslations("en");
  const es = getTranslations("es");

  it("en: tenant.training.sessions.at key exists", () => {
    expect(en["tenant.training.sessions.at"]).toBeDefined();
    expect(en["tenant.training.sessions.at"]).toBe("at");
  });

  it("es: tenant.training.sessions.at is translated to Spanish", () => {
    expect(es["tenant.training.sessions.at"]).toBeDefined();
    expect(es["tenant.training.sessions.at"]).not.toBe("at");
  });

  it("training/index.tsx does not use hardcoded English ' at ' string", () => {
    const source = readSource("app/routes/tenant/training/index.tsx");
    // Must not contain the literal hardcoded " at " template expression
    expect(source).not.toContain("` at ${");
    expect(source).not.toContain("' at '");
    expect(source).not.toContain('" at "');
  });

  it("training/index.tsx uses t() for 'at' connector", () => {
    const source = readSource("app/routes/tenant/training/index.tsx");
    expect(source).toContain("tenant.training.sessions.at");
  });

  it("t() returns correct value for 'at' in English", () => {
    expect(t(en, "tenant.training.sessions.at")).toBe("at");
  });

  it("t() returns correct value for 'at' in Spanish", () => {
    const result = t(es, "tenant.training.sessions.at");
    expect(result).not.toBe("at");
    expect(result.length).toBeGreaterThan(0);
  });
});
