/**
 * ErrorMessage Component
 *
 * Consistent error message display using semantic danger tokens.
 * Automatically supports dark mode.
 *
 * Usage:
 *   <ErrorMessage error={actionData?.errors?.form} />
 *   <ErrorMessage error="Something went wrong" />
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ErrorMessageProps {
  error?: string | null;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ErrorMessage({ error, className = "" }: ErrorMessageProps) {
  if (!error) return null;

  return (
    <div
      className={`bg-[var(--danger-muted)] border border-[var(--danger)] text-[var(--danger)] p-3 rounded-lg text-sm max-w-4xl break-words ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <svg
          className="w-5 h-5 flex-shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <span>{error}</span>
      </div>
    </div>
  );
}
