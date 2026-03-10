/**
 * Tests for i18n display bugs:
 * DS-oruc: Equipment rental available count shows double parentheses
 * DS-hj4h: Dashboard usage summary labels not translated
 * DS-qh56: Dates not localized to Spanish on trips and training pages
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

function readSource(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

// ============================================================================
// DS-oruc: Double parentheses in equipment rental available count
// ============================================================================

describe("DS-oruc: Equipment rental available count translation", () => {
  it("translation key 'tenant.bookings.availableCount' contains parentheses in en.json", () => {
    const en = JSON.parse(readSource("app/i18n/locales/en.json")) as Record<string, string>;
    const value = en["tenant.bookings.availableCount"];
    expect(value).toMatch(/^\(/); // starts with (
    expect(value).toMatch(/\)$/); // ends with )
  });

  it("translation key 'tenant.bookings.availableCount' contains parentheses in es.json", () => {
    const es = JSON.parse(readSource("app/i18n/locales/es.json")) as Record<string, string>;
    const value = es["tenant.bookings.availableCount"];
    expect(value).toMatch(/^\(/); // starts with (
    expect(value).toMatch(/\)$/); // ends with )
  });

  it("edit booking JSX does not wrap the i18n value in extra parentheses", () => {
    const source = readSource("app/routes/tenant/bookings/$id/edit.tsx");
    // The JSX should NOT have a literal '(' immediately before the t() call for availableCount
    expect(source).not.toMatch(/\(\s*\{t\("tenant\.bookings\.availableCount"/);
  });

  it("new booking JSX does not wrap the i18n value in extra parentheses", () => {
    const source = readSource("app/routes/tenant/bookings/new.tsx");
    expect(source).not.toMatch(/\(\s*\{t\("tenant\.bookings\.availableCount"/);
  });
});

// ============================================================================
// DS-hj4h: Dashboard upgrade modal labels not translated
// ============================================================================

describe("DS-hj4h: Dashboard UpgradeModal uses i18n for limit labels", () => {
  it("dashboard.tsx does not contain hardcoded 'team members' string in limitLabels", () => {
    const source = readSource("app/routes/tenant/dashboard.tsx");
    expect(source).not.toMatch(/users:\s*["']team members["']/);
  });

  it("dashboard.tsx does not contain hardcoded 'tours this month' string in limitLabels", () => {
    const source = readSource("app/routes/tenant/dashboard.tsx");
    expect(source).not.toMatch(/toursPerMonth:\s*["']tours this month["']/);
  });

  it("dashboard upgrade title uses i18n key tenant.dashboard.upgrade.limitReachedTitle", () => {
    const source = readSource("app/routes/tenant/dashboard.tsx");
    expect(source).toContain("tenant.dashboard.upgrade.limitReachedTitle");
  });

  it("dashboard upgrade description uses i18n key tenant.dashboard.upgrade.limitReachedDescription", () => {
    const source = readSource("app/routes/tenant/dashboard.tsx");
    expect(source).toContain("tenant.dashboard.upgrade.limitReachedDescription");
  });

  it("en.json has tenant.dashboard.limits.users key", () => {
    const en = JSON.parse(readSource("app/i18n/locales/en.json")) as Record<string, string>;
    expect(en["tenant.dashboard.limits.users"]).toBeTruthy();
  });

  it("en.json has tenant.dashboard.limits.toursPerMonth key", () => {
    const en = JSON.parse(readSource("app/i18n/locales/en.json")) as Record<string, string>;
    expect(en["tenant.dashboard.limits.toursPerMonth"]).toBeTruthy();
  });

  it("es.json has tenant.dashboard.limits.users key", () => {
    const es = JSON.parse(readSource("app/i18n/locales/es.json")) as Record<string, string>;
    expect(es["tenant.dashboard.limits.users"]).toBeTruthy();
  });
});

// ============================================================================
// DS-qh56: Dates not localized — site routes use hardcoded "en-US"
// ============================================================================

describe("DS-qh56: Date localization — hardcoded en-US removed from source files", () => {
  it("site/trips/$tripId.tsx does not use toLocaleDateString with hardcoded en-US in formatDate function", () => {
    const source = readSource("app/routes/site/trips/$tripId.tsx");
    expect(source).not.toMatch(/function formatDate[\s\S]{0,300}?toLocaleDateString\("en-US"/);
  });

  it("site/trips/index.tsx does not use toLocaleDateString with hardcoded en-US in formatDate function", () => {
    const source = readSource("app/routes/site/trips/index.tsx");
    expect(source).not.toMatch(/function formatDate[\s\S]{0,300}?toLocaleDateString\("en-US"/);
  });

  it("site/courses/$courseId.tsx does not use toLocaleDateString with hardcoded en-US in formatDate function", () => {
    const source = readSource("app/routes/site/courses/$courseId.tsx");
    expect(source).not.toMatch(/function formatDate[\s\S]{0,300}?toLocaleDateString\("en-US"/);
  });

  it("site/trips/$tripId.tsx uses useFormat hook", () => {
    const source = readSource("app/routes/site/trips/$tripId.tsx");
    expect(source).toContain("useFormat");
  });

  it("site/trips/index.tsx uses useFormat hook", () => {
    const source = readSource("app/routes/site/trips/index.tsx");
    expect(source).toContain("useFormat");
  });

  it("site/courses/$courseId.tsx uses useFormat hook", () => {
    const source = readSource("app/routes/site/courses/$courseId.tsx");
    expect(source).toContain("useFormat");
  });

  it("app/lib/format.ts formatDisplayDate varies output by locale", async () => {
    const { formatDisplayDate } = await import("../../../../app/lib/format");
    const resultEn = formatDisplayDate("2026-01-15", "en-US");
    const resultEs = formatDisplayDate("2026-01-15", "es");
    expect(resultEn).toBeTruthy();
    expect(resultEs).toBeTruthy();
    // Spanish and English formatting should differ
    expect(resultEn).not.toBe(resultEs);
  });
});
