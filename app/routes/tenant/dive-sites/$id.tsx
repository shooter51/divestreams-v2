import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
import {
  getDiveSiteById,
  getDiveSiteStats,
  getRecentTripsForDiveSite,
  getToursUsingDiveSite,
  updateDiveSiteActiveStatus,
  deleteDiveSite,
} from "../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { ImageManager, type Image } from "../../../../app/components/ui";

export const meta: MetaFunction = () => [{ title: "Dive Site Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const siteId = params.id;

  if (!siteId) {
    throw new Response("Dive Site ID required", { status: 400 });
  }

  // Fetch dive site data from database
  const siteData = await getDiveSiteById(tenant.schemaName, siteId);

  if (!siteData) {
    throw new Response("Dive site not found", { status: 404 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(tenant.schemaName);

  // Fetch stats, recent trips, related tours, and images in parallel
  const [stats, recentTrips, toursUsingSite, siteImages] = await Promise.all([
    getDiveSiteStats(tenant.schemaName, siteId),
    getRecentTripsForDiveSite(tenant.schemaName, siteId, 5),
    getToursUsingDiveSite(tenant.schemaName, siteId, 5),
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
          eq(schema.images.entityType, "dive-site"),
          eq(schema.images.entityId, siteId)
        )
      )
      .orderBy(asc(schema.images.sortOrder)),
  ]);

  // Format the dive site data for the view
  const diveSite = {
    id: siteData.id,
    name: siteData.name,
    location: siteData.visibility || "", // Using visibility as location fallback, adjust as needed
    maxDepth: siteData.maxDepth || 0,
    difficulty: siteData.difficulty || "beginner",
    description: siteData.description || "",
    coordinates:
      siteData.latitude && siteData.longitude
        ? { lat: siteData.latitude, lng: siteData.longitude }
        : null,
    conditions: siteData.currentStrength
      ? `Current: ${siteData.currentStrength}. Visibility: ${siteData.visibility || "Variable"}.`
      : null,
    highlights: siteData.highlights || [],
    isActive: siteData.isActive,
    createdAt: siteData.createdAt
      ? new Date(siteData.createdAt).toISOString().split("T")[0]
      : "",
    updatedAt: siteData.updatedAt
      ? new Date(siteData.updatedAt).toISOString().split("T")[0]
      : "",
  };

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // Format recent trips dates
  const formattedRecentTrips = recentTrips.map((trip) => ({
    ...trip,
    date: formatDate(trip.date),
  }));

  // Format images for the component
  const images: Image[] = siteImages.map((img) => ({
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

  return { diveSite, recentTrips: formattedRecentTrips, stats, toursUsingSite, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const siteId = params.id!;

  if (intent === "toggle-active") {
    // Get current site status and toggle it
    const site = await getDiveSiteById(tenant.schemaName, siteId);
    if (site) {
      await updateDiveSiteActiveStatus(tenant.schemaName, siteId, !site.isActive);
    }
    return { toggled: true };
  }

  if (intent === "delete") {
    await deleteDiveSite(tenant.schemaName, siteId);
    return { deleted: true };
  }

  return null;
}

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-blue-100 text-blue-700",
  advanced: "bg-orange-100 text-orange-700",
  expert: "bg-red-100 text-red-700",
};

export default function DiveSiteDetailPage() {
  const { diveSite, recentTrips, stats, toursUsingSite, images } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this dive site?")) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/app/dive-sites" className="text-blue-600 hover:underline text-sm">
          ← Back to Dive Sites
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{diveSite.name}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                difficultyColors[diveSite.difficulty]
              }`}
            >
              {diveSite.difficulty}
            </span>
            {!diveSite.isActive && (
              <span className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                Inactive
              </span>
            )}
          </div>
          <p className="text-gray-500">{diveSite.location}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/app/dive-sites/${diveSite.id}/edit`}
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
              {diveSite.isActive ? "Deactivate" : "Activate"}
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
              <p className="text-2xl font-bold">{stats.totalDivers}</p>
              <p className="text-gray-500 text-sm">Total Divers</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{diveSite.maxDepth}m</p>
              <p className="text-gray-500 text-sm">Max Depth</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-yellow-500">
                {stats.avgRating !== null ? stats.avgRating : "-"}
              </p>
              <p className="text-gray-500 text-sm">Avg Rating</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-3">Description</h2>
            <p className="text-gray-700">{diveSite.description}</p>
          </div>

          {/* Images */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Site Images</h2>
            <ImageManager
              entityType="diveSite"
              entityId={diveSite.id}
              images={images}
              maxImages={5}
            />
          </div>

          {/* Conditions */}
          {diveSite.conditions && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-3">Typical Conditions</h2>
              <p className="text-gray-700">{diveSite.conditions}</p>
            </div>
          )}

          {/* Highlights */}
          {diveSite.highlights.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-3">Highlights</h2>
              <div className="flex flex-wrap gap-2">
                {diveSite.highlights.map((h: string) => (
                  <span
                    key={h}
                    className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Trips */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Recent Trips</h2>
              <Link
                to={`/app/trips?siteId=${diveSite.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                View All
              </Link>
            </div>
            {recentTrips.length === 0 ? (
              <p className="text-gray-500 text-sm">No trips to this site yet.</p>
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
                        {trip.date} • {trip.participants} divers
                      </p>
                    </div>
                    {trip.conditions && (
                      <span className="text-xs text-gray-400">{trip.conditions}</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Location */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Location</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Area</span>
                <span>{diveSite.location}</span>
              </div>
              {diveSite.coordinates && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Latitude</span>
                    <span>{diveSite.coordinates.lat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Longitude</span>
                    <span>{diveSite.coordinates.lng}</span>
                  </div>
                </>
              )}
            </div>
            {diveSite.coordinates && (
              <a
                href={`https://www.google.com/maps?q=${diveSite.coordinates.lat},${diveSite.coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center mt-4 text-blue-600 text-sm hover:underline"
              >
                Open in Google Maps
              </a>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <Link
                to={`/app/trips/new?siteId=${diveSite.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                Schedule Trip Here
              </Link>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                View on Map
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                Export Site Info
              </button>
            </div>
          </div>

          {/* Tours Using This Site */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Used In Tours</h2>
            {toursUsingSite.length === 0 ? (
              <p className="text-gray-500 text-sm">No tours have visited this site yet.</p>
            ) : (
              <div className="space-y-2">
                {toursUsingSite.map((tour) => (
                  <Link
                    key={tour.id}
                    to={`/app/tours/${tour.id}`}
                    className="block text-sm text-blue-600 hover:underline"
                  >
                    {tour.name}
                  </Link>
                ))}
              </div>
            )}
            {toursUsingSite.length > 0 && (
              <Link
                to={`/app/tours?siteId=${diveSite.id}`}
                className="block text-center mt-4 text-gray-500 text-xs hover:underline"
              >
                View all tours
              </Link>
            )}
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>Created: {diveSite.createdAt}</p>
            <p>Updated: {diveSite.updatedAt}</p>
            <p>ID: {diveSite.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
