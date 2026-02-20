import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, useActionData, useNavigation, useSearchParams, useLoaderData, redirect } from "react-router";
import { useState } from "react";
import { auth } from "../../../lib/auth";
import { getSubdomainFromRequest } from "../../../lib/auth/org-context.server";
import { db } from "../../../lib/db";
import { organization, member, user } from "../../../lib/db/schema/auth";
import { eq, and } from "drizzle-orm";
import { checkRateLimit, getClientIp } from "../../../lib/utils/rate-limit";

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ActionData = {
  errors?: Record<string, string>;
  values?: { name: string; email: string };
};

export const meta: MetaFunction = () => [{ title: "Sign Up - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if already logged in
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  });

  if (sessionData?.user) {
    // Already logged in, redirect to app
    const url = new URL(request.url);
    const rawRedirect = url.searchParams.get("redirect") || "/tenant";
    // Validate redirect to prevent open redirect attacks (only allow relative URLs)
    const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.includes("://")
      ? rawRedirect : "/tenant";
    throw redirect(redirectTo);
  }

  // Get org info for display
  const subdomain = getSubdomainFromRequest(request);
  let orgName = "this shop";
  let orgId: string | null = null;

  if (subdomain) {
    const [org] = await db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);

    if (org) {
      orgName = org.name;
      orgId = org.id;
    }
  }

  return { orgName, orgId, subdomain };
}

export async function action({ request }: ActionFunctionArgs) {
  // Rate limit signup attempts
  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimit(`signup:${clientIp}`, { maxAttempts: 5, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return { errors: { form: "Too many signup attempts. Please try again later." } };
  }

  const formData = await request.formData();
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");
  const redirectTo = formData.get("redirectTo");

  // Validate redirectTo to prevent open redirect attacks
  const rawRedirect = typeof redirectTo === "string" ? redirectTo : "/tenant";
  // Only allow relative URLs (must start with / and not contain ://)
  const validatedRedirectTo = rawRedirect.startsWith("/") && !rawRedirect.includes("://")
    ? rawRedirect : "/tenant";

  // Validation
  const errors: Record<string, string> = {};

  // Name validation with null check
  if (typeof name !== "string" || !name || name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  // Email validation with null check and proper regex
  if (typeof email !== "string" || !email || !emailRegex.test(email)) {
    errors.email = "Please enter a valid email address";
  }

  // Password validation with null check
  if (typeof password !== "string" || !password || password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  } else {
    // Check password requirements
    if (!/[A-Z]/.test(password)) {
      errors.password = "Password must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(password)) {
      errors.password = "Password must contain at least one lowercase letter";
    } else if (!/[0-9]/.test(password)) {
      errors.password = "Password must contain at least one number";
    }
  }

  // Confirm password validation with null check
  if (typeof confirmPassword !== "string" || password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values: { name: typeof name === "string" ? name : "", email: typeof email === "string" ? email : "" } };
  }

  try {
    // Ensure name is string at this point (validated above)
    const validatedName = typeof name === "string" ? name : "";

    // Call Better Auth sign up API
    const response = await auth.api.signUpEmail({
      body: { name: validatedName.trim(), email: email as string, password: password as string },
      asResponse: true,
    });

    // Get the session cookie from the response headers BEFORE reading body
    const cookies = response.headers.get("set-cookie");

    // Clone response to read body (can only read once)
    const responseData = await response.json();

    if (!response.ok) {
      return {
        errors: { form: responseData.message || "Failed to create account" },
        values: { name: validatedName, email: typeof email === "string" ? email : "" },
      };
    }

    // After signup, check if user needs to be added to org
    // The user is now logged in, get their session
    const subdomain = getSubdomainFromRequest(request);

    if (subdomain) {
      // Get the org
      const [org] = await db
        .select()
        .from(organization)
        .where(eq(organization.slug, subdomain))
        .limit(1);

      if (org) {
        // Get user from the signup response (already parsed above)
        const userId = responseData?.user?.id;

        if (userId) {
          // Check if user is already a member
          const [existingMember] = await db
            .select()
            .from(member)
            .where(
              and(
                eq(member.userId, userId),
                eq(member.organizationId, org.id)
              )
            )
            .limit(1);

          if (!existingMember) {
            // Add user as customer
            await db.insert(member).values({
              id: crypto.randomUUID(),
              userId,
              organizationId: org.id,
              role: "customer",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }
    }

    // Mark email as verified for tenant signup - user is signing up directly
    // on a known subdomain, so email verification is unnecessary.
    // This matches admin-created accounts which are also set emailVerified: true.
    if (responseData?.user?.id) {
      await db.update(user).set({ emailVerified: true }).where(eq(user.id, responseData.user.id));
    }

    // Create redirect response with auth cookies
    return redirect(validatedRedirectTo, {
      headers: cookies ? { "Set-Cookie": cookies } : {},
    });
  } catch (error) {
    console.error("Signup error:", error);
    return {
      errors: { form: "An error occurred during signup. Please try again." },
      values: { name: typeof name === "string" ? name : "", email: typeof email === "string" ? email : "" },
    };
  }
}

export default function SignupPage() {
  const { orgName } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");

  const isSubmitting = navigation.state === "submitting";
  const redirectTo = searchParams.get("redirect") || "/tenant";
  const isCustomerSignup = searchParams.get("role") === "customer";
  const errors = actionData?.errors ?? {};
  const values = actionData?.values ?? { name: "", email: "" };

  // Password strength indicators
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return (
    <div className="min-h-screen bg-surface-inset flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          {isCustomerSignup ? (
            <>Join <span className="font-medium">{orgName}</span> as a customer</>
          ) : (
            "Get started with DiveStreams"
          )}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-raised py-8 px-4 shadow-sm rounded-xl sm:px-10">
          {/* Form Error Message */}
          {errors.form && (
            <div className="mb-4 p-3 bg-danger-muted border border-danger rounded-lg">
              <p className="text-sm text-danger">{errors.form}</p>
            </div>
          )}

          <Form method="post" className="space-y-6">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground">
                Full name <span className="text-danger">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  defaultValue={values.name || ""}
                  className={`appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm bg-surface-inset placeholder-foreground-subtle focus:outline-none focus:ring-brand focus:border-brand ${
                    errors.name ? "border-danger" : "border-border-strong"
                  }`}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-danger">{errors.name}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address <span className="text-danger">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={values.email || ""}
                  className={`appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm bg-surface-inset placeholder-foreground-subtle focus:outline-none focus:ring-brand focus:border-brand ${
                    errors.email ? "border-danger" : "border-border-strong"
                  }`}
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-danger">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password <span className="text-danger">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`appearance-none block w-full px-3 py-2 pr-10 border rounded-lg shadow-sm bg-surface-inset placeholder-foreground-subtle focus:outline-none focus:ring-brand focus:border-brand ${
                    errors.password ? "border-danger" : "border-border-strong"
                  }`}
                  placeholder="Create a password"
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
              {errors.password && (
                <p className="mt-1 text-sm text-danger">{errors.password}</p>
              )}

              {/* Password Requirements */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-foreground-muted font-medium">Password requirements:</p>
                  <div className="grid grid-cols-2 gap-1">
                    <RequirementCheck met={hasMinLength} text="8+ characters" />
                    <RequirementCheck met={hasUppercase} text="Uppercase letter" />
                    <RequirementCheck met={hasLowercase} text="Lowercase letter" />
                    <RequirementCheck met={hasNumber} text="Number" />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                Confirm password <span className="text-danger">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className={`appearance-none block w-full px-3 py-2 pr-10 border rounded-lg shadow-sm bg-surface-inset placeholder-foreground-subtle focus:outline-none focus:ring-brand focus:border-brand ${
                    errors.confirmPassword ? "border-danger" : "border-border-strong"
                  }`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-subtle hover:text-foreground-muted"
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
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-danger">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms */}
            <div className="text-sm text-foreground-muted">
              By creating an account, you agree to our{" "}
              <Link to="/terms" className="text-brand hover:text-brand">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-brand hover:text-brand">
                Privacy Policy
              </Link>
              .
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:bg-brand-disabled disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </button>
            </div>
          </Form>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-foreground-muted">
              Already have an account?{" "}
              <Link
                to={`/login${redirectTo !== "/tenant" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
                className="font-medium text-brand hover:text-brand"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequirementCheck({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1 text-xs ${met ? "text-success" : "text-foreground-subtle"}`}>
      {met ? (
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )}
      {text}
    </div>
  );
}
