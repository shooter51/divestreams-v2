import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { eq, and } from "drizzle-orm";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getCustomerById } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { customerSchema, validateFormData, getFormValues } from "../../../../../lib/validation";
import { redirectWithNotification, useNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Edit Customer - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const customerId = params.id;

  if (!customerId) {
    throw new Response("Customer ID required", { status: 400 });
  }

  const customerData = await getCustomerById(organizationId, customerId);

  if (!customerData) {
    throw new Response("Customer not found", { status: 404 });
  }

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return "";
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  const customer = {
    id: customerData.id,
    firstName: customerData.firstName,
    lastName: customerData.lastName,
    email: customerData.email,
    phone: customerData.phone || "",
    dateOfBirth: formatDate(customerData.dateOfBirth),
    address: customerData.address || "",
    city: customerData.city || "",
    state: customerData.state || "",
    postalCode: customerData.postalCode || "",
    country: customerData.country || "",
    preferredLanguage: customerData.preferredLanguage || "en",
    emergencyContactName: customerData.emergencyContactName || "",
    emergencyContactPhone: customerData.emergencyContactPhone || "",
    emergencyContactRelation: customerData.emergencyContactRelation || "",
    medicalConditions: customerData.medicalConditions || "",
    medications: customerData.medications || "",
    notes: customerData.notes || "",
    marketingOptIn: customerData.marketingOptIn,
  };

  return { customer };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const customerId = params.id;

  if (!customerId) {
    throw new Response("Customer ID required", { status: 400 });
  }

  const formData = await request.formData();
  const validation = validateFormData(formData, customerSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Update customer in database
  const { db, schema } = getTenantDb(organizationId);

  await db
    .update(schema.customers)
    .set({
      firstName: validation.data.firstName,
      lastName: validation.data.lastName,
      email: validation.data.email,
      phone: validation.data.phone,
      dateOfBirth: validation.data.dateOfBirth,
      address: validation.data.address,
      city: validation.data.city,
      state: validation.data.state,
      postalCode: validation.data.postalCode,
      country: validation.data.country,
      preferredLanguage: validation.data.preferredLanguage,
      emergencyContactName: validation.data.emergencyContactName,
      emergencyContactPhone: validation.data.emergencyContactPhone,
      emergencyContactRelation: validation.data.emergencyContactRelation,
      medicalConditions: validation.data.medicalConditions,
      medications: validation.data.medications,
      notes: validation.data.notes,
      marketingOptIn: validation.data.marketingOptIn,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.customers.organizationId, organizationId), eq(schema.customers.id, customerId)));

  const customerName = `${validation.data.firstName} ${validation.data.lastName}`;
  return redirect(redirectWithNotification(`/tenant/customers/${customerId}`, `Customer "${customerName}" has been successfully updated`, "success"));
}

export default function EditCustomerPage() {
  const { customer } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Show notifications from URL params
  useNotification();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/tenant/customers/${customer.id}`} className="text-brand hover:underline text-sm">
          ← Back to Customer
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Customer</h1>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  defaultValue={actionData?.values?.firstName || customer.firstName}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  required
                  defaultValue={actionData?.values?.lastName || customer.lastName}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                defaultValue={actionData?.values?.email || customer.email}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  defaultValue={actionData?.values?.phone || customer.phone}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                  defaultValue={actionData?.values?.dateOfBirth || customer.dateOfBirth}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label htmlFor="preferredLanguage" className="block text-sm font-medium mb-1">
                Preferred Language
              </label>
              <select
                id="preferredLanguage"
                name="preferredLanguage"
                defaultValue={actionData?.values?.preferredLanguage || customer.preferredLanguage}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                defaultValue={actionData?.values?.address || customer.address}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium mb-1">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  defaultValue={actionData?.values?.city || customer.city}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium mb-1">
                  State/Province
                </label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  defaultValue={actionData?.values?.state || customer.state}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  id="postalCode"
                  name="postalCode"
                  defaultValue={actionData?.values?.postalCode || customer.postalCode}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="country" className="block text-sm font-medium mb-1">
                  Country
                </label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  defaultValue={actionData?.values?.country || customer.country}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Emergency Contact</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="emergencyContactName" className="block text-sm font-medium mb-1">
                Contact Name
              </label>
              <input
                type="text"
                id="emergencyContactName"
                name="emergencyContactName"
                defaultValue={actionData?.values?.emergencyContactName || customer.emergencyContactName}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="emergencyContactPhone" className="block text-sm font-medium mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  id="emergencyContactPhone"
                  name="emergencyContactPhone"
                  defaultValue={actionData?.values?.emergencyContactPhone || customer.emergencyContactPhone}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                  defaultValue={actionData?.values?.emergencyContactRelation || customer.emergencyContactRelation}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Medical */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                defaultValue={actionData?.values?.medicalConditions || customer.medicalConditions}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                defaultValue={actionData?.values?.medications || customer.medications}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Notes & Preferences */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Notes & Preferences</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={actionData?.values?.notes || customer.notes}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="marketingOptIn"
                value="true"
                defaultChecked={actionData?.values?.marketingOptIn !== "false" && !!customer.marketingOptIn}
                className="rounded"
              />
              <span className="text-sm">Opt in to marketing emails</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            to={`/tenant/customers/${customer.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
