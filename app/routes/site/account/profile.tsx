/**
 * Account Profile Page
 *
 * Shows:
 * - Form to update: firstName, lastName, phone
 * - Email display (not editable for now)
 * - Change password section (current + new + confirm)
 * - Logout button
 */

import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "../../../../lib/db";
import { customers, customerCredentials } from "../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getCustomerBySession, logoutCustomer } from "../../../../lib/auth/customer-auth.server";
import { redirect } from "react-router";

// ============================================================================
// TYPES
// ============================================================================

interface ProfileLoaderData {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
}

interface ActionData {
  success?: boolean;
  error?: string;
  field?: string;
  type?: "profile" | "password";
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs): Promise<ProfileLoaderData> {
  // Get session token from cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").filter(Boolean).map((c) => {
      const [key, ...rest] = c.split("=");
      return [key, rest.join("=")];
    })
  );

  const sessionToken = cookies["customer_session"];

  if (!sessionToken) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const customer = await getCustomerBySession(sessionToken);
  if (!customer) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return {
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
    },
  };
}

// ============================================================================
// ACTION
// ============================================================================

export async function action({ request }: ActionFunctionArgs): Promise<ActionData | Response> {
  // Get session token from cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").filter(Boolean).map((c) => {
      const [key, ...rest] = c.split("=");
      return [key, rest.join("=")];
    })
  );

  const sessionToken = cookies["customer_session"];

  if (!sessionToken) {
    return { error: "Not authenticated", type: "profile" };
  }

  const customer = await getCustomerBySession(sessionToken);
  if (!customer) {
    return { error: "Not authenticated", type: "profile" };
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  // Handle logout
  if (intent === "logout") {
    await logoutCustomer(sessionToken);
    return redirect("/site/login", {
      headers: {
        "Set-Cookie": "customer_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
      },
    });
  }

  // Handle profile update
  if (intent === "update-profile") {
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const phone = formData.get("phone") as string;

    if (!firstName?.trim()) {
      return { error: "First name is required", field: "firstName", type: "profile" };
    }
    if (!lastName?.trim()) {
      return { error: "Last name is required", field: "lastName", type: "profile" };
    }

    await db
      .update(customers)
      .set({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customer.id));

    return { success: true, type: "profile" };
  }

  // Handle password change
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

    // Get credentials and verify current password
    const [creds] = await db
      .select()
      .from(customerCredentials)
      .where(
        and(
          eq(customerCredentials.customerId, customer.id),
          eq(customerCredentials.organizationId, customer.organizationId)
        )
      );

    if (!creds) {
      return { error: "Unable to verify credentials", type: "password" };
    }

    const validPassword = await bcrypt.compare(currentPassword, creds.passwordHash);
    if (!validPassword) {
      return { error: "Current password is incorrect", field: "currentPassword", type: "password" };
    }

    // Hash new password and update
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(customerCredentials)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(customerCredentials.id, creds.id));

    return { success: true, type: "password" };
  }

  return { error: "Invalid action" };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountProfile() {
  const { customer } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
          Profile Settings
        </h2>
        <p className="mt-1 opacity-75">
          Manage your personal information and account settings
        </p>
      </div>

      {/* Profile Information */}
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
      >
        <h3 className="text-lg font-semibold mb-6" style={{ color: "var(--text-color)" }}>
          Personal Information
        </h3>

        {actionData?.type === "profile" && actionData?.success && (
          <div className="mb-6 p-4 rounded-lg text-sm" style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
            Profile updated successfully!
          </div>
        )}

        {actionData?.type === "profile" && actionData?.error && !actionData?.field && (
          <div className="mb-6 p-4 rounded-lg text-sm" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}>
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-5">
          <input type="hidden" name="intent" value="update-profile" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-color)" }}
              >
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                defaultValue={customer.firstName}
                className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${
                  actionData?.field === "firstName" ? "border-danger" : ""
                }`}
                style={{
                  borderColor: actionData?.field === "firstName" ? undefined : "var(--accent-color)",
                }}
              />
              {actionData?.field === "firstName" && (
                <p className="mt-1 text-sm text-danger">{actionData.error}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text-color)" }}
              >
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                defaultValue={customer.lastName}
                className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${
                  actionData?.field === "lastName" ? "border-danger" : ""
                }`}
                style={{
                  borderColor: actionData?.field === "lastName" ? undefined : "var(--accent-color)",
                }}
              />
              {actionData?.field === "lastName" && (
                <p className="mt-1 text-sm text-danger">{actionData.error}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--text-color)" }}
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={customer.email}
              disabled
              className="w-full px-4 py-2.5 rounded-lg border opacity-60 cursor-not-allowed"
              style={{
                backgroundColor: "var(--color-card-bg)",
                borderColor: "var(--color-border)",
              }}
            />
            <p className="mt-1.5 text-xs opacity-60">
              Contact support to change your email address
            </p>
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--text-color)" }}
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              defaultValue={customer.phone || ""}
              placeholder="+1 (555) 123-4567"
              className="w-full px-4 py-2.5 rounded-lg border transition-colors"
              style={{ borderColor: "var(--color-border)" }}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--primary-color)" }}
            >
              {isSubmitting && navigation.formData?.get("intent") === "update-profile"
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </Form>
      </div>

      {/* Change Password */}
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
      >
        <h3 className="text-lg font-semibold mb-6" style={{ color: "var(--text-color)" }}>
          Change Password
        </h3>

        {actionData?.type === "password" && actionData?.success && (
          <div className="mb-6 p-4 rounded-lg text-sm" style={{ backgroundColor: "var(--success-bg)", color: "var(--success-text)" }}>
            Password changed successfully!
          </div>
        )}

        {actionData?.type === "password" && actionData?.error && !actionData?.field && (
          <div className="mb-6 p-4 rounded-lg text-sm" style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}>
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-5">
          <input type="hidden" name="intent" value="change-password" />

          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--text-color)" }}
            >
              Current Password
            </label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${
                actionData?.field === "currentPassword" ? "border-danger" : ""
              }`}
              style={{
                borderColor: actionData?.field === "currentPassword" ? undefined : "var(--accent-color)",
              }}
            />
            {actionData?.field === "currentPassword" && (
              <p className="mt-1 text-sm text-danger">{actionData.error}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--text-color)" }}
            >
              New Password
            </label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${
                actionData?.field === "newPassword" ? "border-danger" : ""
              }`}
              style={{
                borderColor: actionData?.field === "newPassword" ? undefined : "var(--accent-color)",
              }}
            />
            {actionData?.field === "newPassword" && (
              <p className="mt-1 text-sm text-danger">{actionData.error}</p>
            )}
            <p className="mt-1.5 text-xs opacity-60">
              Must be at least 8 characters
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--text-color)" }}
            >
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className={`w-full px-4 py-2.5 rounded-lg border transition-colors ${
                actionData?.field === "confirmPassword" ? "border-danger" : ""
              }`}
              style={{
                borderColor: actionData?.field === "confirmPassword" ? undefined : "var(--accent-color)",
              }}
            />
            {actionData?.field === "confirmPassword" && (
              <p className="mt-1 text-sm text-danger">{actionData.error}</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--primary-color)" }}
            >
              {isSubmitting && navigation.formData?.get("intent") === "change-password"
                ? "Changing..."
                : "Change Password"}
            </button>
          </div>
        </Form>
      </div>

      {/* Logout Section */}
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
      >
        <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-color)" }}>
          Sign Out
        </h3>
        <p className="text-sm opacity-75 mb-4">
          Sign out of your account on this device
        </p>
        <Form method="post">
          <input type="hidden" name="intent" value="logout" />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg border font-medium transition-colors hover:bg-danger-muted text-danger border-danger disabled:opacity-50"
          >
            {isSubmitting && navigation.formData?.get("intent") === "logout"
              ? "Signing out..."
              : "Sign Out"}
          </button>
        </Form>
      </div>
    </div>
  );
}
