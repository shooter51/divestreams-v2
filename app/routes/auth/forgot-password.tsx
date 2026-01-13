import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, useLoaderData } from "react-router";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { getTenantFromRequest } from "../../../lib/auth/tenant-auth.server";
import { sendEmail, passwordResetEmail } from "../../../lib/email/index";

export const meta: MetaFunction = () => {
  return [{ title: "Forgot Password - DiveStreams" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const tenantContext = await getTenantFromRequest(request);

  if (!tenantContext) {
    return redirect("https://divestreams.com");
  }

  return { tenantName: tenantContext.tenant.name };
}

export async function action({ request }: ActionFunctionArgs) {
  const tenantContext = await getTenantFromRequest(request);

  if (!tenantContext) {
    return redirect("https://divestreams.com");
  }

  const formData = await request.formData();
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Still return success to prevent email enumeration
    return { success: true };
  }

  const client = postgres(connectionString);
  const schemaName = tenantContext.tenant.schemaName;

  try {
    // Look up user by email
    const users = await client.unsafe(`
      SELECT id, name, email
      FROM "${schemaName}".users
      WHERE email = '${email.replace(/'/g, "''")}'
      AND is_active = true
      LIMIT 1
    `);

    if (users.length > 0) {
      const user = users[0];

      // Generate secure reset token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Delete any existing tokens for this user
      await client.unsafe(`
        DELETE FROM "${schemaName}".password_reset_tokens
        WHERE user_id = '${user.id}'
      `);

      // Store reset token
      await client.unsafe(`
        INSERT INTO "${schemaName}".password_reset_tokens (user_id, token, expires_at)
        VALUES ('${user.id}', '${token}', '${expiresAt.toISOString()}')
      `);

      // Build reset URL
      const url = new URL(request.url);
      const resetUrl = `${url.protocol}//${url.host}/auth/reset-password?token=${token}`;

      // Send password reset email
      const emailContent = passwordResetEmail({
        userName: user.name,
        resetUrl,
      });

      await sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    }

    await client.end();
  } catch (error) {
    console.error("Forgot password error:", error);
    await client.end();
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
