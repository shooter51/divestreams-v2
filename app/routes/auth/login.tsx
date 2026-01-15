import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, useLoaderData } from "react-router";
import { eq } from "drizzle-orm";
import { getSubdomainFromRequest, getOrgContext } from "../../../lib/auth/org-context.server";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { organization } from "../../../lib/db/schema/auth";

export const meta: MetaFunction = () => {
  return [{ title: "Login - DiveStreams" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const subdomain = getSubdomainFromRequest(request);

  if (!subdomain) {
    // No subdomain - redirect to main site
    return redirect("https://divestreams.com");
  }

  // Check if already logged in
  const orgContext = await getOrgContext(request);
  if (orgContext) {
    return redirect("/app");
  }

  // Get organization name for display
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return redirect("https://divestreams.com");
  }

  return { tenantName: org.name };
}

export async function action({ request }: ActionFunctionArgs) {
  const subdomain = getSubdomainFromRequest(request);

  if (!subdomain) {
    return redirect("https://divestreams.com");
  }

  // Get organization
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return redirect("https://divestreams.com");
  }

  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const errors: Record<string, string> = {};

  if (!email) {
    errors.email = "Email is required";
  }
  if (!password) {
    errors.password = "Password is required";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    // Sign in using Better Auth - use asResponse to get full response with cookies
    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });

    // Get cookies FIRST before reading body
    const cookies = response.headers.get("set-cookie");

    // Parse response to check success
    const userData = await response.json();

    if (!response.ok || !userData?.user) {
      return { errors: { form: userData?.message || "Invalid email or password" } };
    }

    // Get redirect URL from query params
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get("redirect") || "/app";

    // Redirect to app WITH the session cookies
    return redirect(redirectTo, {
      headers: cookies ? { "Set-Cookie": cookies } : {},
    });
  } catch (error) {
    console.error("Login error:", error);
    return { errors: { form: "Invalid email or password" } };
  }
}

export default function LoginPage() {
  const { tenantName } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600">{tenantName}</h1>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </div>

        <form method="post" className="bg-white rounded-xl p-8 shadow-sm border">
          {actionData?.errors?.form && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
              {actionData.errors.form}
            </div>
          )}

          <div className="space-y-4">
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
              {actionData?.errors?.email && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {actionData?.errors?.password && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.password}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>

          <a
            href="/auth/forgot-password"
            className="block text-center text-sm text-blue-600 mt-4"
          >
            Forgot your password?
          </a>
        </form>
      </div>
    </div>
  );
}
