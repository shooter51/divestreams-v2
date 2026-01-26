import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, useActionData, useNavigation, useSearchParams, useLoaderData, redirect } from "react-router";
import { useState } from "react";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { verification } from "../../../lib/db/schema/auth";
import { eq } from "drizzle-orm";

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ActionData = {
  errors?: Record<string, string>;
  success?: boolean;
};

export const meta: MetaFunction = () => [{ title: "Reset Password - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  // If no token, redirect to forgot password
  if (!token) {
    throw redirect("/forgot-password");
  }

  // Check if already logged in
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  });

  if (sessionData?.user) {
    // Already logged in, redirect to app
    throw redirect("/tenant");
  }

  // Try to get the email from verification table using the token
  // Better Auth stores the email in the identifier field
  let email = "";
  try {
    const [verificationRecord] = await db
      .select({ identifier: verification.identifier })
      .from(verification)
      .where(eq(verification.value, token))
      .limit(1);

    if (verificationRecord) {
      email = verificationRecord.identifier;
    }
  } catch (error) {
    console.error("Error looking up verification token:", error);
  }

  return { hasToken: true, email };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");
  const token = formData.get("token");
  const email = formData.get("email");

  // Validation
  const errors: Record<string, string> = {};

  // Token validation with null check
  if (typeof token !== "string" || !token) {
    errors.form = "Invalid or missing reset token. Please request a new password reset link.";
    return { errors };
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
    return { errors };
  }

  try {
    // Ensure password and token are strings at this point (validated above)
    const validatedPassword = typeof password === "string" ? password : "";
    const validatedToken = typeof token === "string" ? token : "";
    const validatedEmail = typeof email === "string" ? email : "";

    // Call Better Auth reset password API
    const resetResponse = await auth.api.resetPassword({
      body: {
        newPassword: validatedPassword,
        token: validatedToken,
      },
      asResponse: true,
    });

    if (!resetResponse.ok) {
      const data = await resetResponse.json();
      return {
        errors: {
          form: data.message || "Failed to reset password. The link may have expired.",
        },
      };
    }

    // Password reset successful - now auto-login with new password
    if (validatedEmail) {
      try {
        const signInResponse = await auth.api.signInEmail({
          body: { email: validatedEmail, password: validatedPassword },
          asResponse: true,
        });

        if (signInResponse.ok) {
          // Get the session cookie from the response
          const cookies = signInResponse.headers.get("set-cookie");

          // Redirect to /app with session cookies
          return redirect("/tenant", {
            headers: cookies ? { "Set-Cookie": cookies } : {},
          });
        }
      } catch (signInError) {
        console.error("Auto sign-in after password reset failed:", signInError);
        // Fall through to success state - user can manually log in
      }
    }

    // If auto-login fails or no email, show success message
    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      errors: {
        form: "An error occurred. Please try again or request a new reset link.",
      },
    };
  }
}

export default function ResetPasswordPage() {
  const { email: loaderEmail } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");

  const isSubmitting = navigation.state === "submitting";
  const token = searchParams.get("token") || "";
  const email = loaderEmail || "";
  const errors = actionData?.errors ?? {};

  // Password strength indicators
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  // Show success state
  if (actionData?.success) {
    return (
      <div className="min-h-screen bg-surface-inset flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-success-muted rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
            Password reset successful
          </h2>
          <p className="mt-2 text-center text-sm text-foreground-muted">
            Your password has been reset. You can now sign in with your new password.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-surface-raised py-8 px-4 shadow-sm rounded-xl sm:px-10">
            <Link
              to="/login"
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition-colors"
            >
              Continue to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          Enter your new password below.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-raised py-8 px-4 shadow-sm rounded-xl sm:px-10">
          {/* Form Error Message */}
          {errors.form && (
            <div className="mb-4 p-3 bg-danger-muted border border-danger rounded-lg">
              <p className="text-sm text-danger">{errors.form}</p>
              <Link
                to="/forgot-password"
                className="text-sm text-brand hover:text-brand mt-2 inline-block"
              >
                Request a new reset link
              </Link>
            </div>
          )}

          <Form method="post" className="space-y-6">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="email" value={email} />

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                New password <span className="text-danger">*</span>
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
                  placeholder="Enter new password"
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
                Confirm new password <span className="text-danger">*</span>
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
                  placeholder="Confirm new password"
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
                    Resetting password...
                  </span>
                ) : (
                  "Reset password"
                )}
              </button>
            </div>
          </Form>

          {/* Back to Login */}
          <div className="mt-6">
            <Link
              to="/login"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to login
            </Link>
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
