import { describe, it, expect } from "vitest";
import { CSRF_FIELD_NAME } from "../../../../lib/security/csrf-constants";

describe("csrf-constants", () => {
  describe("CSRF_FIELD_NAME", () => {
    it("is defined as _csrf", () => {
      expect(CSRF_FIELD_NAME).toBe("_csrf");
    });

    it("is a string", () => {
      expect(typeof CSRF_FIELD_NAME).toBe("string");
    });

    it("is a valid HTML form field name", () => {
      expect(CSRF_FIELD_NAME).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/);
    });
  });
});
