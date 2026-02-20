/**
 * Form Helper Utilities
 *
 * Centralized utilities for form field preservation, validation, and error handling.
 * These helpers standardize form behavior across the codebase, ensuring consistent
 * UX when forms fail validation or encounter errors.
 *
 * @module lib/utils/form-helpers
 */

/**
 * Type definition for form error responses that preserve submitted values
 *
 * @template T - The shape of form fields being preserved
 *
 * @example
 * ```typescript
 * type LoginFields = { email: string; password: string };
 * const response: FormErrorResponse<LoginFields> = {
 *   error: "Invalid credentials",
 *   email: "user@example.com" // Preserved value
 * };
 * ```
 */
export type FormErrorResponse<T = Record<string, never>> = {
  error?: string;
  errors?: Record<string, string>;
} & Partial<T>;

/**
 * Preserves form field values from FormData for error response repopulation
 *
 * Extracts specified fields from FormData and returns them as a partial object,
 * allowing forms to be repopulated with user input after validation errors.
 *
 * @template T - The shape of the form fields object
 * @param formData - The FormData object from the submitted form
 * @param fields - Array of field names to preserve
 * @returns Partial object containing the preserved field values
 *
 * @example
 * ```typescript
 * type CustomerForm = { name: string; email: string; phone: string };
 *
 * const formData = new FormData();
 * formData.set("name", "John Doe");
 * formData.set("email", "john@example.com");
 *
 * const preserved = preserveFormFields<CustomerForm>(
 *   formData,
 *   ["name", "email"]
 * );
 * // Returns: { name: "John Doe", email: "john@example.com" }
 * ```
 */
export function preserveFormFields<T extends Record<string, unknown>>(
  formData: FormData,
  fields: (keyof T)[]
): Partial<T> {
  const preserved: Partial<T> = {};

  for (const field of fields) {
    const value = formData.get(field as string);
    if (value !== null) {
      // Convert File objects to their names, preserve strings as-is
      preserved[field] = (value instanceof File ? value.name : value) as T[keyof T];
    }
  }

  return preserved;
}

/**
 * Factory function that creates a type-safe form field preserver
 *
 * Returns a curried function specialized for a specific form shape,
 * providing better type inference and reusability.
 *
 * @template T - The shape of the form fields object
 * @returns A function that preserves fields for the specified form type
 *
 * @example
 * ```typescript
 * type TourForm = {
 *   name: string;
 *   description: string;
 *   price: number;
 *   maxCapacity: number;
 * };
 *
 * const preserveTourFields = createFieldPreserver<TourForm>();
 *
 * // Later in action handler:
 * const preserved = preserveTourFields(formData, [
 *   "name", "description", "price", "maxCapacity"
 * ]);
 *
 * return json<FormErrorResponse<TourForm>>({
 *   error: "Invalid tour data",
 *   ...preserved
 * });
 * ```
 */
export function createFieldPreserver<T extends Record<string, unknown>>() {
  return (formData: FormData, fields: (keyof T)[]) =>
    preserveFormFields<T>(formData, fields);
}

/**
 * Email validation result
 */
export type EmailValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * Validates an email address using standard RFC 5322 pattern
 *
 * Checks for basic email format and common issues like missing @ or domain.
 *
 * @param email - The email address to validate
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const result1 = validateEmail("user@example.com");
 * // Returns: { valid: true }
 *
 * const result2 = validateEmail("invalid-email");
 * // Returns: { valid: false, error: "Invalid email format" }
 *
 * const result3 = validateEmail("");
 * // Returns: { valid: false, error: "Email is required" }
 * ```
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: "Email is required" };
  }

  // RFC 5322 simplified email pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true };
}

/**
 * Validates a required text field
 *
 * @param value - The field value to validate
 * @param fieldName - Human-readable field name for error messages
 * @param minLength - Optional minimum length requirement
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const result1 = validateRequired("", "Name");
 * // Returns: { valid: false, error: "Name is required" }
 *
 * const result2 = validateRequired("AB", "Name", 3);
 * // Returns: { valid: false, error: "Name must be at least 3 characters" }
 *
 * const result3 = validateRequired("John", "Name", 3);
 * // Returns: { valid: true }
 * ```
 */
export function validateRequired(
  value: string | null | undefined,
  fieldName: string,
  minLength?: number
): EmailValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (minLength && value.trim().length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters`,
    };
  }

  return { valid: true };
}

/**
 * Validates a numeric field
 *
 * @param value - The string value to validate as a number
 * @param fieldName - Human-readable field name for error messages
 * @param options - Validation options (min, max, integer)
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const result1 = validateNumber("", "Price");
 * // Returns: { valid: false, error: "Price is required" }
 *
 * const result2 = validateNumber("abc", "Price");
 * // Returns: { valid: false, error: "Price must be a valid number" }
 *
 * const result3 = validateNumber("5", "Quantity", { min: 10 });
 * // Returns: { valid: false, error: "Quantity must be at least 10" }
 *
 * const result4 = validateNumber("15.5", "Quantity", { integer: true });
 * // Returns: { valid: false, error: "Quantity must be a whole number" }
 * ```
 */
export function validateNumber(
  value: string | null | undefined,
  fieldName: string,
  options: { min?: number; max?: number; integer?: boolean } = {}
): EmailValidationResult & { value?: number } {
  if (!value || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const num = Number(value);

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (options.integer && !Number.isInteger(num)) {
    return { valid: false, error: `${fieldName} must be a whole number` };
  }

  if (options.min !== undefined && num < options.min) {
    return { valid: false, error: `${fieldName} must be at least ${options.min}` };
  }

  if (options.max !== undefined && num > options.max) {
    return { valid: false, error: `${fieldName} must be at most ${options.max}` };
  }

  return { valid: true, value: num };
}

/**
 * Combines multiple validation results into a single result
 *
 * Useful for validating entire forms at once and collecting all errors.
 *
 * @param validations - Array of validation results to combine
 * @returns Combined result with all error messages
 *
 * @example
 * ```typescript
 * const emailCheck = validateEmail(email);
 * const nameCheck = validateRequired(name, "Name", 2);
 * const priceCheck = validateNumber(price, "Price", { min: 0 });
 *
 * const combined = combineValidations([emailCheck, nameCheck, priceCheck]);
 *
 * if (!combined.valid) {
 *   return json({
 *     errors: combined.errors,
 *     ...preservedFields
 *   });
 * }
 * ```
 */
export function combineValidations(
  validations: EmailValidationResult[]
): EmailValidationResult & { errors?: string[] } {
  const errors = validations
    .filter((v) => !v.valid)
    .map((v) => v.error)
    .filter((e): e is string => e !== undefined);

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors[0], // First error as primary
      errors,
    };
  }

  return { valid: true };
}

/**
 * Extracts form data into a typed object
 *
 * Safely extracts and converts form fields into a structured object.
 *
 * @template T - The shape of the extracted form data
 * @param formData - The FormData object to extract from
 * @param schema - Object mapping field names to their type converters
 * @returns Typed object with extracted values
 *
 * @example
 * ```typescript
 * type TripForm = {
 *   name: string;
 *   date: Date;
 *   maxCapacity: number;
 *   isPrivate: boolean;
 * };
 *
 * const data = extractFormData<TripForm>(formData, {
 *   name: (v) => String(v),
 *   date: (v) => new Date(String(v)),
 *   maxCapacity: (v) => Number(v),
 *   isPrivate: (v) => v === "true" || v === "on",
 * });
 * ```
 */
export function extractFormData<T extends Record<string, unknown>>(
  formData: FormData,
  schema: { [K in keyof T]: (value: FormDataEntryValue | null) => T[K] }
): T {
  const result = {} as T;

  for (const [key, converter] of Object.entries(schema)) {
    const value = formData.get(key);
    result[key as keyof T] = converter(value);
  }

  return result;
}
