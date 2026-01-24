import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireTenant } from "../../../../../lib/auth/org-context.server";
import { getBoatById } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { boatSchema, validateFormData, getFormValues } from "../../../../../lib/validation";
import { ImageManager, type Image } from "../../../../../app/components/ui";

export const meta: MetaFunction = () => [{ title: "Edit Boat - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const boatId = params.id;

  if (!boatId) {
    throw new Response("Boat ID required", { status: 400 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(organizationId);

  const [boatData, boatImages] = await Promise.all([
    getBoatById(organizationId, boatId),
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
  ]);

  if (!boatData) {
    throw new Response("Boat not found", { status: 404 });
  }

  const boat = {
    id: boatData.id,
    name: boatData.name,
    type: boatData.type || "",
    capacity: boatData.capacity,
    description: boatData.description || "",
    registrationNumber: boatData.registrationNumber || "",
    amenities: boatData.amenities || [],
    isActive: boatData.isActive,
  };

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

  return { boat, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const boatId = params.id;

  if (!boatId) {
    throw new Response("Boat ID required", { status: 400 });
  }

  const formData = await request.formData();

  // Convert amenities array
  const amenitiesRaw = formData.get("amenities") as string;
  if (amenitiesRaw) {
    formData.set("amenities", JSON.stringify(amenitiesRaw.split(",").map((s) => s.trim()).filter(Boolean)));
  }

  const validation = validateFormData(formData, boatSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Update boat in database
  const { db, schema } = getTenantDb(organizationId);

  await db
    .update(schema.boats)
    .set({
      name: validation.data.name,
      type: validation.data.type,
      capacity: validation.data.capacity,
      description: validation.data.description,
      registrationNumber: validation.data.registrationNumber,
      amenities: validation.data.amenities,
      isActive: validation.data.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.boats.organizationId, organizationId), eq(schema.boats.id, boatId)));

  return redirect(`/tenant/boats/${boatId}`);
}

export default function EditBoatPage() {
  const { boat, images } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/tenant/boats/${boat.id}`} className="text-blue-600 hover:underline text-sm">
          ← Back to Boat
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Boat</h1>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Boat Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={actionData?.values?.name || boat.name}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {actionData?.errors?.name && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-1">
                  Boat Type
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={actionData?.values?.type || boat.type}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type...</option>
                  <option value="Dive Boat">Dive Boat</option>
                  <option value="Speed Boat">Speed Boat</option>
                  <option value="Catamaran">Catamaran</option>
                  <option value="Yacht">Yacht</option>
                  <option value="RIB">RIB (Rigid Inflatable)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="capacity" className="block text-sm font-medium mb-1">
                  Passenger Capacity *
                </label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  required
                  min="1"
                  max="100"
                  defaultValue={actionData?.values?.capacity || boat.capacity}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={actionData?.values?.description || boat.description}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
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

        {/* Registration */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Registration</h2>
          <div>
            <label htmlFor="registrationNumber" className="block text-sm font-medium mb-1">
              Registration Number
            </label>
            <input
              type="text"
              id="registrationNumber"
              name="registrationNumber"
              defaultValue={actionData?.values?.registrationNumber || boat.registrationNumber}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Amenities */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Amenities</h2>
          <div>
            <label htmlFor="amenities" className="block text-sm font-medium mb-1">
              Amenities
            </label>
            <input
              type="text"
              id="amenities"
              name="amenities"
              placeholder="e.g., Dive platform, Sun deck, Toilet (comma-separated)"
              defaultValue={actionData?.values?.amenities || boat.amenities?.join(", ")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={actionData?.values?.isActive !== "false" && boat.isActive}
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
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            to={`/tenant/boats/${boat.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
