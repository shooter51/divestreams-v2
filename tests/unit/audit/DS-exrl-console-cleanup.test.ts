/**
 * DS-exrl: No console.log/error in specified production files
 *
 * Verifies that the 17 console statements in the listed files
 * have been replaced with structured logger calls.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../../..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

const CLEANED_FILES = [
  "app/routes/api/integrations/xero/callback.tsx",
  "app/routes/api/integrations/google/connect.tsx",
  "app/routes/api/integrations/google/sync.tsx",
  "app/routes/api/integrations/google/callback.tsx",
  "app/routes/api/integrations/quickbooks/connect.tsx",
  "app/routes/api/integrations/quickbooks/callback.tsx",
  "app/routes/api/integrations/mailchimp/callback.tsx",
  "app/routes/admin/plans.tsx",
  "app/routes/admin/index.tsx",
  "app/routes/embed/$tenant.courses.$courseId.enroll.tsx",
  "app/routes/embed/$tenant.book.tsx",
  "app/routes/tenant/pos.tsx",
  "app/components/BarcodeScanner.tsx",
  "app/components/BarcodeScannerModal.tsx",
  "app/components/pos/CheckoutModals.tsx",
  "app/components/settings/PasswordDisplayModal.tsx",
];

describe("DS-exrl: console.log/error removed from production files", () => {
  for (const file of CLEANED_FILES) {
    it(`${file} has no console.log or console.error`, () => {
      const src = readFile(file);
      expect(src).not.toMatch(/console\.(log|error)\(/);
    });
  }

  it("integration files use integrationLogger", () => {
    const xeroCallback = readFile("app/routes/api/integrations/xero/callback.tsx");
    expect(xeroCallback).toContain("integrationLogger");

    const googleConnect = readFile("app/routes/api/integrations/google/connect.tsx");
    expect(googleConnect).toContain("integrationLogger");
  });

  it("admin files use structured logger", () => {
    const plans = readFile("app/routes/admin/plans.tsx");
    expect(plans).toContain("logger.error");

    const index = readFile("app/routes/admin/index.tsx");
    expect(index).toContain("logger.error");
  });
});
