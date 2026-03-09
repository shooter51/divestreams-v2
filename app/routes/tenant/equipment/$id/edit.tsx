import { useState } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import { getEquipmentById } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { equipmentSchema, validateFormData, getFormValues } from "../../../../../lib/validation";
import { ImageManager, type Image } from "../../../../../app/components/ui";
import { BarcodeScannerModal } from "../../../../components/BarcodeScannerModal";
import { redirectWithNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";
import { useT } from "../../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Edit Equipment - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const equipmentId = params.id;

  if (!equipmentId) {
    throw new Response("Equipment ID required", { status: 400 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(organizationId);

  const [equipmentData, equipmentImages] = await Promise.all([
    getEquipmentById(organizationId, equipmentId),
    db
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
          eq(schema.images.entityType, "equipment"),
          eq(schema.images.entityId, equipmentId)
        )
      )
      .orderBy(asc(schema.images.sortOrder)),
  ]);

  if (!equipmentData) {
    throw new Response("Equipment not found", { status: 404 });
  }

  const equipment = {
    id: equipmentData.id,
    name: equipmentData.name,
    category: equipmentData.category,
    brand: equipmentData.brand || "",
    model: equipmentData.model || "",
    serialNumber: equipmentData.serialNumber || "",
    barcode: equipmentData.barcode || "",
    size: equipmentData.size || "",
    gasType: equipmentData.gasType || "",
    condition: equipmentData.condition,
    status: equipmentData.status,
    isRentable: equipmentData.isRentable,
    rentalPrice: equipmentData.rentalPrice?.toString() || "",
    purchaseDate: equipmentData.purchaseDate || "",
    purchasePrice: equipmentData.purchasePrice?.toString() || "",
    lastServiceDate: equipmentData.lastServiceDate || "",
    nextServiceDate: equipmentData.nextServiceDate || "",
    serviceNotes: equipmentData.serviceNotes || "",
    notes: equipmentData.notes || "",
    isPublic: equipmentData.isPublic ?? true,
  };

  // Format images for the component
  const images: Image[] = equipmentImages.map((img) => ({
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

  return { equipment, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const equipmentId = params.id;

  if (!equipmentId) {
    throw new Response("Equipment ID required", { status: 400 });
  }

  const formData = await request.formData();
  const validation = validateFormData(formData, equipmentSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Update equipment in database
  const { db, schema } = getTenantDb(organizationId);

  // Get barcode directly from formData since it may not be in validation schema
  const barcode = formData.get("barcode") as string || null;
  const isPublic = formData.get("isPublic") === "true";

  await db
    .update(schema.equipment)
    .set({
      name: validation.data.name,
      category: validation.data.category,
      brand: validation.data.brand,
      model: validation.data.model,
      serialNumber: validation.data.serialNumber,
      barcode,
      size: validation.data.size,
      gasType: validation.data.gasType || null,
      condition: validation.data.condition,
      status: validation.data.status,
      isRentable: validation.data.isRentable,
      rentalPrice: validation.data.rentalPrice?.toString(),
      purchaseDate: validation.data.purchaseDate,
      purchasePrice: validation.data.purchasePrice?.toString(),
      lastServiceDate: validation.data.lastServiceDate,
      nextServiceDate: validation.data.nextServiceDate,
      serviceNotes: validation.data.serviceNotes,
      notes: validation.data.notes,
      isPublic,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.equipment.organizationId, organizationId), eq(schema.equipment.id, equipmentId)));

  return redirect(redirectWithNotification(`/tenant/equipment/${equipmentId}`, `Equipment "${validation.data.name}" has been successfully updated`, "success"));
}

export default function EditEquipmentPage() {
  const { equipment, images } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const t = useT();
  const isSubmitting = navigation.state === "submitting";
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState(equipment.barcode || "");
  const [selectedCategory, setSelectedCategory] = useState(equipment.category || "");

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/tenant/equipment/${equipment.id}`} className="text-brand hover:underline text-sm">
          {t("tenant.equipment.backToEquipment")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.equipment.editEquipment")}</h1>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("common.basicInfo")}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                {t("tenant.equipment.equipmentName")} *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={actionData?.values?.name || equipment.name}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="category" className="block text-sm font-medium mb-1">
                  {t("tenant.equipment.category")} *
                </label>
                <select
                  id="category"
                  name="category"
                  required
                  defaultValue={actionData?.values?.category || equipment.category}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                >
                  <option value="bcd">{t("tenant.equipment.category.bcd")}</option>
                  <option value="regulator">{t("tenant.equipment.category.regulator")}</option>
                  <option value="wetsuit">{t("tenant.equipment.category.wetsuit")}</option>
                  <option value="mask">{t("tenant.equipment.category.mask")}</option>
                  <option value="fins">{t("tenant.equipment.category.fins")}</option>
                  <option value="tank">{t("tenant.equipment.category.tank")}</option>
                  <option value="computer">{t("tenant.equipment.category.computer")}</option>
                  <option value="other">{t("tenant.equipment.category.other")}</option>
                </select>
              </div>

              <div>
                <label htmlFor="size" className="block text-sm font-medium mb-1">
                  {t("tenant.equipment.size")}
                </label>
                <input
                  type="text"
                  id="size"
                  name="size"
                  placeholder="e.g., M, L, XL"
                  defaultValue={actionData?.values?.size || equipment.size}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            {selectedCategory === "tank" && (
              <div>
                <label htmlFor="gasType" className="block text-sm font-medium mb-1">
                  {t("tenant.equipment.gasType")}
                </label>
                <select
                  id="gasType"
                  name="gasType"
                  defaultValue={actionData?.values?.gasType || equipment.gasType || "air"}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                >
                  <option value="air">{t("tenant.equipment.gasType.air")}</option>
                  <option value="nitrox32">{t("tenant.equipment.gasType.nitrox32")}</option>
                  <option value="nitrox36">{t("tenant.equipment.gasType.nitrox36")}</option>
                  <option value="trimix">{t("tenant.equipment.gasType.trimix")}</option>
                  <option value="oxygen">{t("tenant.equipment.gasType.oxygen")}</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="brand" className="block text-sm font-medium mb-1">
                  {t("tenant.equipment.brand")}
                </label>
                <input
                  type="text"
                  id="brand"
                  name="brand"
                  defaultValue={actionData?.values?.brand || equipment.brand}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label htmlFor="model" className="block text-sm font-medium mb-1">
                  {t("tenant.equipment.model")}
                </label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  defaultValue={actionData?.values?.model || equipment.model}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div>
              <label htmlFor="serialNumber" className="block text-sm font-medium mb-1">
                {t("tenant.equipment.serialNumber")}
              </label>
              <input
                type="text"
                id="serialNumber"
                name="serialNumber"
                defaultValue={actionData?.values?.serialNumber || equipment.serialNumber}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="barcode" className="block text-sm font-medium mb-1">
                {t("tenant.equipment.barcode")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="barcode"
                  name="barcode"
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  placeholder="EAN-13, UPC, etc."
                />
                <button
                  type="button"
                  onClick={() => setShowBarcodeScanner(true)}
                  className="px-3 py-2 bg-surface text-foreground border border-border rounded-lg hover:bg-surface-raised"
                  title={t("tenant.equipment.scanBarcode")}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.equipment.equipmentImages")}</h2>
          <ImageManager
            entityType="equipment"
            entityId={equipment.id}
            images={images}
            maxImages={5}
          />
        </div>

        {/* Status & Condition */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.equipment.statusCondition")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-1">
                {t("common.status")} *
              </label>
              <select
                id="status"
                name="status"
                required
                defaultValue={actionData?.values?.status || equipment.status}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              >
                <option value="available">{t("tenant.equipment.status.available")}</option>
                <option value="rented">{t("tenant.equipment.status.rented")}</option>
                <option value="maintenance">{t("tenant.equipment.status.maintenance")}</option>
                <option value="retired">{t("tenant.equipment.status.retired")}</option>
              </select>
            </div>

            <div>
              <label htmlFor="condition" className="block text-sm font-medium mb-1">
                {t("tenant.equipment.condition")} *
              </label>
              <select
                id="condition"
                name="condition"
                required
                defaultValue={actionData?.values?.condition || equipment.condition || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              >
                <option value="excellent">{t("tenant.equipment.condition.excellent")}</option>
                <option value="good">{t("tenant.equipment.condition.good")}</option>
                <option value="fair">{t("tenant.equipment.condition.fair")}</option>
                <option value="poor">{t("tenant.equipment.condition.poor")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rental */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.equipment.rentalSettings")}</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isRentable"
                value="true"
                defaultChecked={actionData?.values?.isRentable !== "false" && equipment.isRentable}
                className="rounded"
                id="isRentableCheckbox"
              />
              <span className="font-medium">{t("tenant.equipment.availableForRent")}</span>
            </label>
            <p className="text-xs text-foreground-muted -mt-2 ml-7">
              {t("tenant.equipment.rentableInPOS")}
            </p>

            <div className="w-1/2">
              <label htmlFor="rentalPrice" className="block text-sm font-medium mb-1">
                {t("tenant.equipment.rentalPricePerDay")} {" "}
                <span className="text-foreground-muted text-xs">({t("tenant.equipment.requiredIfRentable")})</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                <input
                  type="number"
                  id="rentalPrice"
                  name="rentalPrice"
                  step="0.01"
                  min="0.01"
                  placeholder="10.00"
                  defaultValue={actionData?.values?.rentalPrice || equipment.rentalPrice}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
              <p className="text-xs text-foreground-muted mt-1">
                {t("tenant.equipment.noPriceNoPOS")}
              </p>
              {actionData?.errors?.rentalPrice && (
                <p className="text-danger text-sm mt-1">{actionData.errors.rentalPrice}</p>
              )}
            </div>
          </div>
        </div>

        {/* Service */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.equipment.serviceInformation")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lastServiceDate" className="block text-sm font-medium mb-1">
                {t("tenant.equipment.lastServiceDate")}
              </label>
              <input
                type="date"
                id="lastServiceDate"
                name="lastServiceDate"
                defaultValue={actionData?.values?.lastServiceDate || (equipment.lastServiceDate ? String(equipment.lastServiceDate) : "")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="nextServiceDate" className="block text-sm font-medium mb-1">
                {t("tenant.equipment.nextServiceDue")}
              </label>
              <input
                type="date"
                id="nextServiceDate"
                name="nextServiceDate"
                defaultValue={actionData?.values?.nextServiceDate || (equipment.nextServiceDate ? String(equipment.nextServiceDate) : "")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="serviceNotes" className="block text-sm font-medium mb-1">
              {t("tenant.equipment.serviceNotes")}
            </label>
            <textarea
              id="serviceNotes"
              name="serviceNotes"
              rows={2}
              defaultValue={actionData?.values?.serviceNotes || equipment.serviceNotes}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("common.notes")}</h2>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={actionData?.values?.notes || equipment.notes}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
          />
          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isPublic"
                value="true"
                defaultChecked={actionData?.values?.isPublic !== "false" && equipment.isPublic}
                className="rounded"
              />
              <span className="text-sm font-medium">{t("tenant.equipment.showOnPublicSite")}</span>
            </label>
            <p className="text-xs text-foreground-muted mt-1">
              {t("tenant.equipment.publicCatalogDesc")}
            </p>
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
            to={`/tenant/equipment/${equipment.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={(barcode) => {
          setBarcodeValue(barcode);
          setShowBarcodeScanner(false);
        }}
        title={t("tenant.equipment.scanEquipmentBarcode")}
      />
    </div>
  );
}
