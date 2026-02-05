/**
 * FormInput Component
 *
 * Text input with built-in label and error handling.
 * Uses semantic tokens for consistent styling and automatic dark mode support.
 *
 * Usage:
 *   <FormInput
 *     label="Email"
 *     name="email"
 *     type="email"
 *     error={actionData?.errors?.email}
 *     required
 *   />
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FormInputProps {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "tel" | "url" | "number" | "date" | "time";
  error?: string | null;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  pattern?: string;
  inputMode?: "text" | "email" | "tel" | "url" | "numeric" | "decimal";
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FormInput({
  label,
  name,
  type = "text",
  error,
  required = false,
  placeholder,
  defaultValue,
  autoComplete,
  disabled = false,
  className,
  min,
  max,
  step,
  pattern,
  inputMode,
}: FormInputProps) {
  const hasError = Boolean(error);

  return (
    <div className={`space-y-1 ${className || ""}`}>
      {/* Label */}
      <label
        htmlFor={name}
        className="block text-sm font-medium text-[var(--foreground)]"
      >
        {label}
        {required && <span className="text-[var(--danger)] ml-1">*</span>}
      </label>

      {/* Input */}
      <input
        type={type}
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        pattern={pattern}
        inputMode={inputMode}
        className={`w-full px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 ${
          !hasError
            ? "bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:ring-[var(--brand)] focus:border-[var(--brand)]"
            : "bg-[var(--danger-muted)] border border-[var(--danger)] text-[var(--foreground)] placeholder:text-[var(--danger)] focus:ring-[var(--danger)] focus:border-[var(--danger)]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />

      {/* Error Message */}
      {error && (
        <p className="text-sm text-[var(--danger)] mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
