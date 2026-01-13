import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
import {
  getTourById,
  getTourStats,
  getUpcomingTripsForTour,
} from "../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { ImageManager, type Image } from "../../../../app/components/ui";

export const meta: MetaFunction = () => [{ title: "Tour Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const tourId = params.id;

  if (!tourId) {
    throw new Response("Tour ID required", { status: 400 });
  }

  // Fetch tour data from database
  const tourData = await getTourById(tenant.schemaName, tourId);

  if (!tourData) {
    throw new Response("Tour not found", { status: 404 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(tenant.schemaName);

  // Fetch stats, upcoming trips, and images in parallel
  const [stats, upcomingTrips, tourImages] = await Promise.all([
    getTourStats(tenant.schemaName, tourId),
    getUpcomingTripsForTour(tenant.schemaName, tourId, 5),
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
          eq(schema.images.entityType, "tour"),
          eq(schema.images.entityId, tourId)
        )
      )
      .orderBy(asc(schema.images.sortOrder)),
  ]);

  // Format the tour data for the view
  const tour = {
    id: tourData.id,
    name: tourData.name,
    description: tourData.description || "",
    type: tourData.type,
    duration: tourData.duration || 0,
    maxParticipants: tourData.maxParticipants,
    minParticipants: tourData.minParticipants || 1,
    price: tourData.price.toFixed(2),
    currency: tourData.currency || "USD",
    includesEquipment: tourData.includesEquipment || false,
    includesMeals: tourData.includesMeals || false,
    includesTransport: tourData.includesTransport || false,
    inclusions: tourData.inclusions || [],
    exclusions: tourData.exclusions || [],
    minCertLevel: tourData.minCertLevel || null,
    minAge: tourData.minAge || null,
    requirements: tourData.requirements || [],
    isActive: tourData.isActive,
    createdAt: tourData.createdAt
      ? new Date(tourData.createdAt).toISOString().split("T")[0]
      : "",
    tripCount: stats.tripCount,
    totalRevenue: stats.totalRevenue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    averageRating: stats.averageRating,
  };

  // Format images for the component
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

  return { tour, upcomingTrips, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggle-active") {
    // TODO: Toggle tour active status
    return { toggled: true };
  }

  if (intent === "delete") {
    // TODO: Delete tour
    return { deleted: true };
  }

  return null;
}

const tourTypes: Record<string, string> = {
  single_dive: "Single Dive",
  multi_dive: "Multi-Dive",
  course: "Course",
  snorkel: "Snorkel",
  night_dive: "Night Dive",
  other: "Other",
};

export default function TourDetailPage() {
  const { tour, upcomingTrips, images } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutes`;
    if (mins === 0) return `${hours} hours`;
    return `${hours}h ${mins}min`;
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this tour? This cannot be undone.")) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/app/tours" className="text-blue-600 hover:underline text-sm">
          ← Back to Tours
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{tour.name}</h1>
            {!tour.isActive && (
              <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                Inactive
              </span>
            )}
          </div>
          <p className="text-gray-500">{tourTypes[tour.type] || tour.type}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/app/trips/new?tourId=${tour.id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Schedule Trip
          </Link>
          <Link
            to={`/app/tours/${tour.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
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
              <p className="text-2xl font-bold">${tour.price}</p>
              <p className="text-gray-500 text-sm">Price</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{tour.tripCount}</p>
              <p className="text-gray-500 text-sm">Trips Run</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">${tour.totalRevenue}</p>
              <p className="text-gray-500 text-sm">Total Revenue</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                {tour.averageRating !== null ? tour.averageRating : "-"}
              </p>
              <p className="text-gray-500 text-sm">Avg Rating</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-3">Description</h2>
            <p className="text-gray-700">{tour.description || "No description provided."}</p>
          </div>

          {/* Images */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Tour Images</h2>
            <ImageManager
              entityType="tour"
              entityId={tour.id}
              images={images}
              maxImages={5}
            />
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Tour Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Duration</p>
                <p>{formatDuration(tour.duration)}</p>
              </div>
              <div>
                <p className="text-gray-500">Capacity</p>
                <p>
                  {tour.minParticipants}-{tour.maxParticipants} participants
                </p>
              </div>
              <div>
                <p className="text-gray-500">Min Certification</p>
                <p>{tour.minCertLevel || "None required"}</p>
              </div>
              <div>
                <p className="text-gray-500">Min Age</p>
                <p>{tour.minAge ? `${tour.minAge} years` : "No minimum"}</p>
              </div>
            </div>
          </div>

          {/* Inclusions/Exclusions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">What's Included</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-green-700 mb-2">Included</h3>
                <ul className="space-y-1 text-sm">
                  {tour.includesEquipment && <li>✓ Equipment rental</li>}
                  {tour.includesMeals && <li>✓ Meals/snacks</li>}
                  {tour.includesTransport && <li>✓ Transport</li>}
                  {tour.inclusions?.map((item: string, i: number) => (
                    <li key={i}>✓ {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Not Included</h3>
                <ul className="space-y-1 text-sm text-gray-600">
                  {tour.exclusions?.map((item: string, i: number) => (
                    <li key={i}>• {item}</li>
                  ))}
                  {(!tour.exclusions || tour.exclusions.length === 0) && (
                    <li className="text-gray-400">None specified</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Upcoming Trips */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Upcoming Trips</h2>
              <Link
                to={`/app/trips?tourId=${tour.id}`}
                className="text-blue-600 text-sm hover:underline"
              >
                View all
              </Link>
            </div>
            {upcomingTrips.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming trips scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcomingTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    to={`/app/trips/${trip.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">
                        {trip.date} at {trip.startTime}
                      </p>
                      <p className="text-sm text-gray-500">{trip.boatName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {trip.spotsBooked}/{trip.maxSpots} spots
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          trip.status === "full"
                            ? "bg-red-100 text-red-700"
                            : trip.status === "confirmed"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {trip.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                to={`/app/trips/new?tourId=${tour.id}`}
                className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Schedule Trip
              </Link>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="toggle-active" />
                <button
                  type="submit"
                  className="w-full text-center border px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  {tour.isActive ? "Deactivate Tour" : "Activate Tour"}
                </button>
              </fetcher.Form>
              <Link
                to={`/app/tours/${tour.id}/duplicate`}
                className="block w-full text-center border px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                Duplicate Tour
              </Link>
            </div>
          </div>

          {/* Requirements */}
          {tour.requirements && tour.requirements.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Requirements</h2>
              <ul className="space-y-2 text-sm">
                {tour.requirements.map((req: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-yellow-500">⚠</span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-gray-400">
            <p>Created {tour.createdAt}</p>
            <p>Tour ID: {tour.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
