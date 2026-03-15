/**
 * Zod validation for customer creation form action.
 *
 * TDD tests verifying that the customerSchema + validateFormData correctly
 * rejects invalid form submissions before any DB operations occur.
 */

import { describe, it, expect } from "vitest";
import { customerSchema, validateFormData, getFormValues } from "../../../../../../lib/validation/index";

// Helper to build a FormData from a plain object
function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return fd;
}

describe("Customer creation form – Zod validation via validateFormData", () => {
  // ----------------------------------------------------------------
  // Happy path
  // ----------------------------------------------------------------

  it("accepts a valid submission with only the three required fields", () => {
    const fd = makeFormData({
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Smith",
    });
    const result = validateFormData(fd, customerSchema);
    expect(result.success).toBe(true);
  });

  it("accepts a full submission with all optional fields populated", () => {
    const fd = makeFormData({
      email: "bob@example.com",
      firstName: "Bob",
      lastName: "Jones",
      phone: "+1-555-1234",
      dateOfBirth: "1985-06-15",
      emergencyContactName: "Carol Jones",
      emergencyContactPhone: "+1-555-5678",
      emergencyContactRelation: "Spouse",
      medicalConditions: "None",
      medications: "None",
      address: "42 Ocean Drive",
      city: "Key West",
      state: "FL",
      postalCode: "33040",
      country: "US",
      notes: "Preferred morning dives",
    });
    const result = validateFormData(fd, customerSchema);
    expect(result.success).toBe(true);
  });

  // ----------------------------------------------------------------
  // Missing required fields
  // ----------------------------------------------------------------

  it("rejects submission when firstName is missing", () => {
    const fd = makeFormData({
      email: "test@example.com",
      lastName: "Doe",
    });
    const result = validateFormData(fd, customerSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("firstName");
    }
  });

  it("rejects submission when lastName is missing", () => {
    const fd = makeFormData({
      email: "test@example.com",
      firstName: "Jane",
    });
    const result = validateFormData(fd, customerSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("lastName");
    }
  });

  it("rejects submission when email is missing", () => {
    const fd = makeFormData({
      firstName: "Jane",
      lastName: "Doe",
    });
    const result = validateFormData(fd, customerSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("email");
    }
  });

  // ----------------------------------------------------------------
  // Invalid field values
  // ----------------------------------------------------------------

  it("rejects an invalid email address", () => {
    const fd = makeFormData({
      email: "not-an-email",
      firstName: "Jane",
      lastName: "Doe",
    });
    const result = validateFormData(fd, customerSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.email).toBe("Valid email required");
    }
  });

  it("rejects an empty firstName string", () => {
    const fd = makeFormData({
      email: "jane@example.com",
      firstName: "",
      lastName: "Doe",
    });
    const result = validateFormData(fd, customerSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("firstName");
    }
  });

  it("rejects an empty lastName string", () => {
    const fd = makeFormData({
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "",
    });
    const result = validateFormData(fd, customerSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty("lastName");
    }
  });

  it("reports multiple errors when several required fields are empty", () => {
    const fd = makeFormData({
      email: "bad-email",
      firstName: "",
      lastName: "",
    });
    const result = validateFormData(fd, customerSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(3);
    }
  });

  // ----------------------------------------------------------------
  // getFormValues round-trip
  // ----------------------------------------------------------------

  it("getFormValues preserves string fields for form repopulation", () => {
    const fd = makeFormData({
      email: "repop@example.com",
      firstName: "Re",
      lastName: "Pop",
      phone: "555-0000",
    });
    const values = getFormValues(fd);
    expect(values.email).toBe("repop@example.com");
    expect(values.firstName).toBe("Re");
    expect(values.lastName).toBe("Pop");
    expect(values.phone).toBe("555-0000");
  });
});
