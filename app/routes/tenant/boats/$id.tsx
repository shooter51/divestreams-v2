import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { eq, and, asc, desc } from "drizzle-orm";
import { requireTenant, requireOrgContext } from "../../../../lib/auth/org-context.server";
import {
  getBoatById,
  getBoatRecentTrips,
  getBoatUpcomingTrips,
  getBoatStats,
  updateBoatActiveStatus,
  deleteBoat,
} from "../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { ImageManager, type Image } from "../../../../app/components/ui";
import { maintenanceLogs } from "../../../../lib/db/schema";

export const meta: MetaFunction = () => [{ title: "Boat Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const boatId = params.id;

  if (!boatId) {
    throw new Response("Boat ID required", { status: 400 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(organizationId);

  // Fetch all data in parallel
  const [boat, recentTrips, upcomingTrips, stats, boatImages, maintenanceHistory] = await Promise.all([
    getBoatById(organizationId, boatId),
    getBoatRecentTrips(organizationId, boatId),
    getBoatUpcomingTrips(organizationId, boatId),
    getBoatStats(organizationId, boatId),
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
          eq(schema.images.entityType, "boat"),
          eq(schema.images.entityId, boatId)
        )
      )
      .orderBy(asc(schema.images.sortOrder)),
    // Get maintenance history for this boat
    db
      .select()
      .from(maintenanceLogs)
      .where(
        and(
          eq(maintenanceLogs.organizationId, organizationId),
          eq(maintenanceLogs.boatId, boatId)
        )
      )
      .orderBy(desc(maintenanceLogs.performedAt))
      .limit(10),
  ]);

  // Check if maintenance is due (next maintenance date is in the past or within 7 days)
  const latestMaintenance = maintenanceHistory[0];
  const maintenanceDue = latestMaintenance?.nextMaintenanceDate
    ? new Date(latestMaintenance.nextMaintenanceDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : false;

  if (!boat) {
    throw new Response("Boat not found", { status: 404 });
  }

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // Format boat data with dates as strings
  const formattedBoat = {
    ...boat,
    createdAt: formatDate(boat.createdAt),
    updatedAt: formatDate(boat.updatedAt),
  };

  // Format trip dates
  const formattedRecentTrips = recentTrips.map((trip) => ({
    ...trip,
    date: formatDate(trip.date),
  }));

  const formattedUpcomingTrips = upcomingTrips.map((trip) => ({
    ...trip,
    date: formatDate(trip.date),
  }));

  // Format images for the component
  const images: Image[] = boatImages.map((img) => ({
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

  // Format maintenance history dates
  const formattedMaintenanceHistory = maintenanceHistory.map((log) => ({
    ...log,
    performedAt: log.performedAt instanceof Date ? log.performedAt.toISOString() : String(log.performedAt),
    nextMaintenanceDate: log.nextMaintenanceDate ? String(log.nextMaintenanceDate) : null,
    createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt),
    cost: log.cost ? String(log.cost) : null,
  }));

  return {
    boat: formattedBoat,
    recentTrips: formattedRecentTrips,
    upcomingTrips: formattedUpcomingTrips,
    stats,
    images,
    maintenanceHistory: formattedMaintenanceHistory,
    maintenanceDue,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const boatId = params.id;

  if (!boatId) {
    return { error: "Boat ID required" };
  }

  if (intent === "toggle-active") {
    // Get current boat to toggle its status
    const boat = await getBoatById(organizationId, boatId);
    if (boat) {
      await updateBoatActiveStatus(organizationId, boatId, !boat.isActive);
    }
    return { toggled: true };
  }

  if (intent === "delete") {
    await deleteBoat(organizationId, boatId);
    return redirect("/tenant/boats");
  }

  if (intent === "log-maintenance") {
    const { db } = getTenantDb(organizationId);

    const type = formData.get("type") as string;
    const description = formData.get("description") as string;
    const performedBy = formData.get("performedBy") as string;
    const cost = formData.get("cost") as string;
    const notes = formData.get("notes") as string;
    const nextMaintenanceDate = formData.get("nextMaintenanceDate") as string;
    const nextMaintenanceType = formData.get("nextMaintenanceType") as string;

    await db.insert(maintenanceLogs).values({
      organizationId,
      boatId,
      type: type || "routine",
      description: description || "Maintenance performed",
      performedBy: performedBy || null,
      cost: cost ? cost : null,
      notes: notes || null,
      nextMaintenanceDate: nextMaintenanceDate || null,
      nextMaintenanceType: nextMaintenanceType || null,
      createdBy: ctx.user.id,
    });

    return { maintenanceLogged: true };
  }

  return null;
}

export default function BoatDetailPage() {
  const { boat, recentTrips, upcomingTrips, stats, images, maintenanceHistory, maintenanceDue } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this boat?")) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  const amenities = Array.isArray(boat.amenities) ? boat.amenities : [];

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/boats" className="text-blue-600 hover:underline text-sm">
          ← Back to Boats
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{boat.name}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                boat.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {boat.isActive ? "Active" : "Inactive"}
            </span>
            {maintenanceDue && (
              <span className="text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">
                Maintenance Due
              </span>
            )}
          </div>
          <p className="text-gray-500">
            {boat.type} • {boat.capacity} passengers
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/tenant/boats/${boat.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="toggle-active" />
            <button
              type="submit"
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              {boat.isActive ? "Deactivate" : "Activate"}
            </button>
          </fetcher.Form>
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
              <p className="text-2xl font-bold">{stats.totalTrips}</p>
              <p className="text-gray-500 text-sm">Total Trips</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.totalPassengers}</p>
              <p className="text-gray-500 text-sm">Passengers</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-green-600">{stats.totalRevenue}</p>
              <p className="text-gray-500 text-sm">Revenue</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.avgOccupancy}%</p>
              <p className="text-gray-500 text-sm">Avg Occupancy</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-3">Description</h2>
            <p className="text-gray-700">{boat.description}</p>
          </div>

          {/* Images */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Boat Images</h2>
            <ImageManager
              entityType="boat"
              entityId={boat.id}
              images={images}
              maxImages={5}
            />
          </div>

          {/* Amenities */}
          {Array.isArray(amenities) && amenities.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-3">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(amenities) ? amenities : []).map((a: string) => (
                  <span
                    key={a}
                    className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Trips */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Upcoming Trips</h2>
              <Link
                to={`/tenant/trips/new?boatId=${boat.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                + Schedule Trip
              </Link>
            </div>
            {upcomingTrips.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming trips.</p>
            ) : (
              <div className="space-y-3">
                {upcomingTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    to={`/tenant/trips/${trip.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">{trip.tourName}</p>
                      <p className="text-sm text-gray-500">{trip.date}</p>
                    </div>
                    <span className="text-sm">
                      {trip.bookedParticipants}/{trip.maxParticipants} booked
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Trips */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Recent Trips</h2>
              <Link
                to={`/tenant/trips?boatId=${boat.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                View All
              </Link>
            </div>
            {recentTrips.length === 0 ? (
              <p className="text-gray-500 text-sm">No trips yet.</p>
            ) : (
              <div className="space-y-3">
                {recentTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    to={`/tenant/trips/${trip.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">{trip.tourName}</p>
                      <p className="text-sm text-gray-500">
                        {trip.date} • {trip.participants} passengers
                      </p>
                    </div>
                    <span className="text-sm text-green-600">{trip.revenue}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span>{boat.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Capacity</span>
                <span>{boat.capacity} passengers</span>
              </div>
              {boat.registrationNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Registration</span>
                  <span>{boat.registrationNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Maintenance */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Maintenance</h2>
            {maintenanceHistory.length > 0 ? (
              <div className="space-y-3 text-sm mb-4">
                {maintenanceHistory.slice(0, 3).map((log) => (
                  <div key={log.id} className="border-b pb-2 last:border-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium capitalize">{log.type}</span>
                      <span className="text-gray-500 text-xs">
                        {new Date(log.performedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs mt-1">{log.description}</p>
                    {log.cost && (
                      <p className="text-gray-500 text-xs">${log.cost}</p>
                    )}
                  </div>
                ))}
                {maintenanceHistory.length > 3 && (
                  <p className="text-gray-500 text-xs">
                    +{maintenanceHistory.length - 3} more records
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm mb-4">No maintenance records yet.</p>
            )}
            <fetcher.Form method="post" className="space-y-3">
              <input type="hidden" name="intent" value="log-maintenance" />
              <div>
                <label className="block text-xs text-gray-600 mb-1">Type</label>
                <select
                  name="type"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                  required
                >
                  <option value="routine">Routine</option>
                  <option value="repair">Repair</option>
                  <option value="inspection">Inspection</option>
                  <option value="emergency">Emergency</option>
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
                  placeholder="Name or company"
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
                <label className="block text-xs text-gray-600 mb-1">Next Maintenance Date</label>
                <input
                  type="date"
                  name="nextMaintenanceDate"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="w-full text-center py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Log Maintenance
              </button>
            </fetcher.Form>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <Link
                to={`/tenant/trips/new?boatId=${boat.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                Schedule Trip
              </Link>
              <Link
                to={`/tenant/calendar?boatId=${boat.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                View Calendar
              </Link>
              <Link
                to={`/tenant/reports?boat=${boat.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                Export Report
              </Link>
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>Created: {boat.createdAt}</p>
            <p>Updated: {boat.updatedAt}</p>
            <p>ID: {boat.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
