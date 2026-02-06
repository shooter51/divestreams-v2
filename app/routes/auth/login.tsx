import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, useLoaderData } from "react-router";
import { eq } from "drizzle-orm";
import { getSubdomainFromRequest, getOrgContext } from "../../../lib/auth/org-context.server";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { organization } from "../../../lib/db/schema/auth";
import { getAppUrl } from "../../../lib/utils/url";
import { getSafeRedirectUrl } from "../../../lib/utils/safe-redirect";

export const meta: MetaFunction = () => {
  return [{ title: "Login - DiveStreams" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const subdomain = getSubdomainFromRequest(request);

  if (!subdomain) {
    // No subdomain - redirect to main site
    return redirect(getAppUrl());
  }

  // Check if already logged in
  const orgContext = await getOrgContext(request);
  if (orgContext) {
    return redirect("/tenant");
  }

  // Get organization name for display
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

  // Get organization
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return redirect(getAppUrl());
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
      console.error("Login failed:", {
        status: response.status,
        message: userData?.message,
        email,
      });
      return { errors: { form: userData?.message || "Invalid email or password" } };
    }

    // Get redirect URL from query params (validated to prevent open redirect)
    const url = new URL(request.url);
    const redirectTo = getSafeRedirectUrl(url.searchParams.get("redirect"), "/tenant");

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

  // Preserve form values on error
  const formData = navigation.formData;

  return (
    <div className="min-h-screen bg-surface-inset flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand">{tenantName}</h1>
          <p className="text-foreground-muted mt-2">Sign in to your account</p>
        </div>

        <form method="post" className="bg-surface-raised rounded-xl p-8 shadow-sm border">
          {actionData?.errors?.form && (
            <div className="bg-danger-muted text-danger p-3 rounded-lg mb-4">
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
                autoComplete="email"
                defaultValue={formData?.get("email")?.toString() || ""}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                required
              />
              {actionData?.errors && 'email' in actionData.errors && (
                <p className="text-danger text-sm mt-1">{(actionData.errors as Record<string, string>).email}</p>
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
                autoComplete="current-password"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                required
              />
              {actionData?.errors && 'password' in actionData.errors && (
                <p className="text-danger text-sm mt-1">{(actionData.errors as Record<string, string>).password}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 bg-brand text-white py-3 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>

          <a
            href="/auth/forgot-password"
            className="block text-center text-sm text-brand mt-4"
          >
            Forgot your password?
          </a>
        </form>
      </div>
    </div>
  );
}
