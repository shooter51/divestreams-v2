import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
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
    await deleteEquipment(organizationId, equipmentId);
    return redirect("/tenant/equipment");
  }

  return null;
}

const categoryLabels: Record<string, string> = {
  bcd: "BCD",
  regulator: "Regulator",
  wetsuit: "Wetsuit",
  mask: "Mask",
  fins: "Fins",
  tank: "Tank",
  computer: "Dive Computer",
  other: "Other",
};

const statusColors: Record<string, string> = {
  available: "bg-green-100 text-green-700",
  rented: "bg-blue-100 text-blue-700",
  maintenance: "bg-yellow-100 text-yellow-700",
  retired: "bg-gray-100 text-gray-600",
};

const conditionColors: Record<string, string> = {
  excellent: "bg-green-100 text-green-700",
  good: "bg-blue-100 text-blue-700",
  fair: "bg-yellow-100 text-yellow-700",
  poor: "bg-red-100 text-red-700",
};

export default function EquipmentDetailPage() {
  const { equipment, rentalHistory, serviceHistory, stats, images } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this equipment?")) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  const serviceDue =
    equipment.nextServiceDate && new Date(equipment.nextServiceDate) <= new Date();

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/equipment" className="text-blue-600 hover:underline text-sm">
          ← Back to Equipment
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{equipment.name}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${statusColors[equipment.status]}`}
            >
              {equipment.status}
            </span>
            <span
              className={`text-sm px-3 py-1 rounded-full ${conditionColors[equipment.condition]}`}
            >
              {equipment.condition}
            </span>
          </div>
          <p className="text-gray-500">
            {categoryLabels[equipment.category]} • {equipment.brand} {equipment.model}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/app/equipment/${equipment.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
          {equipment.status !== "retired" && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="retire" />
              <button
                type="submit"
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Retire
              </button>
            </fetcher.Form>
          )}
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.totalRentals}</p>
              <p className="text-gray-500 text-sm">Total Rentals</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-green-600">${stats.rentalRevenue}</p>
              <p className="text-gray-500 text-sm">Revenue</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.daysRented}</p>
              <p className="text-gray-500 text-sm">Days Rented</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.avgRentalsPerMonth}</p>
              <p className="text-gray-500 text-sm">Avg/Month</p>
            </div>
          </div>

          {/* Images */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Equipment Images</h2>
            <ImageManager
              entityType="equipment"
              entityId={equipment.id}
              images={images}
              maxImages={5}
            />
          </div>

          {/* Change Status */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Quick Status Change</h2>
            <fetcher.Form method="post" className="flex gap-2">
              <input type="hidden" name="intent" value="update-status" />
              <select
                name="status"
                defaultValue={equipment.status}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="available">Available</option>
                <option value="rented">Rented</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Update
              </button>
            </fetcher.Form>
          </div>

          {/* Rental History */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Recent Rentals</h2>
            {rentalHistory.length === 0 ? (
              <p className="text-gray-500 text-sm">No rental history.</p>
            ) : (
              <div className="space-y-3">
                {rentalHistory.map((rental) => (
                  <Link
                    key={rental.id}
                    to={`/app/bookings/${rental.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">{rental.customerName}</p>
                      <p className="text-sm text-gray-500">
                        {rental.bookingNumber} • {rental.date}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        rental.returned
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {rental.returned ? "Returned" : "Active"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Service History */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Service History</h2>
            {serviceHistory.length > 0 ? (
              <div className="space-y-3 text-sm mb-4">
                {serviceHistory.slice(0, 3).map((service) => (
                  <div key={service.id} className="border-b pb-2 last:border-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium capitalize">{service.type}</span>
                      <span className="text-gray-500 text-xs">
                        {service.date}
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs mt-1">{service.description}</p>
                    {service.cost && (
                      <p className="text-gray-500 text-xs">${service.cost}</p>
                    )}
                  </div>
                ))}
                {serviceHistory.length > 3 && (
                  <p className="text-gray-500 text-xs">
                    +{serviceHistory.length - 3} more records
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm mb-4">No service records yet.</p>
            )}
            <fetcher.Form method="post" className="space-y-3">
              <input type="hidden" name="intent" value="log-service" />
              <div>
                <label className="block text-xs text-gray-600 mb-1">Type</label>
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
                <label className="block text-xs text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  name="description"
                  placeholder="What was done?"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Performed By</label>
                <input
                  type="text"
                  name="performedBy"
                  placeholder="Technician or company name"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Cost</label>
                <input
                  type="number"
                  name="cost"
                  placeholder="0.00"
                  step="0.01"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Notes</label>
                <textarea
                  name="notes"
                  placeholder="Additional details..."
                  rows={2}
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Next Service Date</label>
                <input
                  type="date"
                  name="nextServiceDate"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Certification Expiry</label>
                <input
                  type="date"
                  name="certificationExpiry"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">For tanks, regulators, etc.</p>
              </div>
              <button
                type="submit"
                className="w-full text-center py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Log Service
              </button>
            </fetcher.Form>
          </div>

          {/* Notes */}
          {equipment.notes && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-3">Notes</h2>
              <p className="text-gray-700">{equipment.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Category</span>
                <span>{categoryLabels[equipment.category]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Brand</span>
                <span>{equipment.brand}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Model</span>
                <span>{equipment.model}</span>
              </div>
              {equipment.serialNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Serial #</span>
                  <span>{equipment.serialNumber}</span>
                </div>
              )}
              {equipment.size && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Size</span>
                  <span>{equipment.size}</span>
                </div>
              )}
            </div>
          </div>

          {/* Rental Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Rental</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Rentable</span>
                <span>{equipment.isRentable ? "Yes" : "No"}</span>
              </div>
              {equipment.isRentable && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Price/Day</span>
                  <span className="font-medium">${equipment.rentalPrice}</span>
                </div>
              )}
            </div>
          </div>

          {/* Service */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Service</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Last Service</span>
                <span>{equipment.lastServiceDate || "Never"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Next Due</span>
                <span className={serviceDue ? "text-yellow-600 font-medium" : ""}>
                  {equipment.nextServiceDate || "Not set"}
                </span>
              </div>
              {serviceDue && (
                <p className="text-yellow-600 text-xs">Service overdue!</p>
              )}
              {equipment.serviceNotes && (
                <div className="pt-2 border-t">
                  <p className="text-gray-500 mb-1">Last notes:</p>
                  <p className="text-gray-700">{equipment.serviceNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Purchase Info */}
          {(equipment.purchaseDate || equipment.purchasePrice) && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Purchase</h2>
              <div className="space-y-3 text-sm">
                {equipment.purchaseDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span>{equipment.purchaseDate}</span>
                  </div>
                )}
                {equipment.purchasePrice && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Price</span>
                    <span>${equipment.purchasePrice}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>Created: {equipment.createdAt}</p>
            <p>Updated: {equipment.updatedAt}</p>
            <p>ID: {equipment.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
