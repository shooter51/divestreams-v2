import { describe, it, expect } from "vitest";
import en from "../../../../../../app/i18n/locales/en.json";
import es from "../../../../../../app/i18n/locales/es.json";

const enRecord = en as Record<string, string>;
const esRecord = es as Record<string, string>;

describe("Trip i18n keys", () => {
  const requiredKeys = [
    // Trip type badges (DS-kx1e)
    "site.trips.type.singleDive",
    "site.trips.type.multiDive",
    "site.trips.type.course",
    "site.trips.type.snorkel",
    "site.trips.type.nightDive",
    "site.trips.type.diveTrip",
    // Trip detail strings (DS-u34g)
    "site.trips.detail.hours",
    "site.trips.detail.minutes",
    "site.trips.detail.divers",
    "site.trips.detail.booked",
    "site.trips.detail.difficulty.beginner",
    "site.trips.detail.difficulty.intermediate",
    "site.trips.detail.difficulty.advanced",
    "site.trips.detail.maxDepth",
    "site.trips.detail.highlights",
    "site.trips.detail.orEquivalent",
    "site.trips.detail.yearsOld",
  ];

  requiredKeys.forEach((key) => {
    it(`should have key "${key}" in en.json`, () => {
      expect(enRecord[key]).toBeDefined();
    });
    it(`should have key "${key}" in es.json`, () => {
      expect(esRecord[key]).toBeDefined();
    });
  });

  // Login error keys (DS-m0z2)
  const loginErrorKeys = [
    "auth.login.invalidCredentials",
    "auth.login.invalidFormSubmission",
    "auth.login.tooManyAttempts",
    "auth.login.mustBeLoggedIn",
    "auth.login.unableToDetermineOrg",
    "auth.login.orgNotFound",
    "auth.login.joinFailed",
    "auth.login.invalidEmail",
    "auth.login.passwordRequired",
    "auth.login.genericError",
  ];

  loginErrorKeys.forEach((key) => {
    it(`should have login error key "${key}" in en.json`, () => {
      expect(enRecord[key]).toBeDefined();
    });
    it(`should have login error key "${key}" in es.json`, () => {
      expect(esRecord[key]).toBeDefined();
    });
  });

  it("should have Spanish translations that differ from English", () => {
    const spotCheckKeys = [
      "site.trips.type.singleDive",
      "site.trips.detail.divers",
      "site.trips.detail.booked",
      "auth.login.invalidCredentials",
    ];
    for (const key of spotCheckKeys) {
      expect(esRecord[key]).not.toEqual(enRecord[key]);
    }
  });

  it("should have interpolation params in both languages for parameterized keys", () => {
    const paramKeys = {
      "site.trips.detail.hours": ["count"],
      "site.trips.detail.divers": ["min", "max"],
      "site.trips.detail.booked": ["booked", "total"],
      "site.trips.detail.maxDepth": ["depth"],
      "site.trips.detail.highlights": ["items"],
      "site.trips.detail.yearsOld": ["age"],
      "site.trips.detail.orEquivalent": ["level"],
    };

    for (const [key, params] of Object.entries(paramKeys)) {
      for (const param of params) {
        expect(enRecord[key]).toContain(`{{${param}}}`);
        expect(esRecord[key]).toContain(`{{${param}}}`);
      }
    }
  });
});
