import { describe, it, expect } from "vitest";
import {
  preserveFormFields,
  createFieldPreserver,
  validateEmail,
  validateRequired,
  validateNumber,
  combineValidations,
  extractFormData,
  type FormErrorResponse,
} from "../../lib/utils/form-helpers";

describe("preserveFormFields", () => {
  it("should preserve specified string fields from FormData", () => {
    const formData = new FormData();
    formData.set("name", "John Doe");
    formData.set("email", "john@example.com");
    formData.set("phone", "555-1234");

    type CustomerForm = { name: string; email: string; phone: string };
    const preserved = preserveFormFields<CustomerForm>(formData, [
      "name",
      "email",
    ]);

    expect(preserved).toEqual({
      name: "John Doe",
      email: "john@example.com",
    });
    expect(preserved.phone).toBeUndefined();
  });

  it("should handle missing fields gracefully", () => {
    const formData = new FormData();
    formData.set("name", "John Doe");

    type CustomerForm = { name: string; email: string };
    const preserved = preserveFormFields<CustomerForm>(formData, [
      "name",
      "email",
    ]);

    expect(preserved).toEqual({
      name: "John Doe",
    });
  });

  it("should convert File objects to filenames", () => {
    const formData = new FormData();
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    formData.set("document", file);

    type UploadForm = { document: string };
    const preserved = preserveFormFields<UploadForm>(formData, ["document"]);

    expect(preserved).toEqual({
      document: "test.pdf",
    });
  });

  it("should handle empty FormData", () => {
    const formData = new FormData();

    type EmptyForm = { name: string; email: string };
    const preserved = preserveFormFields<EmptyForm>(formData, ["name", "email"]);

    expect(preserved).toEqual({});
  });
});

describe("createFieldPreserver", () => {
  it("should create a type-safe field preserver", () => {
    type TourForm = {
      name: string;
      description: string;
      price: number;
    };

    const preserveTourFields = createFieldPreserver<TourForm>();

    const formData = new FormData();
    formData.set("name", "Sunset Dive");
    formData.set("description", "Beautiful evening dive");
    formData.set("price", "150");

    const preserved = preserveTourFields(formData, ["name", "description"]);

    expect(preserved).toEqual({
      name: "Sunset Dive",
      description: "Beautiful evening dive",
    });
  });

  it("should work with FormErrorResponse type", () => {
    type LoginForm = { email: string; password: string };

    const preserveLoginFields = createFieldPreserver<LoginForm>();

    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("password", "secret123");

    const preserved = preserveLoginFields(formData, ["email"]);

    const response: FormErrorResponse<LoginForm> = {
      error: "Invalid credentials",
      ...preserved,
    };

    expect(response).toEqual({
      error: "Invalid credentials",
      email: "user@example.com",
    });
  });
});

describe("validateEmail", () => {
  it("should accept valid email addresses", () => {
    expect(validateEmail("user@example.com")).toEqual({ valid: true });
    expect(validateEmail("test.user+tag@example.co.uk")).toEqual({ valid: true });
    expect(validateEmail("admin@localhost.dev")).toEqual({ valid: true });
  });

  it("should reject empty or whitespace-only emails", () => {
    expect(validateEmail("")).toEqual({
      valid: false,
      error: "Email is required",
    });
    expect(validateEmail("   ")).toEqual({
      valid: false,
      error: "Email is required",
    });
  });

  it("should reject invalid email formats", () => {
    expect(validateEmail("invalid-email")).toEqual({
      valid: false,
      error: "Invalid email format",
    });
    expect(validateEmail("@example.com")).toEqual({
      valid: false,
      error: "Invalid email format",
    });
    expect(validateEmail("user@")).toEqual({
      valid: false,
      error: "Invalid email format",
    });
    expect(validateEmail("user @example.com")).toEqual({
      valid: false,
      error: "Invalid email format",
    });
  });
});

describe("validateRequired", () => {
  it("should accept non-empty values", () => {
    expect(validateRequired("John", "Name")).toEqual({ valid: true });
    expect(validateRequired("  John  ", "Name")).toEqual({ valid: true });
  });

  it("should reject empty or null values", () => {
    expect(validateRequired("", "Name")).toEqual({
      valid: false,
      error: "Name is required",
    });
    expect(validateRequired(null, "Name")).toEqual({
      valid: false,
      error: "Name is required",
    });
    expect(validateRequired(undefined, "Name")).toEqual({
      valid: false,
      error: "Name is required",
    });
    expect(validateRequired("   ", "Name")).toEqual({
      valid: false,
      error: "Name is required",
    });
  });

  it("should enforce minimum length when specified", () => {
    expect(validateRequired("AB", "Name", 3)).toEqual({
      valid: false,
      error: "Name must be at least 3 characters",
    });
    expect(validateRequired("ABC", "Name", 3)).toEqual({ valid: true });
    expect(validateRequired("ABCD", "Name", 3)).toEqual({ valid: true });
  });
});

describe("validateNumber", () => {
  it("should accept valid numbers", () => {
    const result = validateNumber("42", "Price");
    expect(result.valid).toBe(true);
    expect(result.value).toBe(42);
  });

  it("should accept decimal numbers", () => {
    const result = validateNumber("42.50", "Price");
    expect(result.valid).toBe(true);
    expect(result.value).toBe(42.5);
  });

  it("should reject empty values", () => {
    expect(validateNumber("", "Price")).toEqual({
      valid: false,
      error: "Price is required",
    });
    expect(validateNumber(null, "Price")).toEqual({
      valid: false,
      error: "Price is required",
    });
  });

  it("should reject non-numeric values", () => {
    expect(validateNumber("abc", "Price")).toEqual({
      valid: false,
      error: "Price must be a valid number",
    });
    expect(validateNumber("12.34.56", "Price")).toEqual({
      valid: false,
      error: "Price must be a valid number",
    });
  });

  it("should enforce integer constraint", () => {
    expect(validateNumber("42.5", "Quantity", { integer: true })).toEqual({
      valid: false,
      error: "Quantity must be a whole number",
    });
    expect(validateNumber("42", "Quantity", { integer: true }).valid).toBe(true);
  });

  it("should enforce minimum value", () => {
    expect(validateNumber("5", "Quantity", { min: 10 })).toEqual({
      valid: false,
      error: "Quantity must be at least 10",
    });
    expect(validateNumber("10", "Quantity", { min: 10 }).valid).toBe(true);
    expect(validateNumber("15", "Quantity", { min: 10 }).valid).toBe(true);
  });

  it("should enforce maximum value", () => {
    expect(validateNumber("150", "Quantity", { max: 100 })).toEqual({
      valid: false,
      error: "Quantity must be at most 100",
    });
    expect(validateNumber("100", "Quantity", { max: 100 }).valid).toBe(true);
    expect(validateNumber("50", "Quantity", { max: 100 }).valid).toBe(true);
  });

  it("should enforce both min and max", () => {
    expect(validateNumber("5", "Rating", { min: 1, max: 5 }).valid).toBe(true);
    expect(validateNumber("0", "Rating", { min: 1, max: 5 })).toEqual({
      valid: false,
      error: "Rating must be at least 1",
    });
    expect(validateNumber("6", "Rating", { min: 1, max: 5 })).toEqual({
      valid: false,
      error: "Rating must be at most 5",
    });
  });
});

describe("combineValidations", () => {
  it("should return valid when all validations pass", () => {
    const result = combineValidations([
      { valid: true },
      { valid: true },
      { valid: true },
    ]);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.errors).toBeUndefined();
  });

  it("should return first error when validations fail", () => {
    const result = combineValidations([
      { valid: false, error: "Email is required" },
      { valid: false, error: "Name is required" },
      { valid: true },
    ]);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Email is required");
    expect(result.errors).toEqual(["Email is required", "Name is required"]);
  });

  it("should collect all error messages", () => {
    const result = combineValidations([
      { valid: false, error: "Field 1 is invalid" },
      { valid: false, error: "Field 2 is invalid" },
      { valid: false, error: "Field 3 is invalid" },
    ]);

    expect(result.errors).toEqual([
      "Field 1 is invalid",
      "Field 2 is invalid",
      "Field 3 is invalid",
    ]);
  });

  it("should handle empty validation array", () => {
    const result = combineValidations([]);

    expect(result.valid).toBe(true);
  });
});

describe("extractFormData", () => {
  it("should extract and convert form fields", () => {
    const formData = new FormData();
    formData.set("name", "Sunset Dive");
    formData.set("price", "150");
    formData.set("maxCapacity", "12");
    formData.set("isPrivate", "true");

    type TripForm = {
      name: string;
      price: number;
      maxCapacity: number;
      isPrivate: boolean;
    };

    const data = extractFormData<TripForm>(formData, {
      name: (v) => String(v),
      price: (v) => Number(v),
      maxCapacity: (v) => Number(v),
      isPrivate: (v) => v === "true" || v === "on",
    });

    expect(data).toEqual({
      name: "Sunset Dive",
      price: 150,
      maxCapacity: 12,
      isPrivate: true,
    });
  });

  it("should handle Date conversion", () => {
    const formData = new FormData();
    formData.set("eventDate", "2024-06-15");

    type EventForm = {
      eventDate: Date;
    };

    const data = extractFormData<EventForm>(formData, {
      eventDate: (v) => new Date(String(v)),
    });

    expect(data.eventDate).toBeInstanceOf(Date);
    expect(data.eventDate.toISOString()).toContain("2024-06-15");
  });

  it("should handle null values", () => {
    const formData = new FormData();

    type OptionalForm = {
      name: string | null;
      email: string | null;
    };

    const data = extractFormData<OptionalForm>(formData, {
      name: (v) => (v ? String(v) : null),
      email: (v) => (v ? String(v) : null),
    });

    expect(data).toEqual({
      name: null,
      email: null,
    });
  });

  it("should handle boolean checkboxes", () => {
    const formData = new FormData();
    formData.set("acceptTerms", "on");

    type CheckboxForm = {
      acceptTerms: boolean;
      subscribe: boolean;
    };

    const data = extractFormData<CheckboxForm>(formData, {
      acceptTerms: (v) => v === "true" || v === "on",
      subscribe: (v) => v === "true" || v === "on",
    });

    expect(data).toEqual({
      acceptTerms: true,
      subscribe: false,
    });
  });
});

describe("FormErrorResponse type", () => {
  it("should work with form field preservation", () => {
    type LoginForm = { email: string; password: string };

    const response: FormErrorResponse<LoginForm> = {
      error: "Invalid credentials",
      email: "user@example.com",
    };

    expect(response.error).toBe("Invalid credentials");
    expect(response.email).toBe("user@example.com");
    expect(response.password).toBeUndefined();
  });

  it("should support field-level errors", () => {
    type SignupForm = {
      email: string;
      password: string;
      confirmPassword: string;
    };

    const response: FormErrorResponse<SignupForm> = {
      errors: {
        email: "Email already exists",
        confirmPassword: "Passwords do not match",
      },
      email: "user@example.com",
      password: "secret123",
      confirmPassword: "secret456",
    };

    expect(response.errors?.email).toBe("Email already exists");
    expect(response.errors?.confirmPassword).toBe("Passwords do not match");
    expect(response.email).toBe("user@example.com");
  });
});
