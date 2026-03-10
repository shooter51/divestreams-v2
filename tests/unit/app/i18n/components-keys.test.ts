import { describe, it, expect } from "vitest";
import en from "../../../../app/i18n/locales/en.json";
import es from "../../../../app/i18n/locales/es.json";

/**
 * Verifies that all i18n keys added for QA round 5 (component i18n fixes)
 * exist in both en.json and es.json.
 */

const enRecord = en as Record<string, string>;
const esRecord = es as Record<string, string>;

describe("UpgradePrompt i18n keys", () => {
  const keys = [
    "common.upgrade.unlockAccess",
    "common.upgrade.upgradeNow",
    "common.upgrade.upgrade",
    "common.upgrade.premiumFeature",
    "common.upgrade.upgradePlan",
    "common.upgrade.upgradeToPremium",
    "common.upgrade.limitReached",
    "common.upgrade.featureIsPremium",
  ];

  it.each(keys)("en.json has key: %s", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key: %s", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("BarcodeScanner i18n keys", () => {
  const keys = [
    "common.scanner.cameraAccessDenied",
    "common.scanner.cameraAccessMessage",
    "common.scanner.tryAgain",
    "common.scanner.scannerError",
    "common.scanner.startingCamera",
    "common.scanner.positionBarcode",
  ];

  it.each(keys)("en.json has key: %s", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key: %s", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("Cart i18n keys", () => {
  const keys = [
    "tenant.pos.cart.decreaseQuantity",
    "tenant.pos.cart.increaseQuantity",
    "tenant.pos.cart.removeItem",
  ];

  it.each(keys)("en.json has key: %s", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key: %s", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("TransactionActions i18n keys", () => {
  const keys = [
    "tenant.pos.transactions.viewReceipt",
    "tenant.pos.transactions.viewDetails",
    "tenant.pos.transactions.emailReceipt",
    "tenant.pos.transactions.noCustomerEmail",
    "tenant.pos.transactions.cannotRefundRefund",
    "tenant.pos.transactions.alreadyRefunded",
    "tenant.pos.transactions.refundTransaction",
  ];

  it.each(keys)("en.json has key: %s", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key: %s", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("ChangePasswordForm i18n keys", () => {
  const keys = [
    "tenant.settings.password.minLength",
    "tenant.settings.password.passwordsDoNotMatch",
    "tenant.settings.password.mustBeDifferent",
    "tenant.settings.password.changePassword",
    "tenant.settings.password.currentPassword",
    "tenant.settings.password.newPassword",
    "tenant.settings.password.minLengthHint",
    "tenant.settings.password.confirmNewPassword",
    "tenant.settings.password.changing",
    "common.cancel",
  ];

  it.each(keys)("en.json has key: %s", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key: %s", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});

describe("Gallery lightbox i18n keys", () => {
  const keys = [
    "site.gallery.closeLightbox",
    "site.gallery.previousImage",
    "site.gallery.nextImage",
  ];

  it.each(keys)("en.json has key: %s", (key) => {
    expect(enRecord[key]).toBeDefined();
    expect(enRecord[key].length).toBeGreaterThan(0);
  });

  it.each(keys)("es.json has key: %s", (key) => {
    expect(esRecord[key]).toBeDefined();
    expect(esRecord[key].length).toBeGreaterThan(0);
  });
});
