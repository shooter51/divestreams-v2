import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import { getTourById } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { tourSchema, validateFormData, getFormValues } from "../../../../../lib/validation";
import { ImageManager, type Image } from "../../../../components/ui";
import { redirectWithNotification, useNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";
import { enqueueTranslation } from "../../../../../lib/jobs/index";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "../../../../i18n/types";
import { useT } from "../../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Edit Tour - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const tourId = params.id;

  if (!tourId) {
    throw new Response("Tour ID required", { status: 400 });
  }

  const tourData = await getTourById(organizationId, tourId);

  if (!tourData) {
    throw new Response("Tour not found", { status: 404 });
  }

  // Get images
  const { db, schema } = getTenantDb(organizationId);
  const tourImages = await db
    .select({
      id: schema.images.id,
      url: schema.images.url,
      thumbnailUrl: schema.images.thumbnailUrl,
      filename: schema.images.filename,
      width: schema.images.width,
      height: schema.images.height,
      alt: schema.images.alt,
      sortOrder: schema.images.sortOrder,
      isPrimary: schema.images.isPrimary,
    })
    .from(schema.images)
    .where(
      and(
        eq(schema.images.organizationId, organizationId),
        eq(schema.images.entityType, "tour"),
        eq(schema.images.entityId, tourId)
      )
    )
    .orderBy(asc(schema.images.sortOrder));

  const tour = {
    id: tourData.id,
    name: tourData.name,
    description: tourData.description || "",
    type: tourData.type,
    duration: tourData.duration || 120,
    maxParticipants: tourData.maxParticipants,
    minParticipants: tourData.minParticipants || 1,
    price: tourData.price.toString(),
    currency: tourData.currency || "USD",
    includesEquipment: tourData.includesEquipment || false,
    includesMeals: tourData.includesMeals || false,
    includesTransport: tourData.includesTransport || false,
    inclusions: tourData.inclusions || [],
    exclusions: tourData.exclusions || [],
    minCertLevel: tourData.minCertLevel || "",
    minAge: tourData.minAge || null,
    requirements: tourData.requirements || [],
    isActive: tourData.isActive,
    requiresTankSelection: tourData.requiresTankSelection || false,
  };

  const images: Image[] = tourImages.map((img) => ({
    id: img.id,
    url: img.url,
    thumbnailUrl: img.thumbnailUrl || img.url,
    filename: img.filename,
    width: img.width ?? undefined,
    height: img.height ?? undefined,
    alt: img.alt ?? undefined,
    sortOrder: img.sortOrder,
    isPrimary: img.isPrimary,
  }));

  return { tour, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const tourId = params.id;

  if (!tourId) {
    throw new Response("Tour ID required", { status: 400 });
  }

  const formData = await request.formData();

  // Parse arrays from comma-separated strings
  const inclusionsStr = formData.get("inclusionsStr") as string;
  const exclusionsStr = formData.get("exclusionsStr") as string;
  const requirementsStr = formData.get("requirementsStr") as string;

  if (inclusionsStr) {
    formData.set("inclusions", JSON.stringify(inclusionsStr.split(",").map((s) => s.trim()).filter(Boolean)));
  }
  if (exclusionsStr) {
    formData.set("exclusions", JSON.stringify(exclusionsStr.split(",").map((s) => s.trim()).filter(Boolean)));
  }
  if (requirementsStr) {
    formData.set("requirements", JSON.stringify(requirementsStr.split(",").map((s) => s.trim()).filter(Boolean)));
  }

  const validation = validateFormData(formData, tourSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Update tour in database
  const { db, schema } = getTenantDb(organizationId);

  await db
    .update(schema.tours)
    .set({
      name: validation.data.name,
      description: validation.data.description,
      type: validation.data.type,
      duration: validation.data.duration as number | undefined,
      maxParticipants: validation.data.maxParticipants,
      minParticipants: validation.data.minParticipants,
      price: validation.data.price.toString(),
      currency: validation.data.currency,
      includesEquipment: validation.data.includesEquipment,
      includesMeals: validation.data.includesMeals,
      includesTransport: validation.data.includesTransport,
      inclusions: validation.data.inclusions,
      exclusions: validation.data.exclusions,
      minCertLevel: validation.data.minCertLevel,
      minAge: validation.data.minAge as number | undefined,
      requirements: validation.data.requirements,
      isActive: validation.data.isActive,
      requiresTankSelection: validation.data.requiresTankSelection,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.tours.organizationId, organizationId), eq(schema.tours.id, tourId)));

  // Enqueue auto-translation for non-default locales
  const inclusionsArr = inclusionsStr ? inclusionsStr.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const exclusionsArr = exclusionsStr ? exclusionsStr.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const requirementsArr = requirementsStr ? requirementsStr.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const fieldsToTranslate = [
    { field: "name", text: validation.data.name },
    { field: "description", text: validation.data.description ?? "" },
    { field: "inclusions", text: inclusionsArr.join("\n") },
    { field: "exclusions", text: exclusionsArr.join("\n") },
    { field: "requirements", text: requirementsArr.join("\n") },
  ].filter((f) => f.text?.trim());

  for (const locale of SUPPORTED_LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    await enqueueTranslation({
      orgId: organizationId,
      entityType: "tour",
      entityId: tourId,
      fields: fieldsToTranslate,
      targetLocale: locale,
    });
  }

  return redirect(redirectWithNotification(`/tenant/tours/${tourId}`, `Tour "${validation.data.name}" has been successfully updated`, "success"));
}

export default function EditTourPage() {
  const { tour, images } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const t = useT();
  const isSubmitting = navigation.state === "submitting";

  // Show notifications from URL params
  useNotification();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/tenant/tours/${tour.id}`} className="text-brand hover:underline text-sm">
          {t("tenant.tours.backToTour")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.tours.editTour")}</h1>
        <p className="text-foreground-muted">{t("tenant.tours.updateDetails")}</p>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("common.basicInfo")}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                {t("tenant.tours.tourName")} *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                defaultValue={actionData?.values?.name || tour.name}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                required
              />
              {actionData?.errors?.name && (
                <p className="text-danger text-sm mt-1">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                {t("common.description")}
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={actionData?.values?.description || tour.description}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-1">
                  {t("tenant.tours.tourType")} *
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={actionData?.values?.type || tour.type}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  required
                >
                  <option value="single_dive">{t("tenant.tours.singleDive")}</option>
                  <option value="multi_dive">{t("tenant.tours.multiDive")}</option>
                  <option value="course">{t("tenant.tours.course")}</option>
                  <option value="snorkel">{t("tenant.tours.snorkel")}</option>
                  <option value="night_dive">{t("tenant.tours.nightDive")}</option>
                  <option value="other">{t("tenant.tours.other")}</option>
                </select>
              </div>

              <div>
                <label htmlFor="duration" className="block text-sm font-medium mb-1">
                  {t("tenant.tours.durationMinutes")}
                </label>
                <input
                  type="number"
                  id="duration"
                  name="duration"
                  min="1"
                  defaultValue={actionData?.values?.duration || tour.duration}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pricing & Capacity */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.tours.pricingCapacity")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-1">
                {t("common.price")} *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                <input
                  type="number"
                  id="price"
                  name="price"
                  step="0.01"
                  min="0"
                  defaultValue={actionData?.values?.price || tour.price}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
              {actionData?.errors?.price && (
                <p className="text-danger text-sm mt-1">{actionData.errors.price}</p>
              )}
            </div>

            <div>
              <label htmlFor="currency" className="block text-sm font-medium mb-1">
                {t("common.currency")}
              </label>
              <select
                id="currency"
                name="currency"
                defaultValue={actionData?.values?.currency || tour.currency}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AUD">AUD</option>
                <option value="THB">THB</option>
                <option value="IDR">IDR</option>
                <option value="MXN">MXN</option>
              </select>
            </div>

            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium mb-1">
                {t("tenant.tours.maxParticipants")} *
              </label>
              <input
                type="number"
                id="maxParticipants"
                name="maxParticipants"
                min="1"
                defaultValue={actionData?.values?.maxParticipants || tour.maxParticipants}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                required
              />
              {actionData?.errors?.maxParticipants && (
                <p className="text-danger text-sm mt-1">{actionData.errors.maxParticipants}</p>
              )}
            </div>

            <div>
              <label htmlFor="minParticipants" className="block text-sm font-medium mb-1">
                {t("tenant.tours.minParticipants")}
              </label>
              <input
                type="number"
                id="minParticipants"
                name="minParticipants"
                min="1"
                defaultValue={actionData?.values?.minParticipants || tour.minParticipants}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.tours.tourImages")}</h2>
          <ImageManager
            entityType="tour"
            entityId={tour.id}
            images={images}
            maxImages={5}
          />
        </div>

        {/* Inclusions */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.tours.whatsIncluded")}</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesEquipment"
                  value="true"
                  defaultChecked={actionData?.values?.includesEquipment === "true" || tour.includesEquipment}
                  className="rounded"
                />
                <span className="text-sm">{t("tenant.tours.equipmentRental")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesMeals"
                  value="true"
                  defaultChecked={actionData?.values?.includesMeals === "true" || tour.includesMeals}
                  className="rounded"
                />
                <span className="text-sm">{t("tenant.tours.mealsSnacks")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesTransport"
                  value="true"
                  defaultChecked={actionData?.values?.includesTransport === "true" || tour.includesTransport}
                  className="rounded"
                />
                <span className="text-sm">{t("tenant.tours.transport")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="requiresTankSelection"
                  value="true"
                  defaultChecked={actionData?.values?.requiresTankSelection === "true" || tour.requiresTankSelection}
                  className="rounded"
                />
                <span className="text-sm">Require tank &amp; gas selection</span>
              </label>
            </div>

            <div>
              <label htmlFor="inclusionsStr" className="block text-sm font-medium mb-1">
                {t("tenant.tours.additionalInclusions")}
              </label>
              <input
                type="text"
                id="inclusionsStr"
                name="inclusionsStr"
                placeholder={t("tenant.tours.inclusionsPlaceholder")}
                defaultValue={actionData?.values?.inclusionsStr || tour.inclusions?.join(", ")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="exclusionsStr" className="block text-sm font-medium mb-1">
                {t("tenant.tours.exclusions")}
              </label>
              <input
                type="text"
                id="exclusionsStr"
                name="exclusionsStr"
                placeholder={t("tenant.tours.exclusionsPlaceholder")}
                defaultValue={actionData?.values?.exclusionsStr || tour.exclusions?.join(", ")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.tours.requirements")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="minCertLevel" className="block text-sm font-medium mb-1">
                {t("tenant.tours.minCertification")}
              </label>
              <select
                id="minCertLevel"
                name="minCertLevel"
                defaultValue={actionData?.values?.minCertLevel || tour.minCertLevel}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              >
                <option value="">{t("tenant.tours.noneRequired")}</option>
                <option value="Open Water">{t("tenant.tours.openWater")}</option>
                <option value="Advanced Open Water">{t("tenant.tours.advancedOpenWater")}</option>
                <option value="Rescue Diver">{t("tenant.tours.rescueDiver")}</option>
                <option value="Divemaster">{t("tenant.tours.divemaster")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="minAge" className="block text-sm font-medium mb-1">
                {t("tenant.tours.minimumAge")}
              </label>
              <input
                type="number"
                id="minAge"
                name="minAge"
                min="1"
                placeholder={t("tenant.tours.minAgePlaceholder")}
                defaultValue={actionData?.values?.minAge || tour.minAge || ""}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="requirementsStr" className="block text-sm font-medium mb-1">
              {t("tenant.tours.otherRequirements")}
            </label>
            <input
              type="text"
              id="requirementsStr"
              name="requirementsStr"
              placeholder={t("tenant.tours.requirementsPlaceholder")}
              defaultValue={actionData?.values?.requirementsStr || tour.requirements?.join(", ")}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </div>
        </div>

        {/* Status */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={actionData?.values?.isActive !== "false" && tour.isActive}
              className="rounded"
            />
            <span className="font-medium">{t("common.active")}</span>
            <span className="text-foreground-muted text-sm">
              {t("tenant.tours.inactiveCantSchedule")}
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? t("tenant.tours.saving") : t("common.saveChanges")}
          </button>
          <Link
            to={`/tenant/tours/${tour.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
