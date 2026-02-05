import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, useSearchParams } from "react-router";
import { useState } from "react";
import { auth } from "../../../lib/auth";
import { getPlatformContext, PLATFORM_ORG_SLUG } from "../../../lib/auth/platform-context.server";
import { isAdminSubdomain } from "../../../lib/auth/org-context.server";
import { db } from "../../../lib/db";
import { organization, member } from "../../../lib/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { getAppUrl } from "../../../lib/utils/url";


export const meta: MetaFunction = () => [{ title: "Admin Login - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  // Only allow access on admin subdomain
  if (!isAdminSubdomain(request)) {
    return redirect(getAppUrl());
  }

  // If already authenticated as platform admin, redirect to dashboard
  const context = await getPlatformContext(request);
  if (context) {
    return redirect("/dashboard");
  }

  return null;
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo");

  // Validate redirectTo to prevent open redirect attacks
  const rawRedirect = typeof redirectTo === "string" ? redirectTo : "/dashboard";
  // Only allow relative URLs (must start with / and not contain ://)
  const validatedRedirectTo = rawRedirect.startsWith("/") && !rawRedirect.includes("://")
    ? rawRedirect : "/dashboard";

  // Validate email and password with null checks
  if (typeof email !== "string" || !email || !emailRegex.test(email)) {
    return { error: "Please enter a valid email address", email: email || "" };
  }

  if (typeof password !== "string" || !password) {
    return { error: "Password is required", email: email || "" };
  }

  try {
    // Call Better Auth sign in API
    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });

    // Get cookies FIRST before reading body
    const cookies = response.headers.get("set-cookie");

    // Get user data from response
    const userData = await response.json();

    if (!response.ok) {
      return { error: userData.message || "Invalid email or password", email };
    }

    const userId = userData?.user?.id;

    if (!userId) {
      return { error: "Failed to get user information", email };
    }

    // Find the platform organization
    const [platformOrg] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, PLATFORM_ORG_SLUG))
      .limit(1);

    if (!platformOrg) {
      console.error("Platform organization not found");
      return { error: "Platform configuration error. Please contact support.", email };
    }

    // Check if user is a member of the platform organization
    const [platformMembership] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          eq(member.organizationId, platformOrg.id)
        )
      )
      .limit(1);

    if (!platformMembership) {
      // User is NOT a platform member - they cannot access admin
      return Response.json(
        {
          notPlatformMember: { email },
        } as ActionData,
        {
          headers: cookies ? { "Set-Cookie": cookies } : {},
        }
      );
    }

    // User is a platform member, redirect to dashboard
    return redirect(validatedRedirectTo, {
      headers: cookies ? { "Set-Cookie": cookies } : {},
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return { error: "An error occurred during login. Please try again.", email: email || "" };
  }
}

type ActionData = {
  error?: string;
  email?: string;
  notPlatformMember?: {
    email: string;
  };
};

export default function AdminLoginPage() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  const isSubmitting = navigation.state === "submitting";
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  // Show "Not a platform member" error
  if (actionData?.notPlatformMember) {
    return (
      <div className="min-h-screen bg-surface-inset flex items-center justify-center">
        <div className="bg-surface-raised p-8 rounded-xl shadow-lg w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-danger-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
            <p className="text-foreground-muted mt-2">
              The account <span className="font-medium">{actionData.notPlatformMember.email}</span> does not have platform admin access.
            </p>
          </div>
          <p className="text-sm text-foreground-muted text-center mb-6">
            Only authorized platform administrators can access this area. If you believe this is an error, please contact the platform owner.
          </p>
          <a
            href="/login"
            className="block w-full text-center bg-surface-inset text-foreground-muted py-3 rounded-lg font-medium hover:bg-surface-inset transition-colors"
          >
            Try a different account
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-inset flex items-center justify-center">
      <div className="bg-surface-raised p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-surface rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">DS</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">DiveStreams Admin</h1>
          <p className="text-foreground-muted mt-2">Sign in with your platform admin account</p>
        </div>

        <form method="post" className="space-y-6">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          {actionData?.error && (
            <div className="bg-danger-muted text-danger p-3 rounded-lg max-w-4xl break-words text-sm">
              {actionData.error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              autoFocus
              required
              defaultValue={actionData?.email || ""}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 pr-10 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-subtle hover:text-foreground-muted"
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
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-surface text-white py-3 rounded-lg font-medium hover:bg-surface-overlay disabled:bg-brand-disabled transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-foreground-muted">
          Platform admin access only. Regular users should sign in at their organization's subdomain.
        </p>
      </div>
    </div>
  );
}
