import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, useSearchParams, useLoaderData } from "react-router";
import { scryptSync, randomBytes } from "node:crypto";
import postgres from "postgres";
import { getTenantFromRequest } from "../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => {
  return [{ title: "Reset Password - DiveStreams" }];
};

// Hash password using scrypt
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const tenantContext = await getTenantFromRequest(request);

  if (!tenantContext) {
    return redirect("https://divestreams.com");
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return redirect("/auth/forgot-password");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return redirect("/auth/forgot-password");
  }

  const client = postgres(connectionString);
  const schemaName = tenantContext.tenant.schemaName;

  try {
    // Verify token exists and is not expired
    const tokens = await client.unsafe(`
      SELECT id, user_id, expires_at
      FROM "${schemaName}".password_reset_tokens
      WHERE token = '${token.replace(/'/g, "''")}'
      LIMIT 1
    `);

    await client.end();

    if (tokens.length === 0) {
      return redirect("/auth/forgot-password?error=invalid");
    }

    const resetToken = tokens[0];
    if (new Date(resetToken.expires_at) < new Date()) {
      return redirect("/auth/forgot-password?error=expired");
    }

    return { token, tenantName: tenantContext.tenant.name };
  } catch (error) {
    console.error("Token verification error:", error);
    await client.end();
    return redirect("/auth/forgot-password");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const tenantContext = await getTenantFromRequest(request);

  if (!tenantContext) {
    return redirect("https://divestreams.com");
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

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { error: "Server configuration error" };
  }

  const client = postgres(connectionString);
  const schemaName = tenantContext.tenant.schemaName;

  try {
    // Find and validate token
    const tokens = await client.unsafe(`
      SELECT id, user_id, expires_at
      FROM "${schemaName}".password_reset_tokens
      WHERE token = '${token.replace(/'/g, "''")}'
      LIMIT 1
    `);

    if (tokens.length === 0) {
      await client.end();
      return { error: "Invalid or expired reset token" };
    }

    const resetToken = tokens[0];
    if (new Date(resetToken.expires_at) < new Date()) {
      await client.end();
      return { error: "Reset token has expired" };
    }

    // Hash the new password
    const passwordHash = hashPassword(password);

    // Update user's password
    await client.unsafe(`
      UPDATE "${schemaName}".users
      SET password_hash = '${passwordHash}', updated_at = NOW()
      WHERE id = '${resetToken.user_id}'
    `);

    // Delete the used token
    await client.unsafe(`
      DELETE FROM "${schemaName}".password_reset_tokens
      WHERE id = '${resetToken.id}'
    `);

    await client.end();

    return redirect("/auth/login?reset=success");
  } catch (error) {
    console.error("Password reset error:", error);
    await client.end();
    return { error: "An error occurred. Please try again." };
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
