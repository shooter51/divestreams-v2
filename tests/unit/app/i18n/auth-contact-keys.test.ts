import { describe, it, expect } from "vitest";
import en from "../../../../app/i18n/locales/en.json";
import es from "../../../../app/i18n/locales/es.json";

/**
 * Verifies that all i18n keys added for auth, registration, and contact
 * route i18n fixes exist in both en.json and es.json.
 */

const enRecord = en as Record<string, string>;
const esRecord = es as Record<string, string>;

describe("Forgot password i18n keys", () => {
  const keys = [
    "auth.forgotPassword.invalidForm",
    "auth.forgotPassword.emailRequired",
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

describe("Reset password i18n keys", () => {
  const keys = [
    "auth.resetPassword.tooManyAttempts",
    "auth.resetPassword.passwordMinLength",
    "auth.resetPassword.passwordsDoNotMatch",
    "auth.resetPassword.invalidToken",
    "auth.resetPassword.invalidOrExpiredToken",
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

describe("Registration i18n keys", () => {
  const keys = [
    "auth.register.firstNameRequired",
    "auth.register.firstNameTooLong",
    "auth.register.lastNameRequired",
    "auth.register.lastNameTooLong",
    "auth.register.invalidEmail",
    "auth.register.emailTooLong",
    "auth.register.invalidPhone",
    "auth.register.phoneTooLong",
    "auth.register.passwordRequired",
    "auth.register.confirmPasswordRequired",
    "auth.register.passwordsDoNotMatch",
    "auth.register.acceptTerms",
    "auth.register.emailTaken",
    "auth.register.registrationFailed",
    "auth.register.tooManyAttempts",
    "auth.register.noOrganization",
    "auth.register.orgNotFound",
    "auth.register.invalidCsrf",
    "auth.hidePassword",
    "auth.showPassword",
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

describe("Contact form i18n keys", () => {
  const keys = [
    "site.contact.nameMinLength",
    "site.contact.invalidEmail",
    "site.contact.messageMinLength",
    "site.contact.messageTooLong",
    "site.contact.invalidPhone",
    "site.contact.tooManySubmissions",
    "site.contact.processingError",
    "site.contact.sendFailed",
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
