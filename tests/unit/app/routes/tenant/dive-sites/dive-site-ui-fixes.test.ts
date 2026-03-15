/**
 * Tests for dive site UI cosmetic fixes.
 *
 * DS-419m: Add dive site breadcrumb shows duplicate back arrow
 * DS-1n51: Add dive site form shows double asterisks on required fields
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "../../../../../../app/routes/tenant/dive-sites");

// ============================================================================
// DS-419m: No duplicate back arrow in dive site templates
// ============================================================================
describe("DS-419m: Dive site back link — no duplicate back arrow", () => {
  it("new.tsx: link text is only the translation key, no extra ← prefix", () => {
    const src = readFileSync(join(ROOT, "new.tsx"), "utf8");
    // Should NOT have "← {t(" pattern — the arrow lives inside the translation key
    expect(src).not.toMatch(/←\s*\{t\("tenant\.diveSites\.backToSites"\)/);
    // Should have just the translation call without leading arrow
    expect(src).toMatch(/\{t\("tenant\.diveSites\.backToSites"\)\}/);
  });

  it("$id.tsx: link text is only the translation key, no extra ← prefix", () => {
    const src = readFileSync(join(ROOT, "$id.tsx"), "utf8");
    expect(src).not.toMatch(/←\s*\{t\("tenant\.diveSites\.backToSites"\)/);
    expect(src).toMatch(/\{t\("tenant\.diveSites\.backToSites"\)\}/);
  });

  it("$id/edit.tsx: link text is only the translation key, no extra ← prefix", () => {
    const src = readFileSync(join(ROOT, "$id/edit.tsx"), "utf8");
    expect(src).not.toMatch(/←\s*\{t\("tenant\.diveSites\.backToSite"\)/);
    expect(src).toMatch(/\{t\("tenant\.diveSites\.backToSite"\)\}/);
  });

  it("en.json translation key already contains the arrow character", () => {
    const en = JSON.parse(
      readFileSync(
        join(__dirname, "../../../../../../app/i18n/locales/en.json"),
        "utf8"
      )
    ) as Record<string, string>;
    expect(en["tenant.diveSites.backToSites"]).toContain("←");
    expect(en["tenant.diveSites.backToSite"]).toContain("←");
  });
});

// ============================================================================
// DS-1n51: No double asterisks on required field labels
// ============================================================================
describe("DS-1n51: Dive site form — no double asterisks on required labels", () => {
  it("new.tsx: Site Name label has no trailing * after translation call", () => {
    const src = readFileSync(join(ROOT, "new.tsx"), "utf8");
    expect(src).not.toMatch(/\{t\("tenant\.diveSites\.siteName"\)\}\s*\*/);
  });

  it("new.tsx: Max Depth label has no trailing * after translation call", () => {
    const src = readFileSync(join(ROOT, "new.tsx"), "utf8");
    expect(src).not.toMatch(/\{t\("tenant\.diveSites\.maxDepthMeters"\)\}\s*\*/);
  });

  it("new.tsx: Difficulty Level label has no trailing * after translation call", () => {
    const src = readFileSync(join(ROOT, "new.tsx"), "utf8");
    expect(src).not.toMatch(/\{t\("tenant\.diveSites\.difficultyLevel"\)\}\s*\*/);
  });

  it("$id/edit.tsx: Site Name label has no trailing * after translation call", () => {
    const src = readFileSync(join(ROOT, "$id/edit.tsx"), "utf8");
    expect(src).not.toMatch(/\{t\("tenant\.diveSites\.siteName"\)\}\s*\*/);
  });

  it("$id/edit.tsx: Max Depth label has no trailing * after translation call", () => {
    const src = readFileSync(join(ROOT, "$id/edit.tsx"), "utf8");
    expect(src).not.toMatch(/\{t\("tenant\.diveSites\.maxDepthMeters"\)\}\s*\*/);
  });

  it("$id/edit.tsx: Difficulty Level label has no trailing * after translation call", () => {
    const src = readFileSync(join(ROOT, "$id/edit.tsx"), "utf8");
    expect(src).not.toMatch(/\{t\("tenant\.diveSites\.difficultyLevel"\)\}\s*\*/);
  });

  it("en.json translation keys already contain the asterisk", () => {
    const en = JSON.parse(
      readFileSync(
        join(__dirname, "../../../../../../app/i18n/locales/en.json"),
        "utf8"
      )
    ) as Record<string, string>;
    expect(en["tenant.diveSites.siteName"]).toContain("*");
    expect(en["tenant.diveSites.maxDepthMeters"]).toContain("*");
    expect(en["tenant.diveSites.difficultyLevel"]).toContain("*");
  });
});
