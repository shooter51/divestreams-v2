import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
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

export const meta: MetaFunction = () => [{ title: "Boat Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const boatId = params.id;

  if (!boatId) {
    throw new Response("Boat ID required", { status: 400 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(tenant.schemaName);

  // Fetch all data in parallel
  const [boat, recentTrips, upcomingTrips, stats, boatImages] = await Promise.all([
    getBoatById(tenant.schemaName, boatId),
    getBoatRecentTrips(tenant.schemaName, boatId),
    getBoatUpcomingTrips(tenant.schemaName, boatId),
    getBoatStats(tenant.schemaName, boatId),
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
          eq(schema.images.entityType, "boat"),
          eq(schema.images.entityId, boatId)
        )
      )
      .orderBy(asc(schema.images.sortOrder)),
  ]);

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

  return { boat: formattedBoat, recentTrips: formattedRecentTrips, upcomingTrips: formattedUpcomingTrips, stats, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const boatId = params.id;

  if (!boatId) {
    return { error: "Boat ID required" };
  }

  if (intent === "toggle-active") {
    // Get current boat to toggle its status
    const boat = await getBoatById(tenant.schemaName, boatId);
    if (boat) {
      await updateBoatActiveStatus(tenant.schemaName, boatId, !boat.isActive);
    }
    return { toggled: true };
  }

  if (intent === "delete") {
    await deleteBoat(tenant.schemaName, boatId);
    return redirect("/app/boats");
  }

  if (intent === "log-maintenance") {
    // TODO: Implement maintenance logging when maintenance_log table is added
    return { maintenanceLogged: true };
  }

  return null;
}

export default function BoatDetailPage() {
  const { boat, recentTrips, upcomingTrips, stats, images } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this boat?")) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  // Note: The boats table doesn't have maintenance fields in the current schema
  // These would need to be added to the schema if maintenance tracking is needed
  const amenities = Array.isArray(boat.amenities) ? boat.amenities : [];
  const maintenanceDue = false; // TODO: Add maintenance tracking to boats table

  return (
    <div>
      <div className="mb-6">
        <Link to="/app/boats" className="text-blue-600 hover:underline text-sm">
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
            to={`/app/boats/${boat.id}/edit`}
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
                to={`/app/trips/new?boatId=${boat.id}`}
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
                    to={`/app/trips/${trip.id}`}
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
                to={`/app/trips?boatId=${boat.id}`}
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
                    to={`/app/trips/${trip.id}`}
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
            <div className="space-y-3 text-sm">
              <p className="text-gray-500 text-sm">
                Maintenance tracking coming soon.
              </p>
            </div>
            <fetcher.Form method="post" className="mt-4">
              <input type="hidden" name="intent" value="log-maintenance" />
              <button
                type="submit"
                className="w-full text-center py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
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
                to={`/app/trips/new?boatId=${boat.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                Schedule Trip
              </Link>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                View Calendar
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                Export Report
              </button>
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
