import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, Form, useNavigation, Link } from "react-router";
import { requirePlatformContext } from "../../../../lib/auth/platform-context.server";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { user as userTable } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export const meta: MetaFunction = () => [{ title: "My Profile - DiveStreams Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requirePlatformContext(request);

  return {
    user: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
    },
    membership: {
      role: ctx.membership.role,
    },
    isOwner: ctx.isOwner,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requirePlatformContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-name") {
    const name = formData.get("name") as string;

    if (!name?.trim()) {
      return { error: "Name is required", field: "name", type: "profile" };
    }

    // Update user name in database
    await db
      .update(userTable)
      .set({
        name: name.trim(),
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, ctx.user.id));

    return { success: true, message: "Profile updated successfully", type: "profile" };
  }

  if (intent === "change-password") {
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!currentPassword) {
      return { error: "Current password is required", field: "currentPassword", type: "password" };
    }
    if (!newPassword) {
      return { error: "New password is required", field: "newPassword", type: "password" };
    }
    if (newPassword.length < 8) {
      return { error: "Password must be at least 8 characters", field: "newPassword", type: "password" };
    }
    if (newPassword !== confirmPassword) {
      return { error: "Passwords do not match", field: "confirmPassword", type: "password" };
    }

    try {
      // Use Better Auth's changePassword method
      await auth.api.changePassword({
        body: {
          newPassword,
          currentPassword,
          revokeOtherSessions: false, // Keep user logged in on other devices
        },
        headers: request.headers,
      });

      return { success: true, message: "Password changed successfully", type: "password" };
    } catch (error) {
      console.error("Password change error:", error);
      // Better Auth throws error if current password is incorrect
      return { error: "Current password is incorrect", field: "currentPassword", type: "password" };
    }
  }

  return null;
}

export default function AdminUserProfilePage() {
  const { user, membership, isOwner } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link to="/settings" className="text-brand hover:underline text-sm">
          ← Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">My Profile</h1>
        <p className="text-foreground-muted">Manage your personal information and password</p>
      </div>

      {/* Basic Information */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-semibold mb-4">Personal Information</h2>

        {actionData?.type === "profile" && actionData?.success && (
          <div className="bg-success-muted border border-success-muted text-success px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
            {actionData.message}
          </div>
        )}

        {actionData?.type === "profile" && actionData?.error && !actionData?.field && (
          <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="update-name" />

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              defaultValue={user.name || ""}
              className={`w-full px-3 py-2 border rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand ${
                actionData?.field === "name" ? "border-danger" : "border-border-strong"
              }`}
            />
            {actionData?.field === "name" && (
              <p className="mt-1 text-sm text-danger">{actionData.error}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-inset text-foreground-muted cursor-not-allowed"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Email cannot be changed. Contact platform administrator if you need to update it.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Platform Role
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={membership.role}
                disabled
                className="flex-1 px-3 py-2 border border-border-strong rounded-lg bg-surface-inset text-foreground-muted cursor-not-allowed capitalize"
              />
              {isOwner && (
                <span className="px-3 py-2 bg-brand-muted text-brand rounded-lg text-sm font-medium">
                  Platform Owner
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-muted"
            >
              {isSubmitting && navigation.formData?.get("intent") === "update-name"
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </Form>
      </div>

      {/* Change Password */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Change Password</h2>

        {actionData?.type === "password" && actionData?.success && (
          <div className="bg-success-muted border border-success-muted text-success px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
            {actionData.message}
          </div>
        )}

        {actionData?.type === "password" && actionData?.error && !actionData?.field && (
          <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="change-password" />

          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
              Current Password
            </label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              required
              className={`w-full px-3 py-2 border rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand ${
                actionData?.field === "currentPassword" ? "border-danger" : "border-border-strong"
              }`}
            />
            {actionData?.field === "currentPassword" && (
              <p className="mt-1 text-sm text-danger">{actionData.error}</p>
            )}
          </div>

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
              className={`w-full px-3 py-2 border rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand ${
                actionData?.field === "newPassword" ? "border-danger" : "border-border-strong"
              }`}
            />
            {actionData?.field === "newPassword" && (
              <p className="mt-1 text-sm text-danger">{actionData.error}</p>
            )}
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
              name="confirmPassword"
              required
              minLength={8}
              className={`w-full px-3 py-2 border rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand ${
                actionData?.field === "confirmPassword" ? "border-danger" : "border-border-strong"
              }`}
            />
            {actionData?.field === "confirmPassword" && (
              <p className="mt-1 text-sm text-danger">{actionData.error}</p>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-muted"
            >
              {isSubmitting && navigation.formData?.get("intent") === "change-password"
                ? "Changing..."
                : "Change Password"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
