import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("Tenant Layout - Training Navigation", () => {
  it("includes Training in navigation items", () => {
    const layoutContent = readFileSync(
      "app/routes/tenant/layout.tsx",
      "utf-8"
    );
    expect(layoutContent).toContain('"/app/training"');
    expect(layoutContent).toContain('"Training"');
  });
});
