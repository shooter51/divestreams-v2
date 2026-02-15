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
} from "../../../../lib/utils/form-helpers";

describe("form-helpers", () => {
  describe("preserveFormFields", () => {
    it("should preserve string values from FormData", () => {
      const formData = new FormData();
      formData.set("name", "John Doe");
      formData.set("email", "john@example.com");
      formData.set("phone", "555-1234");

      const preserved = preserveFormFields<{
        name: string;
        email: string;
        phone: string;
      }>(formData, ["name", "email"]);

      expect(preserved).toEqual({
        name: "John Doe",
        email: "john@example.com",
      });
    });

    it("should convert File objects to their names", () => {
      const formData = new FormData();
      const file = new File(["content"], "test.pdf", { type: "application/pdf" });
      formData.set("document", file);
      formData.set("title", "Test Document");

      const preserved = preserveFormFields<{
        document: string;
        title: string;
      }>(formData, ["document", "title"]);

      expect(preserved).toEqual({
        document: "test.pdf",
        title: "Test Document",
      });
    });

    it("should skip fields with null values", () => {
      const formData = new FormData();
      formData.set("name", "John Doe");
      // email is not set

      const preserved = preserveFormFields<{
        name: string;
        email: string;
      }>(formData, ["name", "email"]);

      expect(preserved).toEqual({
        name: "John Doe",
      });
      expect(preserved.email).toBeUndefined();
    });

    it("should handle empty FormData", () => {
      const formData = new FormData();

      const preserved = preserveFormFields<{
        name: string;
        email: string;
      }>(formData, ["name", "email"]);

      expect(preserved).toEqual({});
    });

    it("should handle empty field list", () => {
      const formData = new FormData();
      formData.set("name", "John Doe");
      formData.set("email", "john@example.com");

      const preserved = preserveFormFields<Record<string, never>>(formData, []);

      expect(preserved).toEqual({});
    });
  });

  describe("createFieldPreserver", () => {
    it("should create a type-safe field preserver function", () => {
      type CustomerForm = {
        name: string;
        email: string;
        phone: string;
      };

      const preserveCustomerFields = createFieldPreserver<CustomerForm>();

      const formData = new FormData();
      formData.set("name", "Jane Smith");
      formData.set("email", "jane@example.com");

      const preserved = preserveCustomerFields(formData, ["name", "email"]);

      expect(preserved).toEqual({
        name: "Jane Smith",
        email: "jane@example.com",
      });
    });

    it("should maintain type safety with different form shapes", () => {
      type TourForm = {
        name: string;
        description: string;
        price: number;
        maxCapacity: number;
      };

      const preserveTourFields = createFieldPreserver<TourForm>();

      const formData = new FormData();
      formData.set("name", "Coral Reef Tour");
      formData.set("description", "Beautiful coral reef dive");
      formData.set("price", "99.99");

      const preserved = preserveTourFields(formData, ["name", "description"]);

      expect(preserved).toEqual({
        name: "Coral Reef Tour",
        description: "Beautiful coral reef dive",
      });
    });
  });

  describe("validateEmail", () => {
    it("should validate correct email addresses", () => {
      const validEmails = [
        "user@example.com",
        "test.user@example.co.uk",
        "user+tag@example.com",
        "user_name@example-domain.com",
        "123@example.com",
      ];

      for (const email of validEmails) {
        const result = validateEmail(email);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it("should reject invalid email addresses", () => {
      const invalidEmails = [
        "invalid-email",
        "@example.com",
        "user@",
        "user @example.com",
        "user@example",
        "user@@example.com",
      ];

      for (const email of invalidEmails) {
        const result = validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid email format");
      }
    });

    it("should reject empty or whitespace-only emails", () => {
      const emptyEmails = ["", "   ", "\t", "\n"];

      for (const email of emptyEmails) {
        const result = validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Email is required");
      }
    });
  });

  describe("validateRequired", () => {
    it("should validate non-empty values", () => {
      const result = validateRequired("John Doe", "Name");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject empty values", () => {
      const result = validateRequired("", "Name");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    it("should reject null values", () => {
      const result = validateRequired(null, "Name");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    it("should reject undefined values", () => {
      const result = validateRequired(undefined, "Name");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    it("should reject whitespace-only values", () => {
      const result = validateRequired("   ", "Name");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    it("should validate minimum length when specified", () => {
      const result = validateRequired("John", "Name", 3);
      expect(result.valid).toBe(true);
    });

    it("should reject values shorter than minimum length", () => {
      const result = validateRequired("AB", "Name", 3);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Name must be at least 3 characters");
    });

    it("should handle minLength of 0", () => {
      const result = validateRequired("", "Name", 0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Name is required");
    });

    it("should trim whitespace when checking length", () => {
      const result = validateRequired("  AB  ", "Name", 3);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Name must be at least 3 characters");
    });
  });

  describe("validateNumber", () => {
    it("should validate valid numbers", () => {
      const validNumbers = ["42", "0", "-10", "3.14", "0.5", "-99.99"];

      for (const num of validNumbers) {
        const result = validateNumber(num, "Value");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.value).toBe(Number(num));
      }
    });

    it("should reject non-numeric values", () => {
      const invalidNumbers = ["abc", "12abc", "3.14.15"];

      for (const num of invalidNumbers) {
        const result = validateNumber(num, "Value");
        expect(result.valid).toBe(false);
        expect(result.error).toBe("Value must be a valid number");
      }
    });

    it("should reject empty values", () => {
      const result = validateNumber("", "Price");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Price is required");
    });

    it("should reject null values", () => {
      const result = validateNumber(null, "Price");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Price is required");
    });

    it("should validate minimum value", () => {
      const result = validateNumber("10", "Quantity", { min: 5 });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(10);
    });

    it("should reject values below minimum", () => {
      const result = validateNumber("3", "Quantity", { min: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Quantity must be at least 5");
    });

    it("should validate maximum value", () => {
      const result = validateNumber("10", "Quantity", { max: 20 });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(10);
    });

    it("should reject values above maximum", () => {
      const result = validateNumber("25", "Quantity", { max: 20 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Quantity must be at most 20");
    });

    it("should validate range (min and max)", () => {
      const result = validateNumber("15", "Quantity", { min: 10, max: 20 });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(15);
    });

    it("should validate integer constraint", () => {
      const result = validateNumber("42", "Quantity", { integer: true });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(42);
    });

    it("should reject non-integer values when integer is required", () => {
      const result = validateNumber("15.5", "Quantity", { integer: true });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Quantity must be a whole number");
    });

    it("should validate zero as integer", () => {
      const result = validateNumber("0", "Quantity", { integer: true });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(0);
    });

    it("should validate negative integers", () => {
      const result = validateNumber("-10", "Balance", { integer: true });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(-10);
    });

    it("should combine multiple constraints", () => {
      const result = validateNumber("10", "Age", {
        min: 1,
        max: 100,
        integer: true,
      });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(10);
    });

    it("should handle edge case: min equals max", () => {
      const result = validateNumber("5", "Value", { min: 5, max: 5 });
      expect(result.valid).toBe(true);
      expect(result.value).toBe(5);
    });
  });

  describe("combineValidations", () => {
    it("should return valid when all validations pass", () => {
      const validations = [
        { valid: true },
        { valid: true },
        { valid: true },
      ];

      const result = combineValidations(validations);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.errors).toBeUndefined();
    });

    it("should collect all errors when validations fail", () => {
      const validations = [
        { valid: false, error: "Email is required" },
        { valid: false, error: "Name is required" },
        { valid: true },
        { valid: false, error: "Price must be positive" },
      ];

      const result = combineValidations(validations);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Email is required"); // First error
      expect(result.errors).toEqual([
        "Email is required",
        "Name is required",
        "Price must be positive",
      ]);
    });

    it("should handle mix of valid and invalid validations", () => {
      const validations = [
        { valid: true },
        { valid: false, error: "Invalid input" },
        { valid: true },
      ];

      const result = combineValidations(validations);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid input");
      expect(result.errors).toEqual(["Invalid input"]);
    });

    it("should handle empty validation array", () => {
      const result = combineValidations([]);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.errors).toBeUndefined();
    });

    it("should filter out undefined errors", () => {
      const validations = [
        { valid: false, error: "Error 1" },
        { valid: false }, // No error message
        { valid: false, error: "Error 2" },
      ];

      const result = combineValidations(validations);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(["Error 1", "Error 2"]);
    });
  });

  describe("extractFormData", () => {
    it("should extract string fields", () => {
      const formData = new FormData();
      formData.set("name", "John Doe");
      formData.set("email", "john@example.com");

      const data = extractFormData<{ name: string; email: string }>(formData, {
        name: (v) => String(v),
        email: (v) => String(v),
      });

      expect(data).toEqual({
        name: "John Doe",
        email: "john@example.com",
      });
    });

    it("should extract and convert numeric fields", () => {
      const formData = new FormData();
      formData.set("price", "99.99");
      formData.set("quantity", "5");

      const data = extractFormData<{ price: number; quantity: number }>(
        formData,
        {
          price: (v) => Number(v),
          quantity: (v) => Number(v),
        }
      );

      expect(data).toEqual({
        price: 99.99,
        quantity: 5,
      });
    });

    it("should extract and convert boolean fields", () => {
      const formData = new FormData();
      formData.set("isActive", "true");
      formData.set("hasDiscount", "on");
      formData.set("isArchived", "false");

      const data = extractFormData<{
        isActive: boolean;
        hasDiscount: boolean;
        isArchived: boolean;
      }>(formData, {
        isActive: (v) => v === "true" || v === "on",
        hasDiscount: (v) => v === "true" || v === "on",
        isArchived: (v) => v === "true" || v === "on",
      });

      expect(data).toEqual({
        isActive: true,
        hasDiscount: true,
        isArchived: false,
      });
    });

    it("should extract Date fields", () => {
      const formData = new FormData();
      formData.set("startDate", "2024-01-15");

      const data = extractFormData<{ startDate: Date }>(formData, {
        startDate: (v) => new Date(String(v)),
      });

      expect(data.startDate).toBeInstanceOf(Date);
      expect(data.startDate.toISOString()).toContain("2024-01-15");
    });

    it("should handle null values with custom converters", () => {
      const formData = new FormData();
      // Field not set

      const data = extractFormData<{ optional: string | null }>(formData, {
        optional: (v) => (v ? String(v) : null),
      });

      expect(data.optional).toBeNull();
    });

    it("should handle mixed field types", () => {
      const formData = new FormData();
      formData.set("name", "Test Tour");
      formData.set("date", "2024-06-01");
      formData.set("maxCapacity", "20");
      formData.set("isPrivate", "true");

      const data = extractFormData<{
        name: string;
        date: Date;
        maxCapacity: number;
        isPrivate: boolean;
      }>(formData, {
        name: (v) => String(v),
        date: (v) => new Date(String(v)),
        maxCapacity: (v) => Number(v),
        isPrivate: (v) => v === "true" || v === "on",
      });

      expect(data.name).toBe("Test Tour");
      expect(data.date).toBeInstanceOf(Date);
      expect(data.maxCapacity).toBe(20);
      expect(data.isPrivate).toBe(true);
    });

    it("should handle File objects", () => {
      const formData = new FormData();
      const file = new File(["content"], "document.pdf", {
        type: "application/pdf",
      });
      formData.set("document", file);

      const data = extractFormData<{ document: string }>(formData, {
        document: (v) => (v instanceof File ? v.name : String(v)),
      });

      expect(data.document).toBe("document.pdf");
    });

    it("should handle empty FormData", () => {
      const formData = new FormData();

      const data = extractFormData<{ name: string; email: string }>(formData, {
        name: (v) => String(v),
        email: (v) => String(v),
      });

      expect(data.name).toBe("null");
      expect(data.email).toBe("null");
    });
  });

  describe("FormErrorResponse type", () => {
    it("should allow error with preserved fields", () => {
      type LoginFields = { email: string; password: string };
      const response: FormErrorResponse<LoginFields> = {
        error: "Invalid credentials",
        email: "user@example.com",
      };

      expect(response.error).toBe("Invalid credentials");
      expect(response.email).toBe("user@example.com");
    });

    it("should allow errors object with field-specific errors", () => {
      type SignupFields = { email: string; password: string; confirmPassword: string };
      const response: FormErrorResponse<SignupFields> = {
        errors: {
          email: "Email already exists",
          password: "Password too weak",
        },
        email: "test@example.com",
      };

      expect(response.errors?.email).toBe("Email already exists");
      expect(response.errors?.password).toBe("Password too weak");
      expect(response.email).toBe("test@example.com");
    });
  });
});
