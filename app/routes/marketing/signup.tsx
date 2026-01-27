import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation } from "react-router";
import { createTenant, isSubdomainAvailable } from "../../../lib/db/tenant.server";
import { triggerWelcomeEmail } from "../../../lib/email/triggers";
import { getTenantUrl } from "../../../lib/utils/url";
import { hashPassword } from "../../../lib/auth/password.server";
import { db } from "../../../lib/db";
import { user, account, member, organization } from "../../../lib/db/schema/auth";
import { customers } from "../../../lib/db/schema";
import { eq, sql } from "drizzle-orm";

export const meta: MetaFunction = () => {
  return [
    { title: "Start Free Trial - DiveStreams" },
    { name: "description", content: "Start your 14-day free trial of DiveStreams dive shop management software." },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const shopName = formData.get("shopName") as string;
  const subdomain = formData.get("subdomain") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  const errors: Record<string, string> = {};

  // Validation
  if (!shopName || shopName.length < 2) {
    errors.shopName = "Shop name is required";
  }

  if (!subdomain || subdomain.length < 3) {
    errors.subdomain = "Subdomain must be at least 3 characters";
  } else {
    const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    if (!subdomainRegex.test(subdomain.toLowerCase())) {
      errors.subdomain = "Only lowercase letters, numbers, and hyphens allowed";
    } else {
      const reserved = ["www", "api", "admin", "app", "mail", "smtp", "ftp", "blog", "help", "support", "status"];
      if (reserved.includes(subdomain.toLowerCase())) {
        errors.subdomain = "This subdomain is reserved";
      } else {
        const available = await isSubdomainAvailable(subdomain);
        if (!available) {
          errors.subdomain = "This subdomain is already taken";
        }
      }
    }
  }

  if (!email || !email.includes("@")) {
    errors.email = "Valid email is required";
  } else {
    // Check for existing user with this email
    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existingUser) {
      // Check if user has any organization memberships
      const [membership] = await db
        .select({ id: member.id })
        .from(member)
        .where(eq(member.userId, existingUser.id))
        .limit(1);

      if (membership) {
        // User has an active organization - can't sign up again
        errors.email = "An account with this email already exists";
      } else {
        // Orphaned user with no organization - delete it so signup can proceed
        await db.delete(user).where(eq(user.id, existingUser.id));
        await db.delete(account).where(eq(account.userId, existingUser.id));
      }
    } else {
      // Check if email exists as a customer
      const existingCustomer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.email, email))
        .limit(1);
      if (existingCustomer.length > 0) {
        errors.email = "This email is already registered as a customer";
      }
    }
  }

  if (!password || password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values: { shopName, subdomain, email, phone } };
  }

  try {
    const tenant = await createTenant({
      subdomain: subdomain.toLowerCase(),
      name: shopName,
      email,
      phone: phone || undefined,
    });

    // Look up the organization created by createTenant
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, subdomain.toLowerCase()))
      .limit(1);

    if (!org) {
      throw new Error("Organization not found after tenant creation");
    }

    // Create user, credential account, and org membership atomically
    const userId = crypto.randomUUID();
    const hashedPassword = await hashPassword(password);

    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        email,
        emailVerified: false,
        name: shopName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(account).values({
        id: crypto.randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(member).values({
        id: crypto.randomUUID(),
        userId,
        organizationId: org.id,
        role: "owner",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Queue welcome email
    try {
      await triggerWelcomeEmail({
        userEmail: email,
        userName: shopName,
        shopName: tenant.name,
        subdomain: tenant.subdomain,
        tenantId: tenant.id,
      });
    } catch (emailError) {
      console.error("Failed to queue welcome email:", emailError);
    }

    // Redirect to the new tenant's login page so user can sign in
    return redirect(getTenantUrl(tenant.subdomain, "/auth/login"));
  } catch (error) {
    console.error("Failed to create account:", error);
    return {
      errors: { form: "Failed to create account. Please try again." },
      values: { shopName, subdomain, email, phone },
    };
  }
}

export default function SignupPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-surface-inset">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-brand">
          DiveStreams
        </a>
        <div className="flex gap-6 items-center">
          <a href="/features" className="text-foreground-muted hover:text-brand">
            Features
          </a>
          <a href="/pricing" className="text-foreground-muted hover:text-brand">
            Pricing
          </a>
        </div>
      </nav>

      {/* Signup Form */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Start Your Free Trial</h1>
          <p className="text-foreground-muted text-center mb-8">
            14 days free. No credit card required.
          </p>

          <form method="post" className="bg-surface-raised rounded-xl p-8 shadow-sm border">
            {actionData?.errors?.form && (
              <div className="bg-danger-muted text-danger p-3 rounded-lg mb-6">
                {actionData.errors.form}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="shopName" className="block text-sm font-medium mb-1">
                  Dive Shop Name
                </label>
                <input
                  type="text"
                  id="shopName"
                  name="shopName"
                  defaultValue={actionData?.values?.shopName}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="Paradise Dive Center"
                  required
                />
                {actionData?.errors?.shopName && (
                  <p className="text-danger text-sm mt-1">{actionData.errors.shopName}</p>
                )}
              </div>

              <div>
                <label htmlFor="subdomain" className="block text-sm font-medium mb-1">
                  Choose Your URL
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    id="subdomain"
                    name="subdomain"
                    defaultValue={actionData?.values?.subdomain}
                    className="flex-1 px-4 py-2 border rounded-l-lg focus:ring-2 focus:ring-brand focus:border-brand"
                    placeholder="paradise"
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    required
                  />
                  <span className="bg-surface-inset px-4 py-2 border border-l-0 rounded-r-lg text-foreground-muted">
                    .divestreams.com
                  </span>
                </div>
                {actionData?.errors?.subdomain && (
                  <p className="text-danger text-sm mt-1">{actionData.errors.subdomain}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  defaultValue={actionData?.values?.email}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="owner@diveshop.com"
                  required
                />
                {actionData?.errors?.email && (
                  <p className="text-danger text-sm mt-1">{actionData.errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-1">
                  Phone Number <span className="text-foreground-subtle">(optional)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  defaultValue={actionData?.values?.phone}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="Min 8 characters"
                  minLength={8}
                  required
                />
                {actionData?.errors?.password && (
                  <p className="text-danger text-sm mt-1">{actionData.errors.password}</p>
                )}
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
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="Re-enter your password"
                  minLength={8}
                  required
                />
                {actionData?.errors?.confirmPassword && (
                  <p className="text-danger text-sm mt-1">{actionData.errors.confirmPassword}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 bg-brand text-white py-3 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
            >
              {isSubmitting ? "Creating Your Account..." : "Start Free Trial"}
            </button>

            <p className="text-center text-sm text-foreground-muted mt-4">
              By signing up, you agree to our{" "}
              <a href="/terms" className="text-brand">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-brand">
                Privacy Policy
              </a>
            </p>
          </form>

          <p className="text-center text-foreground-muted mt-6">
            Already have an account?{" "}
            <a href="/auth/login" className="text-brand">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
