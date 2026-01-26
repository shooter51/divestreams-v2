import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, useActionData, useNavigation, redirect } from "react-router";
import { useState } from "react";
import { auth } from "../../../lib/auth";
import { getSubdomainFromRequest } from "../../../lib/auth/org-context.server";

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const meta: MetaFunction = () => [{ title: "Forgot Password - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if already logged in
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  });

  if (sessionData?.user) {
    // Already logged in, redirect to app
    throw redirect("/tenant");
  }

  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");

  // Email validation with null check and proper regex
  if (typeof email !== "string" || !email || !emailRegex.test(email)) {
    return { error: "Please enter a valid email address" };
  }

  try {
    // Get the subdomain to construct the redirect URL
    const subdomain = getSubdomainFromRequest(request);
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectTo = `${baseUrl}/reset-password`;

    // Call Better Auth password reset API
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo,
      },
    });

    // Always show success message for security (don't reveal if email exists)
    // Even if the email doesn't exist, we show success to prevent enumeration
    return { success: true, email };
  } catch (error) {
    console.error("Password reset request error:", error);
    // Still show success for security
    return { success: true, email };
  }
}

export default function ForgotPasswordPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [emailSent, setEmailSent] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // Show success state after form submission
  if (actionData?.success) {
    return (
      <div className="min-h-screen bg-surface-inset flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-success-muted rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
            Check your email
          </h2>
          <p className="mt-2 text-center text-sm text-foreground-muted">
            If an account exists for <span className="font-medium">{actionData.email}</span>,
            we've sent a password reset link.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-surface-raised py-8 px-4 shadow-sm rounded-xl sm:px-10">
            <div className="space-y-4">
              <p className="text-sm text-foreground-muted text-center">
                The link will expire in 1 hour. If you don't see the email, check your spam folder.
              </p>

              <div className="border-t border-border pt-4">
                <Link
                  to="/login"
                  className="w-full flex justify-center py-2.5 px-4 border border-border-strong rounded-lg shadow-sm text-sm font-medium text-foreground bg-surface-raised hover:bg-surface-inset focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand transition-colors"
                >
                  Back to login
                </Link>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="text-sm text-brand hover:text-brand"
                >
                  Didn't receive the email? Try again
                </button>
              </div>
            </div>
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
          Forgot your password?
        </h2>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          No worries, we'll send you reset instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-raised py-8 px-4 shadow-sm rounded-xl sm:px-10">
          {/* Error Message */}
          {actionData?.error && (
            <div className="mb-4 p-3 bg-danger-muted border border-danger rounded-lg">
              <p className="text-sm text-danger">{actionData.error}</p>
            </div>
          )}

          <Form method="post" className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-border-strong rounded-lg shadow-sm bg-surface-inset placeholder-foreground-subtle focus:outline-none focus:ring-brand focus:border-brand"
                  placeholder="Enter your email"
                />
              </div>
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
                    Sending...
                  </span>
                ) : (
                  "Send reset link"
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

        {/* Help Text */}
        <p className="mt-6 text-center text-xs text-foreground-muted">
          Remember your password?{" "}
          <Link to="/login" className="text-brand hover:text-brand">
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
