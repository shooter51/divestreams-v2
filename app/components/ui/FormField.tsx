import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  helpText?: string;
  id?: string;
}

export function FormField({ label, error, required, children, helpText, id }: FormFieldProps) {
  const fieldId = id || `field-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {helpText && !error && <p className="text-xs text-foreground-muted mt-1">{helpText}</p>}
      {error && <p className="text-danger text-sm mt-1">{error}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export function Input({ label, error, helpText, required, className = "", id, ...props }: InputProps) {
  const fieldId = id || `field-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <FormField label={label} error={error} required={required} helpText={helpText} id={fieldId}>
      <input
        {...props}
        id={fieldId}
        required={required}
        className={`w-full px-3 py-2 border rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand ${
          error ? "border-danger" : "border-border-strong"
        } ${className}`}
      />
    </FormField>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  helpText?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export function Select({ label, error, helpText, required, options, placeholder, className = "", id, ...props }: SelectProps) {
  const fieldId = id || `field-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <FormField label={label} error={error} required={required} helpText={helpText} id={fieldId}>
      <select
        {...props}
        id={fieldId}
        required={required}
        className={`w-full px-3 py-2 border rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand ${
          error ? "border-danger" : "border-border-strong"
        } ${className}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export function Textarea({ label, error, helpText, required, className = "", id, ...props }: TextareaProps) {
  const fieldId = id || `field-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <FormField label={label} error={error} required={required} helpText={helpText} id={fieldId}>
      <textarea
        {...props}
        id={fieldId}
        required={required}
        className={`w-full px-3 py-2 border rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand ${
          error ? "border-danger" : "border-border-strong"
        } ${className}`}
      />
    </FormField>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export function Checkbox({ label, description, className = "", ...props }: CheckboxProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        {...props}
        className={`mt-1 rounded border-border-strong focus:ring-brand ${className}`}
      />
      <div>
        <span className="font-medium">{label}</span>
        {description && <p className="text-sm text-foreground-muted">{description}</p>}
      </div>
    </label>
  );
}

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  currency?: string;
}

export function MoneyInput({ label, error, currency = "$", required, className = "", id, ...props }: MoneyInputProps) {
  const fieldId = id || `field-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <FormField label={label} error={error} required={required} id={fieldId}>
      <div className="relative">
        <span className="absolute left-3 top-2 text-foreground-muted">{currency}</span>
        <input
          type="number"
          step="0.01"
          min="0"
          {...props}
          id={fieldId}
          required={required}
          className={`w-full pl-7 pr-3 py-2 border rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand ${
            error ? "border-danger" : "border-border-strong"
          } ${className}`}
        />
      </div>
    </FormField>
  );
}
