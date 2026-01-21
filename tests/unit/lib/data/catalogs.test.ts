import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Agency Course Catalogs", () => {
  const catalogDir = join(process.cwd(), "lib", "data", "catalogs");

  it("should have PADI catalog", () => {
    const path = join(catalogDir, "padi-courses.json");
    expect(existsSync(path)).toBe(true);
  });

  it("should have valid JSON structure for PADI", () => {
    const path = join(catalogDir, "padi-courses.json");
    const content = readFileSync(path, "utf-8");
    const catalog = JSON.parse(content);

    expect(Array.isArray(catalog.courses)).toBe(true);
    expect(catalog.agency).toBe("padi");
    expect(catalog.version).toBeDefined();
  });

  it("should have valid course structure", () => {
    const path = join(catalogDir, "padi-courses.json");
    const content = readFileSync(path, "utf-8");
    const catalog = JSON.parse(content);

    const firstCourse = catalog.courses[0];
    expect(firstCourse).toHaveProperty("name");
    expect(firstCourse).toHaveProperty("code");
    expect(firstCourse).toHaveProperty("levelCode");
    expect(firstCourse).toHaveProperty("durationDays");
  });
});
