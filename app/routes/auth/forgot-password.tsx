import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation } from "react-router";
import { eq } from "drizzle-orm";
import { getSubdomainFromRequest, getOrgContext } from "../../../lib/auth/org-context.server";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { organization } from "../../../lib/db/schema/auth";
import { getAppUrl } from "../../../lib/utils/url";

export const meta: MetaFunction = () => {
  return [{ title: "Forgot Password - DiveStreams" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const subdomain = getSubdomainFromRequest(request);

  if (!subdomain) {
    return redirect(getAppUrl());
  }

  // If already logged in, redirect to app
  const orgContext = await getOrgContext(request);
  if (orgContext) {
    return redirect("/tenant");
  }

  // Verify organization exists
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return redirect(getAppUrl());
  }

  return { tenantName: org.name };
}

export async function action({ request }: ActionFunctionArgs) {
  const subdomain = getSubdomainFromRequest(request);

  if (!subdomain) {
    return redirect(getAppUrl());
  }

  const formData = await request.formData();
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/auth/reset-password" },
    });
  } catch (error) {
    // Don't reveal if email exists - always show success
  }

  // Always return success to prevent email enumeration
  return { success: true };
}

export default function ForgotPasswordPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (actionData?.success) {
    return (
      <div className="min-h-screen bg-surface-inset flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="bg-surface-raised rounded-xl p-8 shadow-sm border">
            <h1 className="text-xl font-bold mb-4">Check Your Email</h1>
            <p className="text-foreground-muted mb-4">
              If an account exists with that email, we've sent password reset instructions.
            </p>
            <a href="/auth/login" className="text-brand">
              Back to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-inset flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand">DiveStreams</h1>
          <p className="text-foreground-muted mt-2">Reset your password</p>
        </div>

        <form method="post" className="bg-surface-raised rounded-xl p-8 shadow-sm border">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              required
            />
            {actionData?.error && (
              <p className="text-danger text-sm mt-1">{actionData.error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 bg-brand text-white py-3 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </button>

          <a href="/auth/login" className="block text-center text-sm text-foreground-muted mt-4">
            Back to login
          </a>
        </form>
      </div>
    </div>
  );
}
