/**
 * FormSelect Component
 *
 * Select dropdown with built-in label and error handling.
 * Uses semantic tokens for consistent styling and automatic dark mode support.
 *
 * Usage:
 *   <FormSelect
 *     label="Country"
 *     name="country"
 *     options={[
 *       { value: '', label: 'Select country...' },
 *       { value: 'us', label: 'United States' },
 *       { value: 'ca', label: 'Canada' }
 *     ]}
 *     error={actionData?.errors?.country}
 *     required
 *   />
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FormSelectProps {
  label: string;
  name: string;
  options: SelectOption[];
  error?: string | null;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FormSelect({
  label,
  name,
  options,
  error,
  required = false,
  defaultValue,
  placeholder,
  disabled = false,
  className,
}: FormSelectProps) {
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

      {/* Select */}
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        disabled={disabled}
        className={`w-full px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 ${
          !hasError
            ? "bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--foreground)] focus:ring-[var(--brand)] focus:border-[var(--brand)]"
            : "bg-[var(--danger-muted)] border border-[var(--danger)] text-[var(--foreground)] focus:ring-[var(--danger)] focus:border-[var(--danger)]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {/* Placeholder option */}
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}

        {/* Options */}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-[var(--danger)] mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
