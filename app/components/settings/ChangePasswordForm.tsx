import { useFetcher } from "react-router";
import { useState } from "react";

interface ChangePasswordFormProps {
  userId: string;
  onSuccess?: () => void;
}

export function ChangePasswordForm({ userId, onSuccess }: ChangePasswordFormProps) {
  const fetcher = useFetcher();
  const [showForm, setShowForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  const isSubmitting = fetcher.state === "submitting";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    // Validate passwords
    if (newPassword.length < 8) {
      setValidationError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      setValidationError("New password must be different from current password");
      return;
    }

    // Submit the form
    const formData = new FormData();
    formData.append("intent", "change-password");
    formData.append("userId", userId);
    formData.append("currentPassword", currentPassword);
    formData.append("newPassword", newPassword);

    fetcher.submit(formData, { method: "post" });
  };

  // Reset form and close on success
  if (fetcher.data?.success && showForm) {
    setShowForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    if (onSuccess) onSuccess();
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 text-sm border border-border-strong rounded-lg hover:bg-surface-inset transition-colors"
      >
        Change Password
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>

        {fetcher.data?.error && (
          <div className="bg-danger-muted text-danger border border-danger rounded-lg p-3 mb-4 text-sm max-w-4xl break-words">
            {fetcher.data.error}
          </div>
        )}

        {validationError && (
          <div className="bg-danger-muted text-danger border border-danger rounded-lg p-3 mb-4 text-sm max-w-4xl break-words">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand disabled:opacity-50"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-brand text-white py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Changing..." : "Change Password"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setValidationError("");
              }}
              disabled={isSubmitting}
              className="flex-1 border py-2 rounded-lg hover:bg-surface-inset disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
