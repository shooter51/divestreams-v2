import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  helpText?: string;
}

export function FormField({ label, error, required, children, helpText }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {helpText && !error && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export function Input({ label, error, helpText, required, className = "", ...props }: InputProps) {
  return (
    <FormField label={label} error={error} required={required} helpText={helpText}>
      <input
        {...props}
        required={required}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? "border-red-300" : "border-gray-300"
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

export function Select({ label, error, helpText, required, options, placeholder, className = "", ...props }: SelectProps) {
  return (
    <FormField label={label} error={error} required={required} helpText={helpText}>
      <select
        {...props}
        required={required}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? "border-red-300" : "border-gray-300"
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

export function Textarea({ label, error, helpText, required, className = "", ...props }: TextareaProps) {
  return (
    <FormField label={label} error={error} required={required} helpText={helpText}>
      <textarea
        {...props}
        required={required}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? "border-red-300" : "border-gray-300"
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
        className={`mt-1 rounded border-gray-300 focus:ring-blue-500 ${className}`}
      />
      <div>
        <span className="font-medium">{label}</span>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
    </label>
  );
}

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  currency?: string;
}

export function MoneyInput({ label, error, currency = "$", required, className = "", ...props }: MoneyInputProps) {
  return (
    <FormField label={label} error={error} required={required}>
      <div className="relative">
        <span className="absolute left-3 top-2 text-gray-500">{currency}</span>
        <input
          type="number"
          step="0.01"
          min="0"
          {...props}
          required={required}
          className={`w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            error ? "border-red-300" : "border-gray-300"
          } ${className}`}
        />
      </div>
    </FormField>
  );
}
