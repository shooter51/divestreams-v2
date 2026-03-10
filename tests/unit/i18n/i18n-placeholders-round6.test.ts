import { describe, it, expect } from "vitest";
import { getTranslations } from "../../../app/i18n/index";

/**
 * Verifies that all i18n keys added in the placeholders round 6 fix
 * exist in both English and Spanish locale files.
 */
describe("i18n placeholders round 6 - all new keys exist in both locales", () => {
  const en = getTranslations("en");
  const es = getTranslations("es");

  const newKeys = [
    // Customers
    "tenant.customers.subjectPlaceholder",
    "tenant.customers.messagePlaceholder",

    // Discounts
    "tenant.discounts.percentagePlaceholder",
    "tenant.discounts.fixedPlaceholder",

    // Team settings
    "tenant.settings.team.emailPlaceholder",

    // Training levels
    "tenant.settings.training.levels.namePlaceholder",
    "tenant.settings.training.levels.codePlaceholder",
    "tenant.settings.training.levels.levelOrderPlaceholder",
    "tenant.settings.training.levels.prerequisitesPlaceholder",
    "tenant.settings.training.levels.minAgePlaceholder",
    "tenant.settings.training.levels.minDivesPlaceholder",

    // Training agencies
    "tenant.settings.training.agencies.namePlaceholder",
    "tenant.settings.training.agencies.codePlaceholder",
    "tenant.settings.training.agencies.websitePlaceholder",

    // Public site pages editor
    "tenant.settings.publicSite.pages.metaTitlePlaceholder",
    "tenant.settings.publicSite.pages.metaDescriptionPlaceholder",
    "tenant.settings.publicSite.pages.changeDescriptionPlaceholder",

    // Public site content
    "tenant.settings.publicSite.content.logoUrlPlaceholder",
    "tenant.settings.publicSite.content.heroImagePlaceholder",
    "tenant.settings.publicSite.content.heroVideoPlaceholder",
    "tenant.settings.publicSite.content.aboutPlaceholder",
    "tenant.settings.publicSite.content.addressPlaceholder",
    "tenant.settings.publicSite.content.phonePlaceholder",
    "tenant.settings.publicSite.content.emailPlaceholder",
    "tenant.settings.publicSite.content.hoursPlaceholder",
    "tenant.settings.publicSite.content.mapEmbedPlaceholder",

    // Public site team
    "tenant.settings.publicSite.team.namePlaceholder",
    "tenant.settings.publicSite.team.rolePlaceholder",

    // Profile
    "tenant.settings.profile.taxPlaceholder",

    // Public site appearance
    "tenant.settings.publicSite.appearance.heroImagePlaceholder",
    "tenant.settings.publicSite.appearance.primaryColorPlaceholder",
    "tenant.settings.publicSite.appearance.secondaryColorPlaceholder",

    // Public site general
    "tenant.settings.publicSite.general.customDomainPlaceholder",

    // ResetPasswordModal aria-labels
    "components.resetPasswordModal.cancelAriaLabel",
    "components.resetPasswordModal.resettingAriaLabel",
    "components.resetPasswordModal.resetAriaLabel",

    // Toast aria-label
    "components.toast.dismissAriaLabel",
  ];

  it.each(newKeys)("key '%s' exists in English locale", (key) => {
    expect(en[key]).toBeDefined();
    expect(en[key]).not.toBe("");
  });

  it.each(newKeys)("key '%s' exists in Spanish locale", (key) => {
    expect(es[key]).toBeDefined();
    expect(es[key]).not.toBe("");
  });

  it("English and Spanish have different values for translatable keys", () => {
    // These keys should have different translations (not URLs or technical placeholders)
    const translatableKeys = [
      "tenant.customers.subjectPlaceholder",
      "tenant.customers.messagePlaceholder",
      "tenant.settings.publicSite.pages.metaTitlePlaceholder",
      "tenant.settings.publicSite.pages.metaDescriptionPlaceholder",
      "tenant.settings.publicSite.pages.changeDescriptionPlaceholder",
      "tenant.settings.publicSite.content.aboutPlaceholder",
      "tenant.settings.publicSite.team.namePlaceholder",
      "tenant.settings.publicSite.team.rolePlaceholder",
      "tenant.settings.profile.taxPlaceholder",
      "components.resetPasswordModal.cancelAriaLabel",
      "components.resetPasswordModal.resettingAriaLabel",
      "components.resetPasswordModal.resetAriaLabel",
      "components.toast.dismissAriaLabel",
    ];

    for (const key of translatableKeys) {
      expect(en[key]).not.toBe(es[key]);
    }
  });
});
