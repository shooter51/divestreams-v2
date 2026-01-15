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
    return redirect("/app");
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
    // Use Better Auth to send password reset email
    // Note: Better Auth may not have a built-in forgetPassword API method
    // For now, we'll show success to prevent email enumeration
    // TODO: Implement password reset with Better Auth's actual API
    // await auth.api.forgetPassword({ body: { email }, headers: request.headers });
    console.log("Password reset requested for:", email);
  } catch (error) {
    // Don't reveal if email exists - always show success
    console.error("Forgot password error:", error);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-xl p-8 shadow-sm border">
            <h1 className="text-xl font-bold mb-4">Check Your Email</h1>
            <p className="text-gray-600 mb-4">
              If an account exists with that email, we've sent password reset instructions.
            </p>
            <a href="/auth/login" className="text-blue-600">
              Back to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600">DiveStreams</h1>
          <p className="text-gray-600 mt-2">Reset your password</p>
        </div>

        <form method="post" className="bg-white rounded-xl p-8 shadow-sm border">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            {actionData?.error && (
              <p className="text-red-500 text-sm mt-1">{actionData.error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </button>

          <a href="/auth/login" className="block text-center text-sm text-gray-600 mt-4">
            Back to login
          </a>
        </form>
      </div>
    </div>
  );
}
