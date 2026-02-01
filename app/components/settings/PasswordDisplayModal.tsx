import { useState, useEffect, useRef } from "react";

interface PasswordDisplayModalProps {
  password: string;
  onClose: () => void;
}

/**
 * Accessible modal for displaying generated passwords
 *
 * Replaces alert() with proper modal that supports:
 * - Screen readers (ARIA labels)
 * - Keyboard navigation (Escape, Tab, focus trap)
 * - Copy to clipboard functionality
 * - WCAG 2.1 AA compliance
 */
export function PasswordDisplayModal({ password, onClose }: PasswordDisplayModalProps) {
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Focus trap: keep focus within modal
  useEffect(() => {
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = [closeButtonRef.current, copyButtonRef.current];
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: move focus backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: move focus forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy password:", error);
      // Fallback: show error or use older API
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-modal-title"
      aria-describedby="password-modal-description"
    >
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 id="password-modal-title" className="text-xl font-semibold mb-4">
          Generated Password
        </h2>

        <p id="password-modal-description" className="text-sm text-foreground-muted mb-4">
          The temporary password has been created. Copy it now - you won't be able to see it again.
        </p>

        {/* Password Display */}
        <div className="mb-4 p-4 bg-surface-inset rounded border border-border-strong">
          <code
            className="text-lg font-mono break-all select-all"
            aria-label="Generated password"
          >
            {password}
          </code>
        </div>

        {/* Warning */}
        <div className="mb-6 p-3 bg-warning-muted border border-warning rounded">
          <p className="text-sm font-medium">⚠️ User must change this password on next login</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            ref={copyButtonRef}
            type="button"
            onClick={handleCopy}
            className="px-4 py-2 border rounded hover:bg-surface-overlay"
            aria-label="Copy password to clipboard"
          >
            {copied ? "✓ Copied!" : "Copy to Clipboard"}
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover"
            aria-label="Close password display"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
