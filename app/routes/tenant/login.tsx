import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, useActionData, useNavigation, useSearchParams, useLoaderData, redirect } from "react-router";
import { useState } from "react";
import { auth } from "../../../lib/auth";
import { getSubdomainFromRequest } from "../../../lib/auth/org-context.server";
import { db } from "../../../lib/db";
import { organization, member } from "../../../lib/db/schema/auth";
import { eq, and } from "drizzle-orm";

type ActionData = {
  error?: string;
  notMember?: {
    orgName: string;
    orgId: string;
    userId: string;
    email: string;
  };
};

export const meta: MetaFunction = () => [{ title: "Login - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  // Check if already logged in
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  });

  if (sessionData?.user) {
    // Already logged in, redirect to app
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get("redirect") || "/app";
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

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const redirectTo = formData.get("redirectTo");

  // Validate redirectTo and default to /app
  const validatedRedirectTo = typeof redirectTo === "string" ? redirectTo : "/app";

  // Handle "join" intent - user wants to join org as customer
  if (intent === "join") {
    const userId = formData.get("userId");
    const orgId = formData.get("orgId");

    // Null check before using
    if (typeof userId !== "string" || typeof orgId !== "string" || !userId || !orgId) {
      return { error: "Missing user or organization information" };
    }

    try {
      // Check if user is already a member (edge case)
      const [existingMember] = await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, orgId)
          )
        )
        .limit(1);

      if (!existingMember) {
        // Add user as customer
        await db.insert(member).values({
          id: crypto.randomUUID(),
          userId,
          organizationId: orgId,
          role: "customer",
          createdAt: new Date(),
        });
      }

      // Redirect to app
      return redirect(validatedRedirectTo);
    } catch (error) {
      console.error("Join error:", error);
      return { error: "Failed to join organization. Please try again." };
    }
  }

  // Handle normal login
  const email = formData.get("email");
  const password = formData.get("password");

  // Validate email and password with null checks
  if (typeof email !== "string" || !email || !emailRegex.test(email)) {
    return { error: "Please enter a valid email address" };
  }

  if (typeof password !== "string" || !password) {
    return { error: "Password is required" };
  }

  try {
    // Call Better Auth sign in API
    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });

    // Get cookies FIRST before reading body
    const cookies = response.headers.get("set-cookie");

    // Get user data from response to check membership
    const userData = await response.json();

    if (!response.ok) {
      return { error: userData.message || "Invalid email or password" };
    }

    const userId = userData?.user?.id;

    // Check if user is a member of the current org
    const subdomain = getSubdomainFromRequest(request);

    if (subdomain && userId) {
      const [org] = await db
        .select({ id: organization.id, name: organization.name })
        .from(organization)
        .where(eq(organization.slug, subdomain))
        .limit(1);

      if (org) {
        // Check membership
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
          // User is NOT a member - return with cookies so they stay logged in
          // and show the "not a member" UI
          return Response.json(
            {
              notMember: {
                orgName: org.name,
                orgId: org.id,
                userId,
                email,
              },
            } as ActionData,
            {
              headers: cookies ? { "Set-Cookie": cookies } : {},
            }
          );
        }
      }
    }

    // User is a member (or no subdomain), redirect to app
    return redirect(validatedRedirectTo, {
      headers: cookies ? { "Set-Cookie": cookies } : {},
    });
  } catch (error) {
    console.error("Login error:", error);
    return { error: "An error occurred during login. Please try again." };
  }
}

export default function LoginPage() {
  const { orgName } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  const isSubmitting = navigation.state === "submitting";
  const redirectTo = searchParams.get("redirect") || "/app";

  // Show "Not a member" UI if user is authenticated but not a member of this org
  if (actionData?.notMember) {
    const { orgName: shopName, orgId, userId, email } = actionData.notMember;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Warning Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Not a member of {shopName}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You signed in as <span className="font-medium">{email}</span>, but you are not a member of this shop yet.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10">
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="join" />
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="redirectTo" value={redirectTo} />

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Joining...
                  </span>
                ) : (
                  `Join ${shopName} as Customer`
                )}
              </button>
            </Form>

            <div className="mt-4 text-center">
              <Link
                to="/"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Go back to homepage
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Welcome back! Please enter your details.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm rounded-xl sm:px-10">
          {/* Error Message */}
          {actionData?.error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{actionData.error}</p>
            </div>
          )}

          <Form method="post" className="space-y-6">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
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

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </Form>

          {/* Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Not a member yet?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to={`/signup${redirectTo !== "/app" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
                className="w-full flex justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>

        {/* Join as customer prompt */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Not a member of {orgName}?{" "}
          <Link
            to={`/signup?role=customer${redirectTo !== "/app" ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Join as a customer
          </Link>
        </p>
      </div>
    </div>
  );
}
