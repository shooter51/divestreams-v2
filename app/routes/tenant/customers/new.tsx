import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, useLoaderData, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { createCustomer } from "../../../../lib/db/queries.server";
import { requireLimit } from "../../../../lib/require-feature.server";
import { DEFAULT_PLAN_LIMITS } from "../../../../lib/plan-features";

export const meta: MetaFunction = () => [{ title: "Add Customer - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const limits = ctx.subscription?.planDetails?.limits ?? DEFAULT_PLAN_LIMITS.free;
  const limitCheck = await requireLimit(ctx.org.id, "customers", limits);
  return {
    limitRemaining: limitCheck.remaining,
    limitMax: limitCheck.limit,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const formData = await request.formData();

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;

  // Basic validation
  const errors: Record<string, string> = {};
  if (!firstName) errors.firstName = "First name is required";
  if (!lastName) errors.lastName = "Last name is required";
  if (!email) errors.email = "Email is required";
  else if (!email.includes("@")) errors.email = "Invalid email address";

  if (Object.keys(errors).length > 0) {
    // Convert FormData to Record<string, string> for defaultValue compatibility
    const values: Record<string, string> = {};
    formData.forEach((value, key) => {
      if (typeof value === "string") {
        values[key] = value;
      }
    });
    return { errors, values };
  }

  // Parse certifications from form
  const certAgency = formData.get("certAgency") as string;
  const certLevel = formData.get("certLevel") as string;
  const certNumber = formData.get("certNumber") as string;

  const certifications = certAgency && certLevel
    ? [{ agency: certAgency, level: certLevel, number: certNumber || undefined }]
    : undefined;

  try {
    await createCustomer(organizationId, {
      email,
      firstName,
      lastName,
      phone: formData.get("phone") as string || undefined,
      dateOfBirth: formData.get("dateOfBirth") as string || undefined,
      emergencyContactName: formData.get("emergencyContactName") as string || undefined,
      emergencyContactPhone: formData.get("emergencyContactPhone") as string || undefined,
      emergencyContactRelation: formData.get("emergencyContactRelation") as string || undefined,
      medicalConditions: formData.get("medicalConditions") as string || undefined,
      medications: formData.get("medications") as string || undefined,
      certifications,
      address: formData.get("address") as string || undefined,
      city: formData.get("city") as string || undefined,
      state: formData.get("state") as string || undefined,
      postalCode: formData.get("postalCode") as string || undefined,
      country: formData.get("country") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });

    return redirect("/tenant/customers");
  } catch (error) {
    console.error("Failed to create customer:", error);
    const values: Record<string, string> = {};
    formData.forEach((value, key) => {
      if (typeof value === "string") {
        values[key] = value;
      }
    });
    return {
      errors: { form: "Failed to create customer. Please try again." },
      values,
    };
  }
}

export default function NewCustomerPage() {
  const { limitRemaining, limitMax } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const isNearLimit = limitMax !== -1 && limitRemaining <= Math.ceil(limitMax * 0.2);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/customers" className="text-blue-600 hover:underline text-sm">
          ← Back to Customers
        </Link>
        <h1 className="text-2xl font-bold mt-2">Add Customer</h1>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                defaultValue={actionData?.values?.firstName}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {actionData?.errors?.firstName && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.firstName}</p>
              )}
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                defaultValue={actionData?.values?.lastName}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {actionData?.errors?.lastName && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.lastName}</p>
              )}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                defaultValue={actionData?.values?.email}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {actionData?.errors?.email && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.email}</p>
              )}
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-1">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                defaultValue={actionData?.values?.phone}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                defaultValue={actionData?.values?.dateOfBirth}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Certification */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Certification</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="certAgency" className="block text-sm font-medium mb-1">
                Agency
              </label>
              <select
                id="certAgency"
                name="certAgency"
                defaultValue={actionData?.values?.certAgency}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="PADI">PADI</option>
                <option value="SSI">SSI</option>
                <option value="NAUI">NAUI</option>
                <option value="SDI">SDI</option>
                <option value="BSAC">BSAC</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="certLevel" className="block text-sm font-medium mb-1">
                Level
              </label>
              <select
                id="certLevel"
                name="certLevel"
                defaultValue={actionData?.values?.certLevel}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="Open Water">Open Water</option>
                <option value="Advanced Open Water">Advanced Open Water</option>
                <option value="Rescue Diver">Rescue Diver</option>
                <option value="Divemaster">Divemaster</option>
                <option value="Instructor">Instructor</option>
              </select>
            </div>
            <div>
              <label htmlFor="certNumber" className="block text-sm font-medium mb-1">
                Cert Number
              </label>
              <input
                type="text"
                id="certNumber"
                name="certNumber"
                defaultValue={actionData?.values?.certNumber}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Emergency Contact</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="emergencyContactName" className="block text-sm font-medium mb-1">
                Name
              </label>
              <input
                type="text"
                id="emergencyContactName"
                name="emergencyContactName"
                defaultValue={actionData?.values?.emergencyContactName}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="emergencyContactPhone" className="block text-sm font-medium mb-1">
                Phone
              </label>
              <input
                type="tel"
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                defaultValue={actionData?.values?.emergencyContactPhone}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="emergencyContactRelation" className="block text-sm font-medium mb-1">
                Relationship
              </label>
              <input
                type="text"
                id="emergencyContactRelation"
                name="emergencyContactRelation"
                placeholder="e.g., Spouse, Parent"
                defaultValue={actionData?.values?.emergencyContactRelation}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Medical */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Medical Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="medicalConditions" className="block text-sm font-medium mb-1">
                Medical Conditions
              </label>
              <textarea
                id="medicalConditions"
                name="medicalConditions"
                rows={2}
                placeholder="Any conditions we should know about..."
                defaultValue={actionData?.values?.medicalConditions}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="medications" className="block text-sm font-medium mb-1">
                Current Medications
              </label>
              <textarea
                id="medications"
                name="medications"
                rows={2}
                defaultValue={actionData?.values?.medications}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Address</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-medium mb-1">
                Street Address
              </label>
              <input
                type="text"
                id="address"
                name="address"
                defaultValue={actionData?.values?.address}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2">
                <label htmlFor="city" className="block text-sm font-medium mb-1">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  defaultValue={actionData?.values?.city}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium mb-1">
                  State
                </label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  defaultValue={actionData?.values?.state}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  id="postalCode"
                  name="postalCode"
                  defaultValue={actionData?.values?.postalCode}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="country" className="block text-sm font-medium mb-1">
                Country
              </label>
              <input
                type="text"
                id="country"
                name="country"
                defaultValue={actionData?.values?.country}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Notes & Preferences */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Notes & Preferences</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Internal Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={actionData?.values?.notes}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="marketingOptIn"
                name="marketingOptIn"
                value="true"
                defaultChecked={actionData?.values?.marketingOptIn === "true"}
                className="rounded"
              />
              <label htmlFor="marketingOptIn" className="text-sm">
                Customer has opted in to marketing emails
              </label>
            </div>
          </div>
        </div>

        {/* Limit Warning */}
        {isNearLimit && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm">
              {limitRemaining} of {limitMax} customers remaining.{" "}
              <Link to="/tenant/settings/billing" className="underline font-medium">
                Upgrade for more
              </Link>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Saving..." : "Save Customer"}
          </button>
          <Link
            to="/tenant/customers"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
