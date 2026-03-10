import { describe, it, expect } from "vitest";
import en from "../../../../app/i18n/locales/en.json";
import es from "../../../../app/i18n/locales/es.json";

/**
 * Verifies that all i18n keys added for DS-9d63, DS-szjz, DS-h60i, DS-wap2
 * exist in both en.json and es.json.
 */

const enRecord = en as Record<string, string>;
const esRecord = es as Record<string, string>;

describe("Equipment i18n keys (DS-9d63)", () => {
  const categoryKeys = [
    "site.equipment.category.bcd",
    "site.equipment.category.regulator",
    "site.equipment.category.wetsuit",
    "site.equipment.category.mask",
    "site.equipment.category.fins",
    "site.equipment.category.computer",
    "site.equipment.category.tank",
    "site.equipment.category.snorkel",
    "site.equipment.category.camera",
    "site.equipment.category.light",
    "site.equipment.category.other",
  ];

  const conditionKeys = [
    "site.equipment.condition.new",
    "site.equipment.condition.excellent",
    "site.equipment.condition.good",
    "site.equipment.condition.fair",
  ];

  const otherKeys = [
    "site.equipment.sizeLabel",
    "site.equipment.categoryFilter",
    "site.equipment.searchFilter",
  ];

  const allKeys = [...categoryKeys, ...conditionKeys, ...otherKeys];

  allKeys.forEach((key) => {
    it(`should have "${key}" in en.json`, () => {
      expect(enRecord[key]).toBeDefined();
      expect(enRecord[key].length).toBeGreaterThan(0);
    });

    it(`should have "${key}" in es.json`, () => {
      expect(esRecord[key]).toBeDefined();
      expect(esRecord[key].length).toBeGreaterThan(0);
    });
  });
});

describe("Course level/duration i18n keys (DS-szjz)", () => {
  const keys = [
    "site.courses.level.beginner",
    "site.courses.level.openWater",
    "site.courses.level.advanced",
    "site.courses.level.specialty",
    "site.courses.level.professional",
    "site.courses.duration.day",
    "site.courses.duration.days",
    "site.courses.contactToSchedule",
  ];

  keys.forEach((key) => {
    it(`should have "${key}" in en.json`, () => {
      expect(enRecord[key]).toBeDefined();
      expect(enRecord[key].length).toBeGreaterThan(0);
    });

    it(`should have "${key}" in es.json`, () => {
      expect(esRecord[key]).toBeDefined();
      expect(esRecord[key].length).toBeGreaterThan(0);
    });
  });
});

describe("Gallery i18n keys (DS-h60i)", () => {
  const keys = [
    "site.gallery.showingPhotos",
    "site.gallery.showingPhoto",
    "site.gallery.photoCount",
    "site.gallery.photoCountSingular",
  ];

  keys.forEach((key) => {
    it(`should have "${key}" in en.json`, () => {
      expect(enRecord[key]).toBeDefined();
      expect(enRecord[key].length).toBeGreaterThan(0);
    });

    it(`should have "${key}" in es.json`, () => {
      expect(esRecord[key]).toBeDefined();
      expect(esRecord[key].length).toBeGreaterThan(0);
    });
  });
});

describe("Courses showingXofY uses 'courses' not 'sessions' (DS-wap2)", () => {
  it("en.json showingXofY should say 'courses' not 'sessions'", () => {
    expect(enRecord["site.courses.showingXofY"]).toContain("courses");
    expect(enRecord["site.courses.showingXofY"]).not.toContain("sessions");
  });

  it("es.json showingXofY should say 'cursos' not 'sesiones'", () => {
    expect(esRecord["site.courses.showingXofY"]).toContain("cursos");
    expect(esRecord["site.courses.showingXofY"]).not.toContain("sesiones");
  });
});

describe("Courses loader shows all courses (DS-wap2)", () => {
  it("extractActiveAgencies should handle courses without agencyName", async () => {
    const { extractActiveAgencies } = await import(
      "../../../../app/routes/site/courses/index"
    );
    const result = extractActiveAgencies([
      { agencyName: "PADI" },
      { agencyName: null },
      { agencyName: "SSI" },
    ]);
    expect(result).toEqual(["PADI", "SSI"]);
  });
});
