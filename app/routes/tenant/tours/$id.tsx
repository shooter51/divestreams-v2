import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import {
  getTourById,
  getTourStats,
  getUpcomingTripsForTour,
  getDiveSitesForTour,
  updateTourActiveStatus,
  deleteTour,
} from "../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { ImageManager, type Image } from "../../../../app/components/ui";

export const meta: MetaFunction = () => [{ title: "Tour Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const tourId = params.id;

  if (!tourId) {
    throw new Response("Tour ID required", { status: 400 });
  }

  // Fetch tour data from database
  const tourData = await getTourById(organizationId, tourId);

  if (!tourData) {
    throw new Response("Tour not found", { status: 404 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(organizationId);

  // Fetch stats, upcoming trips, dive sites, and images in parallel
  const [stats, upcomingTrips, diveSites, tourImages] = await Promise.all([
    getTourStats(organizationId, tourId),
    getUpcomingTripsForTour(organizationId, tourId, 5),
    getDiveSitesForTour(organizationId, tourId, 10),
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
          eq(schema.images.entityType, "tour"),
          eq(schema.images.entityId, tourId)
        )
      )
      .orderBy(asc(schema.images.sortOrder)),
  ]);

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // Format upcomingTrips dates
  const formattedUpcomingTrips = upcomingTrips.map((trip) => ({
    ...trip,
    date: formatDate(trip.date),
  }));

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

  return { tour, upcomingTrips: formattedUpcomingTrips, diveSites, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const tourId = params.id!;

  if (intent === "toggle-active") {
    // Get current tour status and toggle it
    const tour = await getTourById(organizationId, tourId);
    if (tour) {
      await updateTourActiveStatus(organizationId, tourId, !tour.isActive);
    }
    return { toggled: true };
  }

  if (intent === "delete") {
    try {
      await deleteTour(organizationId, tourId);
      return redirect("/tenant/tours");
    } catch (error: any) {
      return { deleteError: error.message || "Failed to delete tour" };
    }
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
  const { tour, upcomingTrips, diveSites, images } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const actionData = fetcher.data as { deleteError?: string } | undefined;

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
        <Link to="/tenant/tours" className="text-brand hover:underline text-sm">
          ← Back to Tours
        </Link>
      </div>

      {/* Show delete error if any */}
      {actionData?.deleteError && (
        <div className="mb-6 p-4 bg-danger-muted border border-danger rounded-lg">
          <p className="text-danger font-medium">Cannot delete tour</p>
          <p className="text-danger text-sm mt-1">{actionData.deleteError}</p>
        </div>
      )}

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{tour.name}</h1>
            {!tour.isActive && (
              <span className="text-sm bg-surface-inset text-foreground-muted px-2 py-1 rounded">
                Inactive
              </span>
            )}
          </div>
          <p className="text-foreground-muted">{tourTypes[tour.type] || tour.type}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/tenant/trips/new?tourId=${tour.id}`}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
          >
            Schedule Trip
          </Link>
          <Link
            to={`/tenant/tours/${tour.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
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
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">${tour.price}</p>
              <p className="text-foreground-muted text-sm">Price</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{tour.tripCount}</p>
              <p className="text-foreground-muted text-sm">Trips Run</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">${tour.totalRevenue}</p>
              <p className="text-foreground-muted text-sm">Total Revenue</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                {tour.averageRating !== null ? tour.averageRating : "-"}
              </p>
              <p className="text-foreground-muted text-sm">Avg Rating</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-3">Description</h2>
            <p className="text-foreground">{tour.description || "No description provided."}</p>
          </div>

          {/* Images */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Tour Images</h2>
            <ImageManager
              entityType="tour"
              entityId={tour.id}
              images={images}
              maxImages={5}
            />
          </div>

          {/* Details */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Tour Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-foreground-muted">Duration</p>
                <p>{formatDuration(tour.duration)}</p>
              </div>
              <div>
                <p className="text-foreground-muted">Capacity</p>
                <p>
                  {tour.minParticipants}-{tour.maxParticipants} participants
                </p>
              </div>
              <div>
                <p className="text-foreground-muted">Min Certification</p>
                <p>{tour.minCertLevel || "None required"}</p>
              </div>
              <div>
                <p className="text-foreground-muted">Min Age</p>
                <p>{tour.minAge ? `${tour.minAge} years` : "No minimum"}</p>
              </div>
            </div>
          </div>

          {/* Inclusions/Exclusions */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">What's Included</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-success mb-2">Included</h3>
                <ul className="space-y-1 text-sm">
                  {tour.includesEquipment && <li>✓ Equipment rental</li>}
                  {tour.includesMeals && <li>✓ Meals/snacks</li>}
                  {tour.includesTransport && <li>✓ Transport</li>}
                  {(Array.isArray(tour.inclusions) ? tour.inclusions : []).map((item: string, i: number) => (
                    <li key={i}>✓ {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground-muted mb-2">Not Included</h3>
                <ul className="space-y-1 text-sm text-foreground-muted">
                  {(Array.isArray(tour.exclusions) ? tour.exclusions : []).map((item: string, i: number) => (
                    <li key={i}>• {item}</li>
                  ))}
                  {(!Array.isArray(tour.exclusions) || tour.exclusions.length === 0) && (
                    <li className="text-foreground-subtle">None specified</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Dive Sites Visited */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Dive Sites Visited</h2>
              <Link
                to={`/tenant/dive-sites`}
                className="text-brand text-sm hover:underline"
              >
                View all sites
              </Link>
            </div>
            {diveSites.length === 0 ? (
              <p className="text-foreground-muted text-sm">No dive sites assigned to this tour yet.</p>
            ) : (
              <div className="space-y-2">
                {diveSites.map((site) => (
                  <Link
                    key={site.id}
                    to={`/tenant/dive-sites/${site.id}`}
                    className="block p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{site.name}</p>
                        {site.difficulty && (
                          <p className="text-sm text-foreground-muted capitalize">{site.difficulty} difficulty</p>
                        )}
                      </div>
                      {site.maxDepth && (
                        <p className="text-sm text-foreground-muted">{site.maxDepth}m max depth</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Trips */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Upcoming Trips</h2>
              <Link
                to={`/tenant/trips?tourId=${tour.id}`}
                className="text-brand text-sm hover:underline"
              >
                View all
              </Link>
            </div>
            {upcomingTrips.length === 0 ? (
              <p className="text-foreground-muted text-sm">No upcoming trips scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcomingTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    to={`/tenant/trips/${trip.id}`}
                    className="flex justify-between items-center p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay"
                  >
                    <div>
                      <p className="font-medium">
                        {trip.date} at {trip.time}
                      </p>
                      <p className="text-sm text-foreground-muted">{trip.boatName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {trip.bookedParticipants}/{trip.maxParticipants} spots
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          trip.bookedParticipants >= trip.maxParticipants
                            ? "bg-danger-muted text-danger"
                            : trip.bookedParticipants > 0
                            ? "bg-success-muted text-success"
                            : "bg-brand-muted text-brand"
                        }`}
                      >
                        {trip.bookedParticipants >= trip.maxParticipants ? "Full" : trip.bookedParticipants > 0 ? "Booked" : "Open"}
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
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                to={`/tenant/trips/new?tourId=${tour.id}`}
                className="block w-full text-center bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
              >
                Schedule Trip
              </Link>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="toggle-active" />
                <button
                  type="submit"
                  className="w-full text-center border px-4 py-2 rounded-lg hover:bg-surface-inset"
                >
                  {tour.isActive ? "Deactivate Tour" : "Activate Tour"}
                </button>
              </fetcher.Form>
              <Link
                to={`/tenant/tours/${tour.id}/duplicate`}
                className="block w-full text-center border px-4 py-2 rounded-lg hover:bg-surface-inset"
              >
                Duplicate Tour
              </Link>
            </div>
          </div>

          {/* Requirements */}
          {Array.isArray(tour.requirements) && tour.requirements.length > 0 && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Requirements</h2>
              <ul className="space-y-2 text-sm">
                {(Array.isArray(tour.requirements) ? tour.requirements : []).map((req: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-warning">⚠</span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-foreground-subtle">
            <p>Created {tour.createdAt}</p>
            <p>Tour ID: {tour.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
