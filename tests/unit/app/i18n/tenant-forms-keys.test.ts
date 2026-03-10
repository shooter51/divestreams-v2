import { describe, it, expect } from "vitest";
import en from "../../../../app/i18n/locales/en.json";
import es from "../../../../app/i18n/locales/es.json";

/**
 * Verifies that all i18n keys added for the i18n QA round 5 (tenant form hardcoded strings)
 * exist in both en.json and es.json.
 */

const enRecord = en as Record<string, string>;
const esRecord = es as Record<string, string>;

describe("Boat amenity i18n keys", () => {
  const keys = [
    "tenant.boats.amenity.divePlatform",
    "tenant.boats.amenity.sunDeck",
    "tenant.boats.amenity.toilet",
    "tenant.boats.amenity.freshwaterShower",
    "tenant.boats.amenity.cameraStation",
    "tenant.boats.amenity.storageLockers",
    "tenant.boats.amenity.shadeCover",
    "tenant.boats.amenity.firstAidKit",
    "tenant.boats.amenity.soundSystem",
    "tenant.boats.amenity.bbqGrill",
  ];

  it.each(keys)("en.json has key '%s'", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key '%s'", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("Boat type i18n keys", () => {
  const keys = [
    "tenant.boats.type.diveBoat",
    "tenant.boats.type.speedBoat",
    "tenant.boats.type.catamaran",
    "tenant.boats.type.yacht",
    "tenant.boats.type.rib",
    "tenant.boats.type.other",
    "tenant.boats.registrationPlaceholder",
  ];

  it.each(keys)("en.json has key '%s'", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key '%s'", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("Trip recurrence and day i18n keys", () => {
  const keys = [
    "tenant.trips.recurrencePattern.daily",
    "tenant.trips.recurrencePattern.weekly",
    "tenant.trips.recurrencePattern.biweekly",
    "tenant.trips.recurrencePattern.monthly",
    "tenant.trips.day.sun",
    "tenant.trips.day.mon",
    "tenant.trips.day.tue",
    "tenant.trips.day.wed",
    "tenant.trips.day.thu",
    "tenant.trips.day.fri",
    "tenant.trips.day.sat",
    "tenant.trips.weatherPlaceholder",
    "tenant.trips.weatherConditionsPlaceholder",
    "tenant.trips.notesStaffOnlyPlaceholder",
  ];

  it.each(keys)("en.json has key '%s'", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key '%s'", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("Tour placeholder i18n keys", () => {
  const keys = [
    "tenant.tours.minAgePlaceholder",
  ];

  it.each(keys)("en.json has key '%s'", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key '%s'", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("Dive site i18n keys", () => {
  const keys = [
    "tenant.diveSites.conditionsPlaceholder",
    "tenant.diveSites.highlightsPlaceholder",
    "tenant.diveSites.highlightsEditPlaceholder",
    "tenant.diveSites.visibilityPlaceholder",
    "tenant.diveSites.difficulty.beginner",
    "tenant.diveSites.difficulty.intermediate",
    "tenant.diveSites.difficulty.advanced",
    "tenant.diveSites.difficulty.expert",
    "tenant.diveSites.currentStrength.select",
    "tenant.diveSites.currentStrength.none",
    "tenant.diveSites.currentStrength.mild",
    "tenant.diveSites.currentStrength.moderate",
    "tenant.diveSites.currentStrength.strong",
  ];

  it.each(keys)("en.json has key '%s'", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key '%s'", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("Equipment placeholder i18n keys", () => {
  const keys = [
    "tenant.equipment.namePlaceholder",
    "tenant.equipment.brandPlaceholder",
    "tenant.equipment.modelPlaceholder",
    "tenant.equipment.sizePlaceholder",
  ];

  it.each(keys)("en.json has key '%s'", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key '%s'", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("Customer placeholder i18n keys", () => {
  const keys = [
    "tenant.customers.emergencyRelationPlaceholderEdit",
  ];

  it.each(keys)("en.json has key '%s'", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key '%s'", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("Spanish translations are not identical to English", () => {
  const keysToCheck = [
    "tenant.boats.amenity.divePlatform",
    "tenant.boats.amenity.toilet",
    "tenant.boats.type.diveBoat",
    "tenant.trips.recurrencePattern.daily",
    "tenant.trips.day.sun",
    "tenant.diveSites.conditionsPlaceholder",
    "tenant.diveSites.currentStrength.none",
    "tenant.diveSites.currentStrength.mild",
  ];

  it.each(keysToCheck)("es.json value for '%s' differs from en.json", (key) => {
    expect(esRecord[key]).not.toEqual(enRecord[key]);
  });
});
