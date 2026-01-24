import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, useSearchParams } from "react-router";
import { eq } from "drizzle-orm";
import { getSubdomainFromRequest, getOrgContext } from "../../../lib/auth/org-context.server";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { organization } from "../../../lib/db/schema/auth";
import { getAppUrl } from "../../../lib/utils/url";

export const meta: MetaFunction = () => {
  return [{ title: "Reset Password - DiveStreams" }];
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

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return redirect("/auth/forgot-password");
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

  return { token, tenantName: org.name };
}

export async function action({ request }: ActionFunctionArgs) {
  const subdomain = getSubdomainFromRequest(request);

  if (!subdomain) {
    return redirect(getAppUrl());
  }

  const formData = await request.formData();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const token = formData.get("token") as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  if (!token) {
    return { error: "Invalid reset token" };
  }

  try {
    await auth.api.resetPassword({
      body: { token, newPassword: password },
    });

    return redirect("/auth/login?reset=success");
  } catch (error) {
    return { error: "Invalid or expired reset token" };
  }
}

export default function ResetPasswordPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600">DiveStreams</h1>
          <p className="text-gray-600 mt-2">Create a new password</p>
        </div>

        <form method="post" className="bg-white rounded-xl p-8 shadow-sm border">
          <input type="hidden" name="token" value={token || ""} />

          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                New Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                autoComplete="new-password"
                minLength={8}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={8}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {actionData?.error && (
            <p className="text-red-500 text-sm mt-4">{actionData.error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
