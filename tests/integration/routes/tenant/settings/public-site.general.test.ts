/**
 * Public Site General Settings Route Tests
 *
 * Validates that the route module exports the expected action and default component.
 */

import { describe, it, expect } from "vitest";
import * as publicSiteGeneral from "../../../../../app/routes/tenant/settings/public-site.general";

describe("Public Site General Settings Route", () => {
  it("exports a default component", () => {
    expect(publicSiteGeneral.default).toBeDefined();
    expect(typeof publicSiteGeneral.default).toBe("function");
  });

  it("exports an action function", () => {
    expect(publicSiteGeneral.action).toBeDefined();
    expect(typeof publicSiteGeneral.action).toBe("function");
  });
});
