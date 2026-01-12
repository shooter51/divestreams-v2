import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, useLoaderData } from "react-router";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { getTenantFromRequest } from "../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => {
  return [{ title: "Login - DiveStreams" }];
};

// Verify password against hash
function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(":");
  if (!salt || !storedHash) return false;

  const computedHash = scryptSync(password, salt, 64).toString("hex");
  const storedBuffer = Buffer.from(storedHash, "hex");
  const computedBuffer = Buffer.from(computedHash, "hex");

  if (storedBuffer.length !== computedBuffer.length) return false;
  return timingSafeEqual(storedBuffer, computedBuffer);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const tenantContext = await getTenantFromRequest(request);

  if (!tenantContext) {
    // No tenant context - redirect to main site
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

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { errors: { form: "Server configuration error" } };
  }

  const client = postgres(connectionString);
  const schemaName = tenantContext.tenant.schemaName;

  try {
    // Look up user by email
    const users = await client.unsafe(`
      SELECT id, email, name, role, password_hash, is_active
      FROM "${schemaName}".users
      WHERE email = '${email.replace(/'/g, "''")}'
      LIMIT 1
    `);

    if (users.length === 0) {
      return { errors: { form: "Invalid email or password" } };
    }

    const user = users[0];

    if (!user.is_active) {
      return { errors: { form: "Account is deactivated" } };
    }

    if (!user.password_hash) {
      return { errors: { form: "Password not set. Contact administrator." } };
    }

    // Verify password
    if (!verifyPassword(password, user.password_hash)) {
      return { errors: { form: "Invalid email or password" } };
    }

    // Create session
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await client.unsafe(`
      INSERT INTO "${schemaName}".sessions (id, user_id, expires_at, ip_address, user_agent)
      VALUES (
        '${sessionId}',
        '${user.id}',
        '${expiresAt.toISOString()}',
        '${request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"}',
        '${(request.headers.get("user-agent") || "unknown").replace(/'/g, "''").substring(0, 500)}'
      )
    `);

    // Update last login
    await client.unsafe(`
      UPDATE "${schemaName}".users
      SET last_login_at = NOW()
      WHERE id = '${user.id}'
    `);

    await client.end();

    // Set session cookie and redirect to dashboard
    return redirect("/app", {
      headers: {
        "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${7 * 24 * 60 * 60}`,
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    await client.end();
    return { errors: { form: "An error occurred. Please try again." } };
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
