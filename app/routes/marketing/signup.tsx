import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation } from "react-router";
import { createTenant, isSubdomainAvailable } from "../../../lib/db/tenant.server";
import { triggerWelcomeEmail } from "../../../lib/email/triggers";
import { getTenantUrl } from "../../../lib/utils/url";

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

    // Redirect to the new tenant's onboarding
    return redirect(getTenantUrl(tenant.subdomain, "/tenant"));
  } catch (error) {
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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-blue-600">
          DiveStreams
        </a>
        <div className="flex gap-6 items-center">
          <a href="/features" className="text-gray-600 hover:text-blue-600">
            Features
          </a>
          <a href="/pricing" className="text-gray-600 hover:text-blue-600">
            Pricing
          </a>
        </div>
      </nav>

      {/* Signup Form */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Start Your Free Trial</h1>
          <p className="text-gray-600 text-center mb-8">
            14 days free. No credit card required.
          </p>

          <form method="post" className="bg-white rounded-xl p-8 shadow-sm border">
            {actionData?.errors?.form && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6">
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
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Paradise Dive Center"
                  required
                />
                {actionData?.errors?.shopName && (
                  <p className="text-red-500 text-sm mt-1">{actionData.errors.shopName}</p>
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
                    className="flex-1 px-4 py-2 border rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="paradise"
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    required
                  />
                  <span className="bg-gray-100 px-4 py-2 border border-l-0 rounded-r-lg text-gray-500">
                    .divestreams.com
                  </span>
                </div>
                {actionData?.errors?.subdomain && (
                  <p className="text-red-500 text-sm mt-1">{actionData.errors.subdomain}</p>
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
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="owner@diveshop.com"
                  required
                />
                {actionData?.errors?.email && (
                  <p className="text-red-500 text-sm mt-1">{actionData.errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-1">
                  Phone Number <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  defaultValue={actionData?.values?.phone}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isSubmitting ? "Creating Your Account..." : "Start Free Trial"}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              By signing up, you agree to our{" "}
              <a href="/terms" className="text-blue-600">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-blue-600">
                Privacy Policy
              </a>
            </p>
          </form>

          <p className="text-center text-gray-600 mt-6">
            Already have an account?{" "}
            <a href="/auth/login" className="text-blue-600">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
