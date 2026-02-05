/**
 * Public Site Customer Login Page
 *
 * Handles customer authentication for the tenant's public site.
 * Features:
 * - Email/password login form
 * - "Forgot Password" link
 * - "Create Account" link to registration
 * - Error messages for invalid credentials
 * - Remember me checkbox
 * - Redirect to account or previous page after login
 */

import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  redirect,
  useActionData,
  useNavigation,
  useRouteLoaderData,
  useSearchParams,
  Link,
  Form,
} from "react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../lib/db";
import { organization } from "../../../lib/db/schema/auth";
import {
  loginCustomer,
  getCustomerBySession,
} from "../../../lib/auth/customer-auth.server";
import type { SiteLoaderData } from "./_layout";

// ============================================================================
// COOKIE CONFIGURATION
// ============================================================================

/** Cookie name for customer sessions */
const CUSTOMER_SESSION_COOKIE = "customer_session";

/** Cookie options for secure sessions */
function getCookieOptions(rememberMe: boolean) {
  const baseOptions = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  // In production, add Secure flag
  if (process.env.NODE_ENV === "production") {
    baseOptions.push("Secure");
  }

  // Remember me: 30 days, otherwise session cookie
  if (rememberMe) {
    const thirtyDays = 30 * 24 * 60 * 60;
    baseOptions.push(`Max-Age=${thirtyDays}`);
  }

  return baseOptions.join("; ");
}

// ============================================================================
// META
// ============================================================================

export const meta: MetaFunction = () => {
  return [
    { title: "Log In - Customer Account" },
    { name: "description", content: "Sign in to your customer account to manage bookings and view trips." },
  ];
};

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const host = url.host;

  // Resolve organization
  const subdomain = getSubdomainFromHost(host);
  let org;

  if (subdomain) {
    [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);
  } else {
    const customDomain = host.split(":")[0];
    [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.customDomain, customDomain))
      .limit(1);
  }

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  // Check if already logged in via cookie
  const cookies = request.headers.get("Cookie") || "";
  const sessionToken = parseCookie(cookies, CUSTOMER_SESSION_COOKIE);

  if (sessionToken) {
    const customer = await getCustomerBySession(sessionToken);
    if (customer) {
      // Already logged in - redirect to account
      const rawRedirect = url.searchParams.get("redirect") || "/site/account";
      // Validate redirect to prevent open redirect attacks (only allow relative URLs)
      const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.includes("://")
        ? rawRedirect : "/site/account";
      return redirect(redirectTo);
    }
  }

  return { organizationId: org.id };
}

// ============================================================================
// ACTION
// ============================================================================

interface ActionErrors {
  email?: string;
  password?: string;
  form?: string;
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const host = url.host;

  // Resolve organization
  const subdomain = getSubdomainFromHost(host);
  let org;

  if (subdomain) {
    [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);
  } else {
    const customDomain = host.split(":")[0];
    [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.customDomain, customDomain))
      .limit(1);
  }

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const rememberMe = formData.get("rememberMe") === "on";

  // Validation
  const errors: ActionErrors = {};

  if (!email || !email.trim()) {
    errors.email = "Email is required";
  } else if (!isValidEmail(email)) {
    errors.email = "Please enter a valid email address";
  }

  if (!password) {
    errors.password = "Password is required";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, email };
  }

  try {
    // Attempt login
    const session = await loginCustomer(org.id, email, password);

    // Get redirect URL and validate to prevent open redirect attacks
    const rawRedirect = url.searchParams.get("redirect") || "/site/account";
    // Only allow relative URLs (must start with / and not contain ://)
    const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.includes("://")
      ? rawRedirect : "/site/account";

    // Set session cookie and redirect
    const cookieValue = `${CUSTOMER_SESSION_COOKIE}=${session.token}; ${getCookieOptions(rememberMe)}`;

    return redirect(redirectTo, {
      headers: {
        "Set-Cookie": cookieValue,
      },
    });
  } catch (error) {
    // Login failed
    return {
      errors: { form: "Invalid email or password" },
      email,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract subdomain from request host
 */
function getSubdomainFromHost(host: string): string | null {
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0].toLowerCase();
    }
    return null;
  }

  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    if (subdomain === "www" || subdomain === "admin") {
      return null;
    }
    return subdomain;
  }

  return null;
}

/**
 * Parse a specific cookie from cookie header string
 */
function parseCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === name) {
      return value;
    }
  }
  return null;
}

/**
 * Basic email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SiteLoginPage() {
  const layoutData = useRouteLoaderData("routes/site/_layout") as SiteLoaderData | undefined;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  const isSubmitting = navigation.state === "submitting";
  const organization = layoutData?.organization;
  const redirectTo = searchParams.get("redirect");
  const message = searchParams.get("message");

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Welcome Back</h1>
          <p className="mt-2 opacity-75">
            Sign in to your {organization?.name || "account"}
          </p>
        </div>

        {/* Success Message - Password Set */}
        {message === "password-set" && (
          <div
            className="mb-6 p-4 rounded-lg text-sm max-w-4xl break-words"
            style={{
              backgroundColor: "var(--success-bg, #d1fae5)",
              color: "var(--success-text, #065f46)",
              border: "1px solid var(--success-border, #34d399)",
            }}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">
                Password set successfully! You can now sign in with your new password.
              </span>
            </div>
          </div>
        )}

        {/* Login Card */}
        <div
          className="rounded-xl p-8 shadow-lg border"
          style={{
            backgroundColor: "var(--color-card-bg)",
            borderColor: "var(--color-border)",
          }}
        >
          <Form method="post" className="space-y-6">
            {/* Form Error */}
            {actionData?.errors?.form && (
              <div
                className="p-4 rounded-lg text-sm"
                style={{
                  backgroundColor: "var(--danger-bg)",
                  color: "var(--danger-text)",
                  border: "1px solid var(--danger-border)",
                }}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{actionData.errors.form}</span>
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                defaultValue={actionData?.email || ""}
                className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  borderColor: actionData?.errors?.email
                    ? "var(--danger-border)"
                    : "var(--color-border)",
                  backgroundColor: actionData?.errors?.email
                    ? "var(--danger-bg)"
                    : "var(--color-card-bg)",
                }}
                placeholder="you@example.com"
                required
              />
              {actionData?.errors?.email && (
                <p className="mt-1.5 text-sm" style={{ color: "var(--danger-text)" }}>
                  {actionData.errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium"
                >
                  Password
                </label>
                <Link
                  to="/site/forgot-password"
                  className="text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ color: "var(--primary-color)" }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2"
                style={{
                  borderColor: actionData?.errors?.password
                    ? "var(--danger-border)"
                    : "var(--color-border)",
                  backgroundColor: actionData?.errors?.password
                    ? "var(--danger-bg)"
                    : "var(--color-card-bg)",
                }}
                placeholder="Enter your password"
                required
              />
              {actionData?.errors?.password && (
                <p className="mt-1.5 text-sm" style={{ color: "var(--danger-text)" }}>
                  {actionData.errors.password}
                </p>
              )}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="rememberMe"
                name="rememberMe"
                className="w-4 h-4 rounded border-border focus:ring-2"
                style={{
                  accentColor: "var(--primary-color)",
                }}
              />
              <label
                htmlFor="rememberMe"
                className="text-sm cursor-pointer select-none"
              >
                Remember me for 30 days
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--primary-color)",
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>

            {/* Hidden redirect field */}
            {redirectTo && (
              <input type="hidden" name="redirect" value={redirectTo} />
            )}
          </Form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div
                className="w-full border-t"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
            <div className="relative flex justify-center text-sm">
              <span
                className="px-4"
                style={{ backgroundColor: "var(--color-card-bg)", color: "var(--text-color)" }}
              >
                New to {organization?.name || "our site"}?
              </span>
            </div>
          </div>

          {/* Register Link */}
          <Link
            to={redirectTo ? `/site/register?redirect=${encodeURIComponent(redirectTo)}` : "/site/register"}
            className="block w-full py-3 px-4 rounded-lg font-semibold text-center transition-all hover:opacity-90"
            style={{
              backgroundColor: "var(--accent-color)",
              color: "var(--primary-color)",
            }}
          >
            Create an Account
          </Link>
        </div>

        {/* Help Text */}
        <p className="mt-8 text-center text-sm opacity-75">
          Having trouble signing in?{" "}
          <Link
            to="/site/contact"
            className="font-medium hover:opacity-80"
            style={{ color: "var(--primary-color)" }}
          >
            Contact us
          </Link>
        </p>
      </div>
    </div>
  );
}
