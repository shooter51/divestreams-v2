/**
 * Centralized validation utilities for numeric and monetary inputs.
 * Provides consistent validation across forms and data processing.
 */

/**
 * Validates monetary amounts (prices, payments, etc.)
 *
 * @param value - The value to validate (string or number)
 * @param options - Validation options
 * @param options.min - Minimum allowed value (default: 0)
 * @param options.max - Maximum allowed value (optional)
 * @param options.allowZero - Whether zero is allowed (default: true)
 * @param options.fieldName - Field name for error messages (default: "Amount")
 * @returns Validation result with parsed amount or error message
 *
 * @example
 * ```typescript
 * validateMoneyAmount("25.50");
 * // { valid: true, amount: 25.50 }
 *
 * validateMoneyAmount("-5", { min: 0 });
 * // { valid: false, error: "Amount must be at least $0.00" }
 *
 * validateMoneyAmount("0", { allowZero: false });
 * // { valid: false, error: "Amount must be greater than $0.00" }
 * ```
 *
 * Note: Monetary amounts are automatically rounded to 2 decimal places.
 */
export function validateMoneyAmount(
  value: string | number,
  options?: {
    min?: number;
    max?: number;
    allowZero?: boolean;
    fieldName?: string;
  }
): { valid: boolean; error?: string; amount?: number } {
  const {
    min = 0,
    max,
    allowZero = true,
    fieldName = "Amount",
  } = options || {};

  // Convert to string for parsing
  const strValue = String(value).trim();

  // Check for empty input
  if (strValue === "") {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  // Parse as float
  const parsed = parseFloat(strValue);

  // Check for NaN
  if (isNaN(parsed)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  // Round to 2 decimal places for monetary amounts
  const rounded = Math.round(parsed * 100) / 100;

  // Check for zero if not allowed
  if (!allowZero && rounded === 0) {
    return {
      valid: false,
      error: `${fieldName} must be greater than $0.00`,
    };
  }

  // Check minimum
  if (rounded < min) {
    return {
      valid: false,
      error: `${fieldName} must be at least $${min.toFixed(2)}`,
    };
  }

  // Check maximum
  if (max !== undefined && rounded > max) {
    return {
      valid: false,
      error: `${fieldName} must not exceed $${max.toFixed(2)}`,
    };
  }

  return {
    valid: true,
    amount: rounded,
  };
}

/**
 * Validates percentage values (0-100)
 *
 * @param value - The value to validate (string or number)
 * @param options - Validation options
 * @param options.min - Minimum allowed percentage (default: 0)
 * @param options.max - Maximum allowed percentage (default: 100)
 * @param options.fieldName - Field name for error messages (default: "Percentage")
 * @returns Validation result with parsed percentage or error message
 *
 * @example
 * ```typescript
 * validatePercentage("50");
 * // { valid: true, percentage: 50 }
 *
 * validatePercentage("150");
 * // { valid: false, error: "Percentage must not exceed 100%" }
 *
 * validatePercentage("25.5", { fieldName: "Discount" });
 * // { valid: true, percentage: 25.5 }
 * ```
 */
export function validatePercentage(
  value: string | number,
  options?: {
    min?: number;
    max?: number;
    fieldName?: string;
  }
): { valid: boolean; error?: string; percentage?: number } {
  const {
    min = 0,
    max = 100,
    fieldName = "Percentage",
  } = options || {};

  // Convert to string for parsing
  const strValue = String(value).trim();

  // Check for empty input
  if (strValue === "") {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  // Parse as float
  const parsed = parseFloat(strValue);

  // Check for NaN
  if (isNaN(parsed)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  // Check minimum
  if (parsed < min) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${min}%`,
    };
  }

  // Check maximum
  if (parsed > max) {
    return {
      valid: false,
      error: `${fieldName} must not exceed ${max}%`,
    };
  }

  return {
    valid: true,
    percentage: parsed,
  };
}

/**
 * Validates integer values (quantities, counts, etc.)
 *
 * @param value - The value to validate (string or number)
 * @param options - Validation options
 * @param options.min - Minimum allowed value (default: 0)
 * @param options.max - Maximum allowed value (optional)
 * @param options.fieldName - Field name for error messages (default: "Value")
 * @returns Validation result with parsed integer or error message
 *
 * @example
 * ```typescript
 * validateInteger("5");
 * // { valid: true, value: 5 }
 *
 * validateInteger("3.7", { fieldName: "Quantity" });
 * // { valid: false, error: "Quantity must be a whole number" }
 *
 * validateInteger("10", { max: 5 });
 * // { valid: false, error: "Value must not exceed 5" }
 * ```
 */
export function validateInteger(
  value: string | number,
  options?: {
    min?: number;
    max?: number;
    fieldName?: string;
  }
): { valid: boolean; error?: string; value?: number } {
  const {
    min = 0,
    max,
    fieldName = "Value",
  } = options || {};

  // Convert to string for parsing
  const strValue = String(value).trim();

  // Check for empty input
  if (strValue === "") {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  // Parse as float first to get true numeric value
  const asFloat = parseFloat(strValue);

  // Check for NaN
  if (isNaN(asFloat)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  // Check if it's actually an integer (no decimal part)
  if (!Number.isInteger(asFloat)) {
    return {
      valid: false,
      error: `${fieldName} must be a whole number`,
    };
  }

  const parsed = asFloat;

  // Check minimum
  if (parsed < min) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${min}`,
    };
  }

  // Check maximum
  if (max !== undefined && parsed > max) {
    return {
      valid: false,
      error: `${fieldName} must not exceed ${max}`,
    };
  }

  return {
    valid: true,
    value: parsed,
  };
}
