import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getDiveSiteById } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { diveSiteSchema, validateFormData, getFormValues } from "../../../../../lib/validation";
import { ImageManager, type Image } from "../../../../../app/components/ui";
import { redirectWithNotification, useNotification } from "../../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "Edit Dive Site - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const siteId = params.id;

  if (!siteId) {
    throw new Response("Dive Site ID required", { status: 400 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(organizationId);

  const [siteData, siteImages] = await Promise.all([
    getDiveSiteById(organizationId, siteId),
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

  if (!siteData) {
    throw new Response("Dive site not found", { status: 404 });
  }

  const site = {
    id: siteData.id,
    name: siteData.name,
    description: siteData.description || "",
    maxDepth: siteData.maxDepth || 0,
    difficulty: siteData.difficulty || "intermediate",
    latitude: siteData.latitude,
    longitude: siteData.longitude,
    visibility: siteData.visibility || "",
    currentStrength: siteData.currentStrength || "",
    highlights: siteData.highlights || [],
    isActive: siteData.isActive,
  };

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

  return { site, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const siteId = params.id;

  if (!siteId) {
    throw new Response("Dive Site ID required", { status: 400 });
  }

  const formData = await request.formData();

  // Convert highlights array
  const highlightsRaw = formData.get("highlights") as string;
  if (highlightsRaw) {
    formData.set("highlights", JSON.stringify(highlightsRaw.split(",").map((s) => s.trim()).filter(Boolean)));
  }

  const validation = validateFormData(formData, diveSiteSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Update dive site in database
  const { db, schema } = getTenantDb(organizationId);

  await db
    .update(schema.diveSites)
    .set({
      name: validation.data.name,
      description: validation.data.description,
      maxDepth: validation.data.maxDepth,
      difficulty: validation.data.difficulty,
      latitude: validation.data.latitude?.toString(),
      longitude: validation.data.longitude?.toString(),
      visibility: validation.data.visibility,
      currentStrength: validation.data.currentStrength,
      highlights: validation.data.highlights,
      isActive: validation.data.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.diveSites.organizationId, organizationId), eq(schema.diveSites.id, siteId)));

  const diveSiteName = validation.data.name;
  return redirect(redirectWithNotification(`/tenant/dive-sites/${siteId}`, `Dive Site "${diveSiteName}" has been successfully updated`, "success"));
}

export default function EditDiveSitePage() {
  const { site, images } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Show notifications from URL params
  useNotification();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/tenant/dive-sites/${site.id}`} className="text-brand hover:underline text-sm">
          ← Back to Dive Site
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Dive Site</h1>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Site Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={actionData?.values?.name || site.name}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
              {actionData?.errors?.name && (
                <p className="text-danger text-sm mt-1">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={actionData?.values?.description || site.description}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Dive Details */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Dive Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maxDepth" className="block text-sm font-medium mb-1">
                Maximum Depth (meters) *
              </label>
              <input
                type="number"
                id="maxDepth"
                name="maxDepth"
                required
                min="1"
                max="100"
                defaultValue={actionData?.values?.maxDepth || site.maxDepth}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="difficulty" className="block text-sm font-medium mb-1">
                Difficulty Level *
              </label>
              <select
                id="difficulty"
                name="difficulty"
                required
                defaultValue={actionData?.values?.difficulty || site.difficulty}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div>
              <label htmlFor="visibility" className="block text-sm font-medium mb-1">
                Typical Visibility
              </label>
              <input
                type="text"
                id="visibility"
                name="visibility"
                placeholder="e.g., 15-25m"
                defaultValue={actionData?.values?.visibility || site.visibility}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="currentStrength" className="block text-sm font-medium mb-1">
                Current Strength
              </label>
              <select
                id="currentStrength"
                name="currentStrength"
                defaultValue={actionData?.values?.currentStrength || site.currentStrength}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              >
                <option value="">Select...</option>
                <option value="none">None</option>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="strong">Strong</option>
              </select>
            </div>
          </div>
        </div>

        {/* Coordinates */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">GPS Coordinates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="latitude" className="block text-sm font-medium mb-1">
                Latitude
              </label>
              <input
                type="number"
                id="latitude"
                name="latitude"
                step="0.000001"
                min="-90"
                max="90"
                defaultValue={actionData?.values?.latitude || site.latitude || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="longitude" className="block text-sm font-medium mb-1">
                Longitude
              </label>
              <input
                type="number"
                id="longitude"
                name="longitude"
                step="0.000001"
                min="-180"
                max="180"
                defaultValue={actionData?.values?.longitude || site.longitude || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Site Images</h2>
          <ImageManager
            entityType="dive-site"
            entityId={site.id}
            images={images}
            maxImages={5}
          />
        </div>

        {/* Highlights */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Highlights & Features</h2>
          <div>
            <label htmlFor="highlights" className="block text-sm font-medium mb-1">
              Key Attractions
            </label>
            <input
              type="text"
              id="highlights"
              name="highlights"
              placeholder="e.g., Sharks, Corals, Wall dive (comma-separated)"
              defaultValue={actionData?.values?.highlights || site.highlights?.join(", ")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>

        {/* Status */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={actionData?.values?.isActive !== "false" && site.isActive}
              className="rounded"
            />
            <span className="font-medium">Active</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            to={`/tenant/dive-sites/${site.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
