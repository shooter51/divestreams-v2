import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireTenant } from "../../../../../lib/auth/tenant-auth.server";
import { getTourById } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { tourSchema, validateFormData, getFormValues } from "../../../../../lib/validation";
import { ImageManager, type Image } from "../../../../components/ui";

export const meta: MetaFunction = () => [{ title: "Edit Tour - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const tourId = params.id;

  if (!tourId) {
    throw new Response("Tour ID required", { status: 400 });
  }

  const tourData = await getTourById(tenant.schemaName, tourId);

  if (!tourData) {
    throw new Response("Tour not found", { status: 404 });
  }

  // Get images
  const { db, schema } = getTenantDb(tenant.schemaName);
  const tourImages = await db
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
    .orderBy(asc(schema.images.sortOrder));

  const tour = {
    id: tourData.id,
    name: tourData.name,
    description: tourData.description || "",
    type: tourData.type,
    duration: tourData.duration || 120,
    maxParticipants: tourData.maxParticipants,
    minParticipants: tourData.minParticipants || 1,
    price: tourData.price.toString(),
    currency: tourData.currency || "USD",
    includesEquipment: tourData.includesEquipment || false,
    includesMeals: tourData.includesMeals || false,
    includesTransport: tourData.includesTransport || false,
    inclusions: tourData.inclusions || [],
    exclusions: tourData.exclusions || [],
    minCertLevel: tourData.minCertLevel || "",
    minAge: tourData.minAge || null,
    requirements: tourData.requirements || [],
    isActive: tourData.isActive,
  };

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

  return { tour, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const tourId = params.id;

  if (!tourId) {
    throw new Response("Tour ID required", { status: 400 });
  }

  const formData = await request.formData();

  // Parse arrays from comma-separated strings
  const inclusionsStr = formData.get("inclusionsStr") as string;
  const exclusionsStr = formData.get("exclusionsStr") as string;
  const requirementsStr = formData.get("requirementsStr") as string;

  if (inclusionsStr) {
    formData.set("inclusions", JSON.stringify(inclusionsStr.split(",").map((s) => s.trim()).filter(Boolean)));
  }
  if (exclusionsStr) {
    formData.set("exclusions", JSON.stringify(exclusionsStr.split(",").map((s) => s.trim()).filter(Boolean)));
  }
  if (requirementsStr) {
    formData.set("requirements", JSON.stringify(requirementsStr.split(",").map((s) => s.trim()).filter(Boolean)));
  }

  const validation = validateFormData(formData, tourSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Update tour in database
  const { db, schema } = getTenantDb(tenant.schemaName);

  await db
    .update(schema.tours)
    .set({
      name: validation.data.name,
      description: validation.data.description,
      type: validation.data.type,
      duration: validation.data.duration,
      maxParticipants: validation.data.maxParticipants,
      minParticipants: validation.data.minParticipants,
      price: validation.data.price.toString(),
      currency: validation.data.currency,
      includesEquipment: validation.data.includesEquipment,
      includesMeals: validation.data.includesMeals,
      includesTransport: validation.data.includesTransport,
      inclusions: validation.data.inclusions,
      exclusions: validation.data.exclusions,
      minCertLevel: validation.data.minCertLevel,
      minAge: validation.data.minAge,
      requirements: validation.data.requirements,
      isActive: validation.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(schema.tours.id, tourId));

  return redirect(`/app/tours/${tourId}`);
}

export default function EditTourPage() {
  const { tour, images } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/app/tours/${tour.id}`} className="text-blue-600 hover:underline text-sm">
          ← Back to Tour
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Tour</h1>
        <p className="text-gray-500">Update tour details and images.</p>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Tour Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                defaultValue={actionData?.values?.name || tour.name}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {actionData?.errors?.name && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.name}</p>
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
                defaultValue={actionData?.values?.description || tour.description}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-1">
                  Tour Type *
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={actionData?.values?.type || tour.type}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="single_dive">Single Dive</option>
                  <option value="multi_dive">Multi-Dive</option>
                  <option value="course">Course</option>
                  <option value="snorkel">Snorkel</option>
                  <option value="night_dive">Night Dive</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="duration" className="block text-sm font-medium mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  id="duration"
                  name="duration"
                  min="1"
                  defaultValue={actionData?.values?.duration || tour.duration}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pricing & Capacity */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Pricing & Capacity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-1">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  id="price"
                  name="price"
                  step="0.01"
                  min="0"
                  defaultValue={actionData?.values?.price || tour.price}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              {actionData?.errors?.price && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.price}</p>
              )}
            </div>

            <div>
              <label htmlFor="currency" className="block text-sm font-medium mb-1">
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                defaultValue={actionData?.values?.currency || tour.currency}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AUD">AUD</option>
                <option value="THB">THB</option>
                <option value="IDR">IDR</option>
                <option value="MXN">MXN</option>
              </select>
            </div>

            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium mb-1">
                Max Participants *
              </label>
              <input
                type="number"
                id="maxParticipants"
                name="maxParticipants"
                min="1"
                defaultValue={actionData?.values?.maxParticipants || tour.maxParticipants}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {actionData?.errors?.maxParticipants && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.maxParticipants}</p>
              )}
            </div>

            <div>
              <label htmlFor="minParticipants" className="block text-sm font-medium mb-1">
                Min Participants
              </label>
              <input
                type="number"
                id="minParticipants"
                name="minParticipants"
                min="1"
                defaultValue={actionData?.values?.minParticipants || tour.minParticipants}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
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

        {/* Inclusions */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">What's Included</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesEquipment"
                  value="true"
                  defaultChecked={actionData?.values?.includesEquipment === "true" || tour.includesEquipment}
                  className="rounded"
                />
                <span className="text-sm">Equipment Rental</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesMeals"
                  value="true"
                  defaultChecked={actionData?.values?.includesMeals === "true" || tour.includesMeals}
                  className="rounded"
                />
                <span className="text-sm">Meals/Snacks</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesTransport"
                  value="true"
                  defaultChecked={actionData?.values?.includesTransport === "true" || tour.includesTransport}
                  className="rounded"
                />
                <span className="text-sm">Transport</span>
              </label>
            </div>

            <div>
              <label htmlFor="inclusionsStr" className="block text-sm font-medium mb-1">
                Additional Inclusions
              </label>
              <input
                type="text"
                id="inclusionsStr"
                name="inclusionsStr"
                placeholder="Bottled water, Towels, Photos (comma-separated)"
                defaultValue={actionData?.values?.inclusionsStr || tour.inclusions?.join(", ")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="exclusionsStr" className="block text-sm font-medium mb-1">
                Exclusions
              </label>
              <input
                type="text"
                id="exclusionsStr"
                name="exclusionsStr"
                placeholder="Certification fees, Marine park fees (comma-separated)"
                defaultValue={actionData?.values?.exclusionsStr || tour.exclusions?.join(", ")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Requirements</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="minCertLevel" className="block text-sm font-medium mb-1">
                Minimum Certification
              </label>
              <select
                id="minCertLevel"
                name="minCertLevel"
                defaultValue={actionData?.values?.minCertLevel || tour.minCertLevel}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None Required</option>
                <option value="Open Water">Open Water</option>
                <option value="Advanced Open Water">Advanced Open Water</option>
                <option value="Rescue Diver">Rescue Diver</option>
                <option value="Divemaster">Divemaster</option>
              </select>
            </div>

            <div>
              <label htmlFor="minAge" className="block text-sm font-medium mb-1">
                Minimum Age
              </label>
              <input
                type="number"
                id="minAge"
                name="minAge"
                min="1"
                placeholder="e.g., 10"
                defaultValue={actionData?.values?.minAge || tour.minAge || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="requirementsStr" className="block text-sm font-medium mb-1">
              Other Requirements
            </label>
            <input
              type="text"
              id="requirementsStr"
              name="requirementsStr"
              placeholder="Must swim, Medical clearance required (comma-separated)"
              defaultValue={actionData?.values?.requirementsStr || tour.requirements?.join(", ")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={actionData?.values?.isActive !== "false" && tour.isActive}
              className="rounded"
            />
            <span className="font-medium">Active</span>
            <span className="text-gray-500 text-sm">
              (Inactive tours cannot be scheduled)
            </span>
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
            to={`/app/tours/${tour.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
