import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
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
import { redirectWithNotification, useNotification } from "../../../../lib/use-notification";
import { CsrfInput } from "../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Dive Site Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const siteId = params.id;

  if (!siteId) {
    throw new Response("Dive Site ID required", { status: 400 });
  }

  // Fetch dive site data from database
  const siteData = await getDiveSiteById(organizationId, siteId);

  if (!siteData) {
    throw new Response("Dive site not found", { status: 404 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(organizationId);

  // Fetch stats, recent trips, related tours, and images in parallel
  const [stats, recentTrips, toursUsingSite, siteImages] = await Promise.all([
    getDiveSiteStats(organizationId, siteId),
    getRecentTripsForDiveSite(organizationId, siteId, 5),
    getToursUsingDiveSite(organizationId, siteId, 5),
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
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const siteId = params.id!;

  if (intent === "toggle-active") {
    // Get current site status and toggle it
    const site = await getDiveSiteById(organizationId, siteId);
    if (site) {
      await updateDiveSiteActiveStatus(organizationId, siteId, !site.isActive);
    }
    return { toggled: true };
  }

  if (intent === "delete") {
    try {
      const site = await getDiveSiteById(organizationId, siteId);
      const siteName = site?.name || "Dive site";
      await deleteDiveSite(organizationId, siteId);
      return redirect(redirectWithNotification("/tenant/dive-sites", `${siteName} has been successfully deleted`, "success"));
    } catch (error: unknown) {
      return { deleteError: error instanceof Error ? error.message : "Failed to delete dive site" };
    }
  }

  return null;
}

const difficultyColors: Record<string, string> = {
  beginner: "bg-success-muted text-success",
  intermediate: "bg-brand-muted text-brand",
  advanced: "bg-accent-muted text-accent",
  expert: "bg-danger-muted text-danger",
};

export default function DiveSiteDetailPage() {
  const { diveSite, recentTrips, stats, toursUsingSite, images } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const actionData = fetcher.data as { deleteError?: string } | undefined;

  // Show notifications from URL params
  useNotification();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this dive site?")) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/dive-sites" className="text-brand hover:underline text-sm">
          ← Back to Dive Sites
        </Link>
      </div>

      {/* Show delete error if any */}
      {actionData?.deleteError && (
        <div className="mb-6 p-4 bg-danger-muted border border-danger rounded-lg">
          <p className="text-danger font-medium">Cannot delete dive site</p>
          <p className="text-danger text-sm mt-1">{actionData.deleteError}</p>
        </div>
      )}

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
              <span className="text-sm px-3 py-1 rounded-full bg-surface-inset text-foreground-muted">
                Inactive
              </span>
            )}
          </div>
          <p className="text-foreground-muted">{diveSite.location}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/tenant/dive-sites/${diveSite.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Edit
          </Link>
          <fetcher.Form method="post">
            <CsrfInput />
            <input type="hidden" name="intent" value="toggle-active" />
            <button
              type="submit"
              className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
            >
              {diveSite.isActive ? "Deactivate" : "Activate"}
            </button>
          </fetcher.Form>
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
              <p className="text-2xl font-bold">{stats.totalTrips}</p>
              <p className="text-foreground-muted text-sm">Total Trips</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.totalDivers}</p>
              <p className="text-foreground-muted text-sm">Total Divers</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{diveSite.maxDepth}m</p>
              <p className="text-foreground-muted text-sm">Max Depth</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-warning">
                {stats.avgRating !== null ? stats.avgRating : "-"}
              </p>
              <p className="text-foreground-muted text-sm">Avg Rating</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-3">Description</h2>
            <p className="text-foreground">{diveSite.description}</p>
          </div>

          {/* Images */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Site Images</h2>
            <ImageManager
              entityType="dive-site"
              entityId={diveSite.id}
              images={images}
              maxImages={5}
            />
          </div>

          {/* Conditions */}
          {diveSite.conditions && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-3">Typical Conditions</h2>
              <p className="text-foreground">{diveSite.conditions}</p>
            </div>
          )}

          {/* Highlights */}
          {Array.isArray(diveSite.highlights) && diveSite.highlights.length > 0 && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-3">Highlights</h2>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(diveSite.highlights) ? diveSite.highlights : []).map((h: string) => (
                  <span
                    key={h}
                    className="bg-brand-muted text-brand px-3 py-1 rounded-full text-sm"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Trips */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Recent Trips</h2>
              <Link
                to={`/tenant/trips?siteId=${diveSite.id}`}
                className="text-sm text-brand hover:underline"
              >
                View All
              </Link>
            </div>
            {recentTrips.length === 0 ? (
              <p className="text-foreground-muted text-sm">No trips to this site yet.</p>
            ) : (
              <div className="space-y-3">
                {recentTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    to={`/tenant/trips/${trip.id}`}
                    className="flex justify-between items-center p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay"
                  >
                    <div>
                      <p className="font-medium">{trip.tourName}</p>
                      <p className="text-sm text-foreground-muted">
                        {trip.date} • {trip.participants} divers
                      </p>
                    </div>
                    {trip.conditions && (
                      <span className="text-xs text-foreground-subtle">{trip.conditions}</span>
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
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Location</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground-muted">Area</span>
                <span>{diveSite.location}</span>
              </div>
              {diveSite.coordinates && (
                <>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Latitude</span>
                    <span>{diveSite.coordinates.lat}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Longitude</span>
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
                className="block text-center mt-4 text-brand text-sm hover:underline"
              >
                Open in Google Maps
              </a>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <Link
                to={`/tenant/trips/new?siteId=${diveSite.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
              >
                Schedule Trip Here
              </Link>
              {diveSite.coordinates ? (
                <a
                  href={`https://www.google.com/maps?q=${diveSite.coordinates.lat},${diveSite.coordinates.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
                >
                  View on Map
                </a>
              ) : (
                <button
                  disabled
                  className="w-full text-left px-3 py-2 text-sm text-foreground-subtle cursor-not-allowed rounded-lg"
                >
                  View on Map (no coordinates)
                </button>
              )}
              <button
                onClick={() => {
                  const printWindow = window.open("", "_blank");
                  if (!printWindow) return;
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>${diveSite.name} - Dive Site Info</title>
                      <style>
                        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                        h1 { margin-bottom: 5px; }
                        .subtitle { color: #666; margin-bottom: 20px; }
                        .section { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
                        .section h2 { font-size: 16px; margin: 0 0 10px 0; }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                        .item label { font-size: 12px; color: #666; display: block; }
                        .item span { font-weight: bold; }
                        .tag { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; margin-right: 5px; font-size: 14px; }
                        @media print { body { padding: 0; } }
                      </style>
                    </head>
                    <body>
                      <h1>${diveSite.name}</h1>
                      <p class="subtitle">Dive Site Information</p>

                      <div class="section">
                        <h2>Details</h2>
                        <div class="grid">
                          <div class="item"><label>Max Depth</label><span>${diveSite.maxDepth}m</span></div>
                          <div class="item"><label>Difficulty</label><span>${diveSite.difficulty}</span></div>
                          ${diveSite.coordinates ? `<div class="item"><label>Coordinates</label><span>${diveSite.coordinates.lat}, ${diveSite.coordinates.lng}</span></div>` : ""}
                          <div class="item"><label>Conditions</label><span>${diveSite.conditions || "Variable"}</span></div>
                        </div>
                      </div>

                      ${diveSite.description ? `<div class="section"><h2>Description</h2><p>${diveSite.description}</p></div>` : ""}

                      ${diveSite.highlights && diveSite.highlights.length > 0 ? `
                        <div class="section">
                          <h2>Highlights</h2>
                          <div>${diveSite.highlights.map((h: string) => `<span class="tag">${h}</span>`).join("")}</div>
                        </div>
                      ` : ""}

                      <script>window.onload = function() { window.print(); }</script>
                    </body>
                    </html>
                  `);
                  printWindow.document.close();
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
              >
                Export Site Info
              </button>
            </div>
          </div>

          {/* Tours Using This Site */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Used In Tours</h2>
            {toursUsingSite.length === 0 ? (
              <p className="text-foreground-muted text-sm">No tours have visited this site yet.</p>
            ) : (
              <div className="space-y-2">
                {toursUsingSite.map((tour) => (
                  <Link
                    key={tour.id}
                    to={`/tenant/tours/${tour.id}`}
                    className="block text-sm text-brand hover:underline"
                  >
                    {tour.name}
                  </Link>
                ))}
              </div>
            )}
            {toursUsingSite.length > 0 && (
              <Link
                to={`/tenant/tours?siteId=${diveSite.id}`}
                className="block text-center mt-4 text-foreground-muted text-xs hover:underline"
              >
                View all tours
              </Link>
            )}
          </div>

          {/* Meta */}
          <div className="text-xs text-foreground-subtle space-y-1">
            <p>Created: {diveSite.createdAt}</p>
            <p>Updated: {diveSite.updatedAt}</p>
            <p>ID: {diveSite.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
