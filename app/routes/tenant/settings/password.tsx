import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, Form, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { account } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "react-router";
import { CsrfInput } from "../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Change Password - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOrgContext(request);
  const url = new URL(request.url);
  const forced = url.searchParams.get("forced") === "true";

  return {
    forced,
    message: forced
      ? "Your administrator reset your password. Please create a new password to continue."
      : null,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validation
  if (!newPassword || !confirmPassword) {
    return { error: "All fields are required" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  // Check if forced (skip current password check)
  const url = new URL(request.url);
  const forced = url.searchParams.get("forced") === "true";

  if (!forced && !currentPassword) {
    return { error: "Current password is required" };
  }

  try {
    if (forced) {
      // For forced password changes (admin-initiated reset), use Better Auth's
      // changePassword with the temporary password. The forcePasswordChange flag
      // is already set on the account, and we need to clear it after success.
      // Since the user may not know the current password (admin-generated),
      // we use the direct API approach with session context.
      await auth.api.changePassword({
        body: {
          newPassword,
          currentPassword: currentPassword || newPassword, // For forced, current may be empty
          revokeOtherSessions: false,
        },
        headers: request.headers,
      });

      // Clear forcePasswordChange flag after successful password change
      await db
        .update(account)
        .set({
          forcePasswordChange: false,
          updatedAt: new Date(),
        })
        .where(eq(account.userId, ctx.user.id));
    } else {
      // Normal password change - Better Auth verifies the current password
      await auth.api.changePassword({
        body: {
          newPassword,
          currentPassword,
          revokeOtherSessions: false,
        },
        headers: request.headers,
      });
    }

    return redirect("/tenant/dashboard?message=Password updated successfully");
  } catch (error) {
    // Re-throw Response objects (redirects) so React Router can handle them
    if (error instanceof Response) {
      throw error;
    }
    console.error("Password update error:", error);
    // Better Auth throws if current password is incorrect
    if (!forced) {
      return { error: "Current password is incorrect" };
    }
    return { error: "Failed to update password. Please try again." };
  }
}

export default function PasswordSettingsPage() {
  const { forced, message } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        {!forced && (
          <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
            ← Back to Settings
          </Link>
        )}
        <h1 className="text-2xl font-bold mt-2">Change Password</h1>
      </div>

      {forced && (
        <div className="mb-6 p-4 bg-warning-muted border border-warning rounded">
          <p className="font-medium">⚠️ Password Change Required</p>
          <p className="text-sm mt-1">{message}</p>
        </div>
      )}

      {actionData?.error && (
        <div className="mb-6 p-4 bg-danger-muted border border-danger rounded">
          <p className="text-danger font-medium">{actionData.error}</p>
        </div>
      )}

      <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
        <Form method="post">
          <CsrfInput />
          <div className="space-y-4">
            {!forced && (
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  required={!forced}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="Enter current password"
                />
              </div>
            )}

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="Enter new password"
              />
              <p className="text-sm text-foreground-muted mt-1">
                Minimum 8 characters
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                required
                minLength={8}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
            >
              Update Password
            </button>
            {!forced && (
              <Link
                to="/tenant/settings"
                className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
              >
                Cancel
              </Link>
            )}
          </div>
        </Form>
      </div>

      <div className="mt-6 p-4 bg-info-muted border border-info rounded">
        <h3 className="font-medium mb-2">Password Requirements</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>At least 8 characters long</li>
          <li>Use a mix of letters, numbers, and symbols</li>
          <li>Avoid common words and patterns</li>
        </ul>
      </div>
    </div>
  );
}
