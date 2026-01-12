import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation } from "react-router";

export const meta: MetaFunction = () => {
  return [{ title: "Login - DiveStreams" }];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // TODO: Implement actual authentication
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

  // TODO: Verify credentials against tenant database
  return redirect("/app");
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600">DiveStreams</h1>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </div>

        <form method="post" className="bg-white rounded-xl p-8 shadow-sm border">
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
