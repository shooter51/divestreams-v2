/**
 * DS-itzz: CSS custom property type extension
 *
 * Verifies that the CSS type declaration file exists and that no
 * @ts-expect-error suppressions remain for CSS custom properties.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../../..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

const FILES_WITH_CSS_CUSTOM_PROPS = [
  "app/routes/site/contact.tsx",
  "app/routes/site/register.tsx",
  "app/routes/site/courses/index.tsx",
  "app/routes/site/trips/index.tsx",
  "app/routes/site/equipment/index.tsx",
  "app/routes/site/equipment/$equipmentId.tsx",
];

describe("DS-itzz: CSS custom property types", () => {
  it("app/types/css.d.ts exists with CSSProperties extension", () => {
    const src = readFile("app/types/css.d.ts");
    expect(src).toContain("interface CSSProperties");
    expect(src).toContain("--${string}");
  });

  for (const file of FILES_WITH_CSS_CUSTOM_PROPS) {
    it(`${file} has no @ts-expect-error for CSS custom properties`, () => {
      const src = readFile(file);
      expect(src).not.toMatch(/@ts-expect-error.*CSS custom property/);
      expect(src).not.toMatch(/@ts-expect-error -- CSS custom property/);
    });
  }
});
