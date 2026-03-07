import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { serviceRecords } from "../../../../lib/db/schema";
import {
  getEquipmentById,
  getEquipmentRentalHistory,
  getEquipmentRentalStats,
  getEquipmentServiceHistory,
  updateEquipmentStatus,
  deleteEquipment,
} from "../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { ImageManager, type Image } from "../../../../app/components/ui";
import { redirectWithNotification, useNotification } from "../../../../lib/use-notification";
import { formatLabel } from "../../../lib/format";
import { CsrfInput } from "../../../components/CsrfInput";
import { useT } from "../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Equipment Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const equipmentId = params.id;

  if (!equipmentId) {
    throw new Response("Equipment ID required", { status: 400 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(organizationId);

  // Fetch all data in parallel
  const [equipment, rentalHistory, stats, serviceHistory, equipmentImages] = await Promise.all([
    getEquipmentById(organizationId, equipmentId),
    getEquipmentRentalHistory(organizationId, equipmentId),
    getEquipmentRentalStats(organizationId, equipmentId),
    getEquipmentServiceHistory(organizationId, equipmentId),
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

  if (!equipment) {
    throw new Response("Equipment not found", { status: 404 });
  }

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // Format equipment data with dates as strings
  const formattedEquipment = {
    ...equipment,
    lastServiceDate: formatDate(equipment.lastServiceDate),
    nextServiceDate: formatDate(equipment.nextServiceDate),
    purchaseDate: formatDate(equipment.purchaseDate),
    createdAt: formatDate(equipment.createdAt),
    updatedAt: formatDate(equipment.updatedAt),
  };

  // Format rental history dates - add derived fields for UI
  const formattedRentalHistory = rentalHistory.map((rental) => ({
    ...rental,
    date: formatDate(rental.rentedAt),
    bookingNumber: `R-${rental.id.substring(0, 8).toUpperCase()}`,
    returned: rental.returnedAt !== null,
  }));

  // Format service history dates
  const formattedServiceHistory = serviceHistory.map((service) => ({
    ...service,
    date: formatDate(service.performedAt),
    performedAt: formatDate(service.performedAt),
  }));

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

  return { equipment: formattedEquipment, rentalHistory: formattedRentalHistory, serviceHistory: formattedServiceHistory, stats, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const equipmentId = params.id;

  if (!equipmentId) {
    return { error: "Equipment ID required" };
  }

  if (intent === "update-status") {
    const newStatus = formData.get("status") as string;
    if (newStatus) {
      await updateEquipmentStatus(organizationId, equipmentId, newStatus);
    }
    return { statusUpdated: true };
  }

  if (intent === "log-service") {
    const type = formData.get("type") as string;
    const description = formData.get("description") as string;
    const performedBy = formData.get("performedBy") as string;
    const cost = formData.get("cost") as string;
    const notes = formData.get("notes") as string;
    const nextServiceDate = formData.get("nextServiceDate") as string;
    const nextServiceType = formData.get("nextServiceType") as string;
    const certificationExpiry = formData.get("certificationExpiry") as string;

    await db.insert(serviceRecords).values({
      organizationId,
      equipmentId,
      type: type || "inspection",
      description: description || "Service performed",
      performedBy: performedBy || null,
      cost: cost || null,
      notes: notes || null,
      nextServiceDate: nextServiceDate || null,
      nextServiceType: nextServiceType || null,
      certificationExpiry: certificationExpiry || null,
      createdBy: ctx.user.id,
    });

    return { serviceLogged: true };
  }

  if (intent === "retire") {
    await updateEquipmentStatus(organizationId, equipmentId, "retired");
    return { retired: true };
  }

  if (intent === "delete") {
    const equipment = await getEquipmentById(organizationId, equipmentId);
    const equipmentName = equipment?.name || "Equipment";
    await deleteEquipment(organizationId, equipmentId);
    return redirect(redirectWithNotification("/tenant/equipment", `${equipmentName} has been successfully deleted`, "success"));
  }

  return null;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const categoryLabels: Record<string, string> = {
  bcd: "BCD",
  regulator: "Regulator",
  wetsuit: "Wetsuit",
  mask: "Mask",
  fins: "Fins",
  tank: "Tank",
  computer: "Dive Computer",
  torch: "Torch/Light",
  other: "Other",
};

const statusColors: Record<string, string> = {
  available: "bg-success-muted text-success",
  rented: "bg-brand-muted text-brand",
  maintenance: "bg-warning-muted text-warning",
  retired: "bg-surface-inset text-foreground-muted",
};

const statusLabels: Record<string, string> = {
  available: "Available",
  rented: "Rented",
  maintenance: "Maintenance",
  retired: "Retired",
};

const conditionColors: Record<string, string> = {
  excellent: "bg-success-muted text-success",
  good: "bg-brand-muted text-brand",
  fair: "bg-warning-muted text-warning",
  poor: "bg-danger-muted text-danger",
};

const conditionLabels: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export default function EquipmentDetailPage() {
  const { equipment, rentalHistory, serviceHistory, stats, images } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const t = useT();

  // Show notifications from URL params
  useNotification();

  const handleDelete = () => {
    if (confirm(t("tenant.equipment.confirmDelete"))) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  const serviceDue =
    equipment.nextServiceDate && new Date(equipment.nextServiceDate) <= new Date();

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/equipment" className="text-brand hover:underline text-sm">
          {t("tenant.equipment.backToEquipment")}
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{equipment.name}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${statusColors[equipment.status]}`}
            >
              {statusLabels[equipment.status] || formatLabel(equipment.status)}
            </span>
            <span
              className={`text-sm px-3 py-1 rounded-full ${conditionColors[equipment.condition ?? "good"]}`}
            >
              {conditionLabels[equipment.condition ?? "good"] || formatLabel(equipment.condition)}
            </span>
          </div>
          <p className="text-foreground-muted">
            {categoryLabels[equipment.category]} • {[equipment.brand, equipment.model].filter(Boolean).join(" ") || t("tenant.equipment.noBrand")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/tenant/equipment/${equipment.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.edit")}
          </Link>
          {equipment.status !== "retired" && (
            <fetcher.Form method="post">
              <CsrfInput />
              <input type="hidden" name="intent" value="retire" />
              <button
                type="submit"
                className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
              >
                {t("tenant.equipment.retire")}
              </button>
            </fetcher.Form>
          )}
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.totalRentals}</p>
              <p className="text-foreground-muted text-sm">{t("tenant.equipment.totalRentals")}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-success">${stats.rentalRevenue}</p>
              <p className="text-foreground-muted text-sm">{t("common.total")}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.daysRented}</p>
              <p className="text-foreground-muted text-sm">{t("tenant.equipment.daysRented")}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.avgRentalsPerMonth}</p>
              <p className="text-foreground-muted text-sm">{t("tenant.equipment.avgPerMonth")}</p>
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

          {/* Change Status */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.equipment.quickStatusChange")}</h2>
            <fetcher.Form method="post" className="flex gap-2">
              <CsrfInput />
              <input type="hidden" name="intent" value="update-status" />
              <select
                name="status"
                defaultValue={equipment.status}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              >
                <option value="available">Available</option>
                <option value="rented">Rented</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
              >
                {t("tenant.equipment.update")}
              </button>
            </fetcher.Form>
          </div>

          {/* Rental History */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.equipment.recentRentals")}</h2>
            {rentalHistory.length === 0 ? (
              <p className="text-foreground-muted text-sm">{t("tenant.equipment.noRentalHistory")}</p>
            ) : (
              <div className="space-y-3">
                {rentalHistory.map((rental) => (
                  <Link
                    key={rental.id}
                    to={`/tenant/bookings/${rental.id}`}
                    className="flex justify-between items-center p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay"
                  >
                    <div>
                      <p className="font-medium">{rental.customerName}</p>
                      <p className="text-sm text-foreground-muted">
                        {rental.bookingNumber} • {formatDate(rental.date)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        rental.returned
                          ? "bg-success-muted text-success"
                          : "bg-brand-muted text-brand"
                      }`}
                    >
                      {rental.returned ? t("tenant.equipment.returned") : t("common.active")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Service History */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.equipment.serviceHistory")}</h2>
            {serviceHistory.length > 0 ? (
              <div className="space-y-3 text-sm mb-4">
                {serviceHistory.slice(0, 3).map((service) => (
                  <div key={service.id} className="border-b pb-2 last:border-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium capitalize">{service.type}</span>
                      <span className="text-foreground-muted text-xs">
                        {formatDate(service.date)}
                      </span>
                    </div>
                    <p className="text-foreground-muted text-xs mt-1">{service.description}</p>
                    {service.cost && (
                      <p className="text-foreground-muted text-xs">${service.cost}</p>
                    )}
                  </div>
                ))}
                {serviceHistory.length > 3 && (
                  <p className="text-foreground-muted text-xs">
                    {t("tenant.equipment.moreRecords", { count: serviceHistory.length - 3 })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-foreground-muted text-sm mb-4">{t("tenant.equipment.noServiceRecords")}</p>
            )}
            <fetcher.Form method="post" className="space-y-3">
              <CsrfInput />
              <input type="hidden" name="intent" value="log-service" />
              <div>
                <label className="block text-xs text-foreground-muted mb-1">Type</label>
                <select
                  name="type"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                  required
                >
                  <option value="inspection">Inspection</option>
                  <option value="repair">Repair</option>
                  <option value="certification">Certification</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="replacement">Replacement</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-foreground-muted mb-1">{t("common.description")}</label>
                <input
                  type="text"
                  name="description"
                  placeholder={t("tenant.equipment.whatWasDone")}
                  className="w-full text-sm border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-foreground-muted mb-1">{t("tenant.equipment.performedBy")}</label>
                <input
                  type="text"
                  name="performedBy"
                  placeholder={t("tenant.equipment.technicianOrCompany")}
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-foreground-muted mb-1">{t("tenant.equipment.cost")}</label>
                <input
                  type="number"
                  name="cost"
                  placeholder="0.00"
                  step="0.01"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-foreground-muted mb-1">{t("common.notes")}</label>
                <textarea
                  name="notes"
                  placeholder={t("tenant.equipment.additionalNotes")}
                  rows={2}
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-foreground-muted mb-1">{t("tenant.equipment.nextServiceDate")}</label>
                <input
                  type="date"
                  name="nextServiceDate"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-foreground-muted mb-1">{t("tenant.equipment.certificationExpiry")}</label>
                <input
                  type="date"
                  name="certificationExpiry"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-foreground-muted mt-1">{t("tenant.equipment.forTanksRegs")}</p>
              </div>
              <button
                type="submit"
                className="w-full text-center py-2 text-sm text-white bg-brand rounded-lg hover:bg-brand-hover"
              >
                {t("tenant.equipment.logService")}
              </button>
            </fetcher.Form>
          </div>

          {/* Notes */}
          {equipment.notes && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-3">{t("common.notes")}</h2>
              <p className="text-foreground">{equipment.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.equipment.details")}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground-muted">{t("tenant.equipment.category")}</span>
                <span>{categoryLabels[equipment.category]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">{t("tenant.equipment.brand")}</span>
                <span>{equipment.brand}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">{t("tenant.equipment.model")}</span>
                <span>{equipment.model || "—"}</span>
              </div>
              {equipment.serialNumber && (
                <div className="flex justify-between">
                  <span className="text-foreground-muted">{t("tenant.equipment.serialNumber")}</span>
                  <span>{equipment.serialNumber}</span>
                </div>
              )}
              {equipment.size && (
                <div className="flex justify-between">
                  <span className="text-foreground-muted">{t("tenant.equipment.size")}</span>
                  <span>{equipment.size}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rental Info */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.equipment.rental")}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground-muted">{t("tenant.equipment.rentable")}</span>
                <span>{equipment.isRentable ? t("tenant.equipment.yes") : t("tenant.equipment.no")}</span>
              </div>
              {equipment.isRentable && (
                <div className="flex justify-between">
                  <span className="text-foreground-muted">{t("tenant.equipment.pricePerDay")}</span>
                  <span className="font-medium">${equipment.rentalPrice}</span>
                </div>
              )}
            </div>
          </div>

          {/* Service */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.equipment.service")}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground-muted">{t("tenant.equipment.lastService")}</span>
                <span>{equipment.lastServiceDate ? formatDate(equipment.lastServiceDate) : t("tenant.equipment.notSet")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">{t("tenant.equipment.nextDue")}</span>
                <span className={serviceDue ? "text-warning font-medium" : ""}>
                  {equipment.nextServiceDate ? formatDate(equipment.nextServiceDate) : t("tenant.equipment.notSet")}
                </span>
              </div>
              {serviceDue && (
                <p className="text-warning text-xs">{t("tenant.equipment.serviceOverdue")}</p>
              )}
              {equipment.serviceNotes && (
                <div className="pt-2 border-t">
                  <p className="text-foreground-muted mb-1">{t("tenant.equipment.lastNotes")}</p>
                  <p className="text-foreground">{equipment.serviceNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Purchase Info */}
          {(equipment.purchaseDate || equipment.purchasePrice) && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">{t("tenant.equipment.purchase")}</h2>
              <div className="space-y-3 text-sm">
                {equipment.purchaseDate && (
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">{t("tenant.equipment.purchaseDate")}</span>
                    <span>{formatDate(equipment.purchaseDate)}</span>
                  </div>
                )}
                {equipment.purchasePrice && (
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">{t("common.price")}</span>
                    <span>${equipment.purchasePrice}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-foreground-subtle space-y-1">
            <p>{t("tenant.equipment.created")}: {formatDate(equipment.createdAt)}</p>
            <p>{t("tenant.equipment.updated")}: {formatDate(equipment.updatedAt)}</p>
            <p>{t("tenant.equipment.equipmentId")}: {equipment.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
