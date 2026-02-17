import { describe, it, expect } from "vitest";
import { classifyTestFailure } from "./rules.js";

describe("Gate Severity Rules", () => {
  // --- Critical tests ---

  it("classifies auth tests as critical", () => {
    expect(classifyTestFailure("should require authentication")).toBe("critical");
    expect(classifyTestFailure("login flow validates credentials")).toBe("critical");
    expect(classifyTestFailure("session management")).toBe("critical");
  });

  it("classifies payment tests as critical", () => {
    expect(classifyTestFailure("stripe checkout creates subscription")).toBe("critical");
    expect(classifyTestFailure("billing page shows invoices")).toBe("critical");
  });

  it("classifies database/migration tests as critical", () => {
    expect(classifyTestFailure("migration applies constraint")).toBe("critical");
    expect(classifyTestFailure("schema validation")).toBe("critical");
  });

  it("classifies security tests as critical", () => {
    expect(classifyTestFailure("CSRF token validation")).toBe("critical");
    expect(classifyTestFailure("XSS sanitization")).toBe("critical");
    expect(classifyTestFailure("SQL injection prevention")).toBe("critical");
  });

  it("classifies booking tests as critical", () => {
    expect(classifyTestFailure("booking.create saves to database")).toBe("critical");
    expect(classifyTestFailure("booking.cancel refunds customer")).toBe("critical");
  });

  it("classifies multi-tenancy tests as critical", () => {
    expect(classifyTestFailure("tenant isolation prevents cross-access")).toBe("critical");
    expect(classifyTestFailure("organization data filter")).toBe("critical");
  });

  // --- Non-critical tests ---

  it("classifies snapshot tests as non-critical", () => {
    expect(classifyTestFailure("dashboard snapshot matches")).toBe("non_critical");
    expect(classifyTestFailure("visual regression test")).toBe("non_critical");
  });

  it("classifies accessibility tests as non-critical", () => {
    expect(classifyTestFailure("button has aria-label")).toBe("non_critical");
    expect(classifyTestFailure("a11y checks pass")).toBe("non_critical");
  });

  it("classifies theme tests as non-critical", () => {
    expect(classifyTestFailure("dark mode toggle")).toBe("non_critical");
    expect(classifyTestFailure("color scheme switches")).toBe("non_critical");
  });

  it("classifies tooltip/animation tests as non-critical", () => {
    expect(classifyTestFailure("tooltip appears on hover")).toBe("non_critical");
    expect(classifyTestFailure("animation completes smoothly")).toBe("non_critical");
  });

  // --- Default behavior ---

  it("defaults to critical for unmatched test names", () => {
    expect(classifyTestFailure("some random test")).toBe("critical");
    expect(classifyTestFailure("data processing pipeline")).toBe("critical");
  });
});
