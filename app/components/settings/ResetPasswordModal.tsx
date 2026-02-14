import { useState, useEffect, useRef } from "react";
import { PasswordDisplayModal } from "./PasswordDisplayModal";

export type PasswordResetMethod = "auto_generated" | "manual_entry" | "email_reset";

export interface ResetPasswordFormData {
  userId: string;
  method: PasswordResetMethod;
  newPassword?: string;
}

interface ResetPasswordModalProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  onClose: () => void;
  onSubmit: (data: ResetPasswordFormData) => void;
  result?: {
    success: boolean;
    temporaryPassword?: string;
    error?: string;
  };
}

export function ResetPasswordModal({ user, onClose, onSubmit, result }: ResetPasswordModalProps) {
  const [method, setMethod] = useState<PasswordResetMethod>("auto_generated");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPasswordDisplay, setShowPasswordDisplay] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showPasswordDisplay) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, showPasswordDisplay]);

  // Show PasswordDisplayModal when result contains temporaryPassword
  useEffect(() => {
    if (result?.success && result?.temporaryPassword) {
      setGeneratedPassword(result.temporaryPassword);
      setShowPasswordDisplay(true);
      setIsSubmitting(false);
    } else if (result?.success || result?.error) {
      // Reset submitting state for any result (success without password or error)
      setIsSubmitting(false);
    }
  }, [result]);

  const handleSubmit = () => {
    setValidationError(null);

    if (method === "manual_entry" && !password) {
      setValidationError("Please enter a password");
      return;
    }

    if (method === "manual_entry" && password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    onSubmit({
      userId: user.id,
      method,
      newPassword: method === "manual_entry" ? password : undefined,
    });
  };

  return (
    <>
      {/* Password Display Modal (shown after auto-generate success) */}
      {showPasswordDisplay && (
        <PasswordDisplayModal
          password={generatedPassword}
          onClose={() => {
            setShowPasswordDisplay(false);
            onClose(); // Also close parent modal
          }}
        />
      )}

      {/* Main Reset Password Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-modal-title"
      >
        <div ref={modalRef} className="bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h2 id="reset-modal-title" className="text-xl font-semibold mb-4">
            Reset Password for {user.name}
          </h2>

          {/* Validation Error Message */}
          {validationError && (
            <div className="mb-4 p-3 bg-danger-muted text-danger border border-danger rounded">
              {validationError}
            </div>
          )}

          {/* Error Message */}
          {result?.error && (
            <div className="mb-4 p-3 bg-danger-muted text-danger border border-danger rounded">
              {result.error}
            </div>
          )}

          {/* Success Message (for email_reset and manual_entry) */}
          {result?.success && !result?.temporaryPassword && (
            <div className="mb-4 p-3 bg-success-muted text-success border border-success rounded">
              Password reset successful
            </div>
          )}

          {/* Method Selection */}
          <div
            role="tablist"
            aria-label="Password reset methods"
            className="space-y-2 mb-6"
          >
          <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-surface-overlay">
            <input
              type="radio"
              name="method"
              value="auto_generated"
              checked={method === "auto_generated"}
              onChange={(e) => setMethod(e.target.value as PasswordResetMethod)}
              className="mr-3"
              role="tab"
              aria-selected={method === "auto_generated"}
              aria-controls="panel-auto-generated"
              id="tab-auto-generated"
            />
            <div>
              <div className="font-medium">Auto-Generate Password</div>
              <div className="text-sm text-foreground-muted">
                System creates secure password. User must change on next login.
              </div>
            </div>
          </label>

          <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-surface-overlay">
            <input
              type="radio"
              name="method"
              value="manual_entry"
              checked={method === "manual_entry"}
              onChange={(e) => setMethod(e.target.value as PasswordResetMethod)}
              className="mr-3"
              role="tab"
              aria-selected={method === "manual_entry"}
              aria-controls="panel-manual-entry"
              id="tab-manual-entry"
            />
            <div>
              <div className="font-medium">Manual Entry</div>
              <div className="text-sm text-foreground-muted">
                Type a new password for the user.
              </div>
            </div>
          </label>

          <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-surface-overlay">
            <input
              type="radio"
              name="method"
              value="email_reset"
              checked={method === "email_reset"}
              onChange={(e) => setMethod(e.target.value as PasswordResetMethod)}
              className="mr-3"
              role="tab"
              aria-selected={method === "email_reset"}
              aria-controls="panel-email-reset"
              id="tab-email-reset"
            />
            <div>
              <div className="font-medium">Email Reset Link</div>
              <div className="text-sm text-foreground-muted">
                User receives email to set their own password.
              </div>
            </div>
          </label>
        </div>

        {/* Method-specific content */}
        {method === "manual_entry" && (
          <div
            role="tabpanel"
            id="panel-manual-entry"
            aria-labelledby="tab-manual-entry"
            className="mb-6"
          >
            <label htmlFor="new-password-input" className="block text-sm font-medium mb-2">
              New Password
            </label>
            <input
              id="new-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-brand"
              placeholder="Enter new password"
              minLength={8}
              aria-describedby="password-requirements"
            />
            <p id="password-requirements" className="text-sm text-foreground-muted mt-1">
              Minimum 8 characters
            </p>
          </div>
        )}

        {method === "email_reset" && (
          <div
            role="tabpanel"
            id="panel-email-reset"
            aria-labelledby="tab-email-reset"
            className="mb-6 p-3 bg-info-muted rounded"
          >
            <p className="text-sm">
              Password reset link will be sent to:{" "}
              <strong>{user.email}</strong>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-foreground-muted hover:text-foreground"
            aria-label="Cancel password reset"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover disabled:opacity-50"
            aria-label={isSubmitting ? "Resetting password" : "Reset password"}
          >
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button>
        </div>
        </div>
      </div>
    </>
  );
}
