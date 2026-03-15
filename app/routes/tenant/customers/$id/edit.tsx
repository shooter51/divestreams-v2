import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { eq, and } from "drizzle-orm";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import { getCustomerById } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { customerSchema, validateFormData, getFormValues } from "../../../../../lib/validation";
import { redirectWithNotification, useNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";
import { useT } from "../../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Edit Customer - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
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

  const firstCert = Array.isArray(customerData.certifications) && customerData.certifications.length > 0
    ? customerData.certifications[0]
    : null;

  const customer = {
    id: customerData.id,
    firstName: customerData.firstName,
    lastName: customerData.lastName,
    email: customerData.email,
    phone: customerData.phone || "",
    dateOfBirth: formatDate(customerData.dateOfBirth),
    certAgency: firstCert?.agency || "",
    certLevel: firstCert?.level || "",
    certNumber: firstCert?.number || "",
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
  requireRole(ctx, ["owner", "admin"]);
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

  // Parse certifications from flat form fields
  const certAgency = formData.get("certAgency") as string;
  const certLevel = formData.get("certLevel") as string;
  const certNumber = formData.get("certNumber") as string;
  const certifications = certAgency && certLevel
    ? [{ agency: certAgency, level: certLevel, number: certNumber || undefined }]
    : null;

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
      certifications,
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
  const t = useT();

  // Show notifications from URL params
  useNotification();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/tenant/customers/${customer.id}`} className="text-brand hover:underline text-sm">
          {t("tenant.customers.backToCustomer")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.customers.editCustomer")}</h1>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.customers.basicInfo")}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                  {t("common.firstName")} *
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
                  {t("common.lastName")} *
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
                {t("common.email")} *
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
                  {t("common.phone")}
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
                  {t("common.dateOfBirth")}
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
                {t("tenant.customers.preferredLanguage")}
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

        {/* Certification */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.customers.certificationSection")}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="certAgency" className="block text-sm font-medium mb-1">
                {t("tenant.customers.agency")}
              </label>
              <select
                id="certAgency"
                name="certAgency"
                defaultValue={actionData?.values?.certAgency || customer.certAgency}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              >
                <option value="">{t("common.selectPlaceholder")}</option>
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
                {t("tenant.customers.levelLabel")}
              </label>
              <select
                id="certLevel"
                name="certLevel"
                defaultValue={actionData?.values?.certLevel || customer.certLevel}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              >
                <option value="">{t("common.selectPlaceholder")}</option>
                <option value="Open Water">Open Water</option>
                <option value="Advanced Open Water">Advanced Open Water</option>
                <option value="Rescue Diver">Rescue Diver</option>
                <option value="Divemaster">Divemaster</option>
                <option value="Instructor">Instructor</option>
              </select>
            </div>
            <div>
              <label htmlFor="certNumber" className="block text-sm font-medium mb-1">
                {t("tenant.customers.certNumber")}
              </label>
              <input
                type="text"
                id="certNumber"
                name="certNumber"
                defaultValue={actionData?.values?.certNumber || customer.certNumber}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.customers.addressSection")}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="address" className="block text-sm font-medium mb-1">
                {t("common.streetAddress")}
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
                  {t("common.city")}
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
                  {t("common.stateProvince")}
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
                  {t("common.postalCode")}
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
                  {t("common.country")}
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
          <h2 className="font-semibold mb-4">{t("tenant.customers.emergencyContact")}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="emergencyContactName" className="block text-sm font-medium mb-1">
                {t("tenant.customers.contactName")}
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
                  {t("tenant.customers.contactPhone")}
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
                  {t("tenant.customers.relationship")}
                </label>
                <input
                  type="text"
                  id="emergencyContactRelation"
                  name="emergencyContactRelation"
                  placeholder={t("tenant.customers.emergencyRelationPlaceholderEdit")}
                  defaultValue={actionData?.values?.emergencyContactRelation || customer.emergencyContactRelation}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Medical */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.customers.medicalInfo")}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="medicalConditions" className="block text-sm font-medium mb-1">
                {t("tenant.customers.medicalConditions")}
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
                {t("tenant.customers.currentMedications")}
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
          <h2 className="font-semibold mb-4">{t("tenant.customers.notesPreferences")}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                {t("common.notes")}
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
              <span className="text-sm">{t("tenant.customers.optInMarketing")}</span>
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
            {isSubmitting ? t("common.saving") : t("common.saveChanges")}
          </button>
          <Link
            to={`/tenant/customers/${customer.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
