/**
 * DS-aht1: Skip-to-content navigation link
 *
 * Verifies that root.tsx has an accessible skip-to-content link
 * that is visually hidden but visible on focus.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../../..");

describe("DS-aht1: skip-to-content link in root.tsx", () => {
  it("root.tsx has a skip-to-content link targeting #main-content", () => {
    const src = fs.readFileSync(path.join(ROOT, "app/root.tsx"), "utf-8");
    expect(src).toMatch(/<a\s[^>]*href="#main-content"/);
  });

  it("skip link is visually hidden with sr-only class", () => {
    const src = fs.readFileSync(path.join(ROOT, "app/root.tsx"), "utf-8");
    expect(src).toMatch(/className="[^"]*sr-only/);
  });

  it("skip link becomes visible on focus", () => {
    const src = fs.readFileSync(path.join(ROOT, "app/root.tsx"), "utf-8");
    expect(src).toMatch(/focus:not-sr-only/);
  });

  it("main content area has id='main-content'", () => {
    const src = fs.readFileSync(path.join(ROOT, "app/root.tsx"), "utf-8");
    expect(src).toMatch(/id="main-content"/);
  });
});
