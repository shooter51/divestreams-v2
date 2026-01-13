import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { db } from "../../../lib/db";
import { organization, member, user, account } from "../../../lib/db/schema/auth";
import { subscription } from "../../../lib/db/schema/subscription";
import { eq } from "drizzle-orm";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import { auth } from "../../../lib/auth";

export const meta: MetaFunction = () => [{ title: "Create Organization - DiveStreams Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  // Require platform admin access
  await requirePlatformContext(request);

  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  // Require platform admin access
  await requirePlatformContext(request);

  const formData = await request.formData();

  const slug = (formData.get("slug") as string)?.toLowerCase().trim();
  const name = formData.get("name") as string;
  const ownerEmail = formData.get("ownerEmail") as string;
  const ownerName = formData.get("ownerName") as string;
  const ownerPassword = formData.get("ownerPassword") as string;
  const plan = formData.get("plan") as string || "free";
  const createOwnerAccount = formData.get("createOwnerAccount") === "on";

  // Validation
  const errors: Record<string, string> = {};
  if (!slug) errors.slug = "Slug is required";
  else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) {
    errors.slug = "Invalid slug format (lowercase letters, numbers, and hyphens only)";
  }
  if (!name) errors.name = "Organization name is required";
  if (createOwnerAccount) {
    if (!ownerEmail) errors.ownerEmail = "Owner email is required";
    if (!ownerPassword || ownerPassword.length < 8) {
      errors.ownerPassword = "Password must be at least 8 characters";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Check slug availability
  const [existingOrg] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);

  if (existingOrg) {
    return { errors: { slug: "This slug is already taken" } };
  }

  try {
    // Generate IDs
    const orgId = crypto.randomUUID();

    // Create the organization
    await db.insert(organization).values({
      id: orgId,
      slug,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create subscription record
    await db.insert(subscription).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      plan: plan as "free" | "premium",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create owner account if requested
    if (createOwnerAccount && ownerEmail && ownerPassword) {
      // Check if user already exists
      let [existingUser] = await db
        .select()
        .from(user)
        .where(eq(user.email, ownerEmail))
        .limit(1);

      let userId: string;

      if (existingUser) {
        // User exists, just add them as owner
        userId = existingUser.id;
      } else {
        // Create new user via Better Auth
        userId = crypto.randomUUID();
        await db.insert(user).values({
          id: userId,
          email: ownerEmail,
          name: ownerName || ownerEmail.split("@")[0],
          emailVerified: true, // Admin-created accounts are verified
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Hash password and create account
        // Better Auth uses bcrypt, but we'll use the standard API
        const hashedPassword = await hashPassword(ownerPassword);
        await db.insert(account).values({
          id: crypto.randomUUID(),
          userId,
          accountId: userId,
          providerId: "credential",
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Add user as organization owner
      await db.insert(member).values({
        id: crypto.randomUUID(),
        userId,
        organizationId: orgId,
        role: "owner",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return redirect("/dashboard");
  } catch (error) {
    console.error("Failed to create organization:", error);
    return { errors: { form: "Failed to create organization. Please try again." } };
  }
}

// Simple password hashing using Web Crypto API (compatible with Better Auth)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    data,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256
  );

  // Combine salt and hash, then encode as base64
  const combined = new Uint8Array(salt.length + hash.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(hash), salt.length);

  return btoa(String.fromCharCode(...combined));
}

export default function CreateOrganizationPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/dashboard" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Organizations
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create Organization</h1>
        <p className="text-gray-600 mt-1">
          Create a new organization (dive shop) on the platform.
        </p>
      </div>

      <form method="post" className="bg-white rounded-xl p-6 shadow-sm space-y-6">
        {actionData?.errors?.form && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {actionData.errors.form}
          </div>
        )}

        {/* Organization Details */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">Organization Details</h2>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium mb-1">
              Slug (URL) *
            </label>
            <div className="flex items-center">
              <input
                type="text"
                id="slug"
                name="slug"
                placeholder="my-dive-shop"
                pattern="[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9]"
                className="flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="bg-gray-100 px-3 py-2 border border-l-0 rounded-r-lg text-gray-500">
                .divestreams.com
              </span>
            </div>
            {actionData?.errors?.slug && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.slug}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Organization Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="My Dive Shop"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            {actionData?.errors?.name && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="plan" className="block text-sm font-medium mb-1">
              Subscription Plan
            </label>
            <select
              id="plan"
              name="plan"
              defaultValue="free"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>

        {/* Owner Account */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="createOwnerAccount"
              name="createOwnerAccount"
              defaultChecked
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="createOwnerAccount" className="font-semibold text-gray-900">
              Create Owner Account
            </label>
          </div>

          <div className="pl-7 space-y-4">
            <div>
              <label htmlFor="ownerEmail" className="block text-sm font-medium mb-1">
                Owner Email
              </label>
              <input
                type="email"
                id="ownerEmail"
                name="ownerEmail"
                placeholder="owner@example.com"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {actionData?.errors?.ownerEmail && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.ownerEmail}</p>
              )}
            </div>

            <div>
              <label htmlFor="ownerName" className="block text-sm font-medium mb-1">
                Owner Name
              </label>
              <input
                type="text"
                id="ownerName"
                name="ownerName"
                placeholder="John Smith"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="ownerPassword" className="block text-sm font-medium mb-1">
                Owner Password
              </label>
              <input
                type="password"
                id="ownerPassword"
                name="ownerPassword"
                placeholder="Minimum 8 characters"
                minLength={8}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {actionData?.errors?.ownerPassword && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.ownerPassword}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                The owner can change this after logging in
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Creating..." : "Create Organization"}
          </button>
          <Link to="/dashboard" className="px-6 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
