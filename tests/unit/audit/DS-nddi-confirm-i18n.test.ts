/**
 * DS-nddi: Confirm dialog strings use i18n translation keys
 *
 * Verifies that confirm() calls in tenant routes use t() for their
 * strings instead of hardcoded English text.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../../..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("DS-nddi: confirm() calls use i18n translation keys", () => {
  it("settings/index.tsx uses t() for account deletion confirm", () => {
    const src = readFile("app/routes/tenant/settings/index.tsx");
    expect(src).not.toMatch(/confirm\(".*WARNING.*"\)/);
    expect(src).toMatch(/confirm\(t\("tenant\.settings\.confirmDeleteAccount"\)\)/);
  });

  it("settings/team.tsx uses t() for remove member confirm", () => {
    const src = readFile("app/routes/tenant/settings/team.tsx");
    expect(src).not.toMatch(/confirm\(`Are you sure you want to remove \$\{/);
    expect(src).toMatch(/t\("tenant\.settings\.team\.confirmRemoveMember"/);
  });

  it("settings/training/levels.tsx uses t() for delete level confirm", () => {
    const src = readFile("app/routes/tenant/settings/training/levels.tsx");
    expect(src).not.toMatch(/confirm\(`Are you sure you want to delete "\$\{level/);
    expect(src).toMatch(/t\("tenant\.settings\.training\.levels\.confirmDelete"/);
  });

  it("settings/training/agencies.tsx uses t() for delete agency confirm", () => {
    const src = readFile("app/routes/tenant/settings/training/agencies.tsx");
    expect(src).not.toMatch(/confirm\(`Are you sure you want to delete "\$\{agency/);
    expect(src).toMatch(/t\("tenant\.settings\.training\.agencies\.confirmDelete"/);
  });

  it("training/courses/$id.tsx uses t() for delete course confirm", () => {
    const src = readFile("app/routes/tenant/training/courses/$id.tsx");
    expect(src).not.toMatch(/confirm\(\s*"Are you sure you want to delete this course/);
    expect(src).toMatch(/t\("tenant\.training\.courses\.confirmDelete"\)/);
  });

  it("settings/billing.tsx uses t() for cancel subscription confirm", () => {
    const src = readFile("app/routes/tenant/settings/billing.tsx");
    expect(src).not.toMatch(/confirm\("Are you sure you want to cancel your subscription\?"\)/);
    expect(src).toMatch(/t\("tenant\.settings\.billing\.confirmCancelSubscription"\)/);
  });

  it("settings/integrations.tsx uses t() for disconnect integration confirm", () => {
    const src = readFile("app/routes/tenant/settings/integrations.tsx");
    expect(src).not.toMatch(/confirm\(`Are you sure you want to disconnect \$\{/);
    expect(src).toMatch(/t\("tenant\.settings\.integrations\.confirmDisconnect"/);
  });

  it("products.tsx uses t() for delete product confirm", () => {
    const src = readFile("app/routes/tenant/products.tsx");
    expect(src).not.toMatch(/confirm\("Delete this product\?"\)/);
    expect(src).toMatch(/t\("tenant\.pos\.products\.confirmDelete"\)/);
  });

  it("all 8 confirm translation keys exist in en.json", () => {
    const en = readFile("app/i18n/locales/en.json");
    const json = JSON.parse(en);

    expect(json).toHaveProperty("tenant.settings.confirmDeleteAccount");
    expect(json).toHaveProperty("tenant.settings.team.confirmRemoveMember");
    expect(json).toHaveProperty("tenant.settings.training.levels.confirmDelete");
    expect(json).toHaveProperty("tenant.settings.training.agencies.confirmDelete");
    expect(json).toHaveProperty("tenant.training.courses.confirmDelete");
    expect(json).toHaveProperty("tenant.settings.billing.confirmCancelSubscription");
    expect(json).toHaveProperty("tenant.settings.integrations.confirmDisconnect");
    expect(json).toHaveProperty("tenant.pos.products.confirmDelete");
  });

  it("all 8 confirm translation keys exist in es.json", () => {
    const es = readFile("app/i18n/locales/es.json");
    const json = JSON.parse(es);

    expect(json).toHaveProperty("tenant.settings.confirmDeleteAccount");
    expect(json).toHaveProperty("tenant.settings.team.confirmRemoveMember");
    expect(json).toHaveProperty("tenant.settings.training.levels.confirmDelete");
    expect(json).toHaveProperty("tenant.settings.training.agencies.confirmDelete");
    expect(json).toHaveProperty("tenant.training.courses.confirmDelete");
    expect(json).toHaveProperty("tenant.settings.billing.confirmCancelSubscription");
    expect(json).toHaveProperty("tenant.settings.integrations.confirmDisconnect");
  });
});
