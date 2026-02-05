/**
 * Public Site Customer Set Password Page
 *
 * Allows staff-created customers to set their initial password.
 * Features:
 * - Token validation
 * - Password strength requirements
 * - Confirmation password matching
 * - Error messages for invalid/expired tokens
 * - Redirect to login after successful password set
 */

import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
  Link,
  Form,
} from "react-router";
import { useState } from "react";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db";
import { organization } from "../../../lib/db/schema/auth";
import { customerCredentials } from "../../../lib/db/schema";
import { resetPassword } from "../../../lib/auth/customer-auth.server";

// ============================================================================
// META
// ============================================================================

export const meta: MetaFunction = () => {
  return [
    { title: "Set Your Password" },
    { name: "description", content: "Set your password to access your customer account" },
  ];
};

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const host = url.host;

  // Extract subdomain from host
  const subdomain = host.split(".")[0];

  // Get organization details
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  // Get token from URL
  const token = url.searchParams.get("token");

  if (!token) {
    return {
      org,
      error: "No password reset token provided",
      tokenValid: false,
    };
  }

  // Validate token exists and hasn't expired
  const [creds] = await db
    .select({
      id: customerCredentials.id,
      email: customerCredentials.email,
      resetTokenExpires: customerCredentials.resetTokenExpires,
    })
    .from(customerCredentials)
    .where(eq(customerCredentials.resetToken, token))
    .limit(1);

  if (!creds || !creds.resetTokenExpires || creds.resetTokenExpires < new Date()) {
    return {
      org,
      error: "This password setup link has expired or is invalid",
      tokenValid: false,
    };
  }

  return {
    org,
    tokenValid: true,
    email: creds.email,
  };
}

// ============================================================================
// ACTION
// ============================================================================

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const host = url.host;
  const subdomain = host.split(".")[0];

  // Get organization
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return { error: "Organization not found" };
  }

  const formData = await request.formData();
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validation
  if (!token) {
    return { error: "No password reset token provided" };
  }

  if (!password) {
    return { error: "Password is required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  try {
    await resetPassword(org.id, token, password);

    // Redirect to login with success message
    return redirect(`/site/login?message=password-set`);
  } catch (error) {
    console.error("Failed to set password:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Failed to set password. The link may have expired.",
    };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SetPasswordPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isSubmitting = navigation.state === "submitting";

  const token = searchParams.get("token");
  const error = actionData?.error || loaderData.error;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-surface">
      <div className="w-full max-w-md">
        <div className="bg-surface-raised rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Set Your Password</h1>
            <p className="text-foreground-muted text-sm">
              Welcome to {loaderData.org.name}! Please set your password to access your account.
            </p>
          </div>

          {/* Token Invalid/Expired */}
          {!loaderData.tokenValid && (
            <div className="space-y-4">
              <div className="bg-danger-muted border border-danger text-danger p-4 rounded-lg max-w-4xl break-words">
                <p className="font-semibold mb-2">Invalid or Expired Link</p>
                <p className="text-sm">{error}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-foreground-muted mb-4">
                  Please contact {loaderData.org.name} to request a new password setup link.
                </p>
                <Link
                  to="/site/contact"
                  className="text-brand hover:underline text-sm"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          )}

          {/* Password Form */}
          {loaderData.tokenValid && (
            <Form method="post" className="space-y-6">
              <input type="hidden" name="token" value={token || ""} />

              {/* Email (Display Only) */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Email Address
                </label>
                <div className="px-4 py-2 bg-surface-inset border border-border-strong rounded-lg text-foreground-muted">
                  {loaderData.email}
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    required
                    minLength={8}
                    className="w-full px-4 py-2 pr-12 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-muted hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-foreground-muted mt-1">
                  Must be at least 8 characters long
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    required
                    minLength={8}
                    className="w-full px-4 py-2 pr-12 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-muted hover:text-foreground transition-colors"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-danger-muted border border-danger text-danger p-3 rounded-lg text-sm max-w-4xl break-words">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand text-white py-3 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled font-medium"
              >
                {isSubmitting ? "Setting Password..." : "Set Password & Continue"}
              </button>

              {/* Help Text */}
              <div className="text-center text-sm text-foreground-muted">
                After setting your password, you'll be able to log in and access your bookings.
              </div>
            </Form>
          )}
        </div>

        {/* Footer Links */}
        <div className="mt-6 text-center text-sm">
          <Link to="/site" className="text-brand hover:underline">
            ← Back to {loaderData.org.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
