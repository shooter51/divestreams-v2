/**
 * FormTextarea Component
 *
 * Textarea with built-in label and error handling.
 * Uses semantic tokens for consistent styling and automatic dark mode support.
 *
 * Usage:
 *   <FormTextarea
 *     label="Description"
 *     name="description"
 *     rows={4}
 *     error={actionData?.errors?.description}
 *     placeholder="Enter description..."
 *   />
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FormTextareaProps {
  label: string;
  name: string;
  error?: string | null;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FormTextarea({
  label,
  name,
  error,
  required = false,
  rows = 4,
  placeholder,
  defaultValue,
  disabled = false,
  className,
  maxLength,
}: FormTextareaProps) {
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

      {/* Textarea */}
      <textarea
        id={name}
        name={name}
        required={required}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue}
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={hasError ? `${name}-error` : undefined}
        className={`w-full px-4 py-2 rounded-lg transition-colors resize-y focus:outline-none focus:ring-2 ${
          !hasError
            ? "bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:ring-[var(--brand)] focus:border-[var(--brand)]"
            : "bg-[var(--danger-muted)] border border-[var(--danger)] text-[var(--foreground)] placeholder:text-[var(--danger)] focus:ring-[var(--danger)] focus:border-[var(--danger)]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />

      {/* Error Message */}
      {error && (
        <p id={`${name}-error`} className="text-sm text-[var(--danger)] mt-1" role="alert">
          {error}
        </p>
      )}

      {/* Character Count (if maxLength specified) */}
      {maxLength && (
        <p className="text-xs text-[var(--foreground-subtle)] text-right">
          {defaultValue?.length || 0} / {maxLength}
        </p>
      )}
    </div>
  );
}
