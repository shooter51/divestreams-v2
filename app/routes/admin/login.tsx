import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation } from "react-router";
import {
  validateAdminPassword,
  createAdminSessionCookie,
  isAdminAuthenticated,
  isAdminSubdomain,
} from "../../../lib/auth/admin-auth.server";

export const meta: MetaFunction = () => [{ title: "Admin Login - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  // Only allow access on admin subdomain
  if (!isAdminSubdomain(request)) {
    return redirect("https://divestreams.com");
  }

  // If already authenticated, redirect to dashboard
  if (isAdminAuthenticated(request)) {
    return redirect("/dashboard");
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const password = formData.get("password") as string;

  if (!password) {
    return { error: "Password is required" };
  }

  if (!validateAdminPassword(password)) {
    return { error: "Invalid password" };
  }

  // Create session cookie and redirect
  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": createAdminSessionCookie(),
    },
  });
}

export default function AdminLoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">DiveStreams Admin</h1>
          <p className="text-gray-600 mt-2">Enter your admin password to continue</p>
        </div>

        <form method="post" className="space-y-6">
          {actionData?.error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {actionData.error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              autoFocus
              required
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter admin password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
