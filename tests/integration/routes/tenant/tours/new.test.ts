/**
 * Tours New Route Tests
 *
 * Validates that the route module exports the expected loader, action, meta, and default component.
 */

import { describe, it, expect } from "vitest";
import * as newTour from "../../../../../app/routes/tenant/tours/new";

describe("Tours New Route", () => {
  it("exports a default component", () => {
    expect(newTour.default).toBeDefined();
    expect(typeof newTour.default).toBe("function");
  });

  it("exports a loader function", () => {
    expect(newTour.loader).toBeDefined();
    expect(typeof newTour.loader).toBe("function");
  });

  it("exports an action function", () => {
    expect(newTour.action).toBeDefined();
    expect(typeof newTour.action).toBe("function");
  });

  it("exports a meta function", () => {
    expect(newTour.meta).toBeDefined();
    expect(typeof newTour.meta).toBe("function");
  });
});
