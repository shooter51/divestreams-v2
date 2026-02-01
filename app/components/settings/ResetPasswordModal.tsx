import { useState } from "react";

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
}

export function ResetPasswordModal({ user, onClose, onSubmit }: ResetPasswordModalProps) {
  const [method, setMethod] = useState<PasswordResetMethod>("auto_generated");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (method === "manual_entry" && !password) {
      alert("Please enter a password");
      return;
    }

    if (method === "manual_entry" && password.length < 8) {
      alert("Password must be at least 8 characters");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-semibold mb-4">
          Reset Password for {user.name}
        </h2>

        {/* Method Selection */}
        <div className="space-y-2 mb-6">
          <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-surface-overlay">
            <input
              type="radio"
              name="method"
              value="auto_generated"
              checked={method === "auto_generated"}
              onChange={(e) => setMethod(e.target.value as PasswordResetMethod)}
              className="mr-3"
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
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-brand"
              placeholder="Enter new password"
              minLength={8}
            />
            <p className="text-sm text-foreground-muted mt-1">
              Minimum 8 characters
            </p>
          </div>
        )}

        {method === "email_reset" && (
          <div className="mb-6 p-3 bg-info-muted rounded">
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
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover disabled:opacity-50"
          >
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
