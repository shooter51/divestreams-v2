import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { tourSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { createTour, getTourById } from "../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Duplicate Tour - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const tourId = params.id;

  if (!tourId) {
    throw new Response("Tour ID is required", { status: 400 });
  }

  const tour = await getTourById(organizationId, tourId);
  if (!tour) {
    throw new Response("Tour not found", { status: 404 });
  }

  return { tour };
}

export async function action({ request }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const formData = await request.formData();

  // Parse inclusions/exclusions from comma-separated strings
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

  // Convert numeric fields
  const price = formData.get("price");
  if (price) formData.set("price", price.toString());
  const maxParticipants = formData.get("maxParticipants");
  if (maxParticipants) formData.set("maxParticipants", maxParticipants.toString());
  const minParticipants = formData.get("minParticipants");
  if (minParticipants) formData.set("minParticipants", minParticipants.toString());
  const duration = formData.get("duration");
  if (duration) formData.set("duration", duration.toString());
  const minAge = formData.get("minAge");
  if (minAge) formData.set("minAge", minAge.toString());

  const validation = validateFormData(formData, tourSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  await createTour(organizationId, {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    type: formData.get("type") as string,
    duration: formData.get("duration") ? Number(formData.get("duration")) : undefined,
    maxParticipants: Number(formData.get("maxParticipants")),
    minParticipants: formData.get("minParticipants") ? Number(formData.get("minParticipants")) : undefined,
    price: Number(formData.get("price")),
    currency: (formData.get("currency") as string) || undefined,
    includesEquipment: formData.get("includesEquipment") === "true",
    includesMeals: formData.get("includesMeals") === "true",
    includesTransport: formData.get("includesTransport") === "true",
    minCertLevel: (formData.get("minCertLevel") as string) || undefined,
    minAge: formData.get("minAge") ? Number(formData.get("minAge")) : undefined,
  });

  return redirect("/app/tours");
}

export default function DuplicateTourPage() {
  const { tour } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Pre-fill values from existing tour, or from action data if there was an error
  const values = actionData?.values || {
    name: `Copy of ${tour.name}`,
    description: tour.description || "",
    type: tour.type,
    duration: tour.duration?.toString() || "120",
    price: tour.price?.toString() || "",
    currency: tour.currency || "USD",
    maxParticipants: tour.maxParticipants?.toString() || "8",
    minParticipants: tour.minParticipants?.toString() || "1",
    includesEquipment: tour.includesEquipment ? "true" : "false",
    includesMeals: tour.includesMeals ? "true" : "false",
    includesTransport: tour.includesTransport ? "true" : "false",
    minCertLevel: tour.minCertLevel || "",
    minAge: tour.minAge?.toString() || "",
    inclusionsStr: Array.isArray(tour.inclusions) ? tour.inclusions.join(", ") : "",
    exclusionsStr: Array.isArray(tour.exclusions) ? tour.exclusions.join(", ") : "",
    requirementsStr: Array.isArray(tour.requirements) ? tour.requirements.join(", ") : "",
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/app/tours/${tour.id}`} className="text-blue-600 hover:underline text-sm">
          &larr; Back to {tour.name}
        </Link>
        <h1 className="text-2xl font-bold mt-2">Duplicate Tour</h1>
        <p className="text-gray-500">
          Create a new tour based on "{tour.name}".
        </p>
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
                defaultValue={values.name}
                placeholder="e.g., Morning 2-Tank Dive"
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
                defaultValue={values.description}
                placeholder="Describe the tour experience..."
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
                  defaultValue={values.type}
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
                  defaultValue={values.duration}
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
                  defaultValue={values.price}
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
                defaultValue={values.currency}
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
                defaultValue={values.maxParticipants}
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
                defaultValue={values.minParticipants}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Inclusions */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">What's Included</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesEquipment"
                  value="true"
                  defaultChecked={values.includesEquipment === "true"}
                  className="rounded"
                />
                <span className="text-sm">Equipment Rental</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesMeals"
                  value="true"
                  defaultChecked={values.includesMeals === "true"}
                  className="rounded"
                />
                <span className="text-sm">Meals/Snacks</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesTransport"
                  value="true"
                  defaultChecked={values.includesTransport === "true"}
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
                defaultValue={values.inclusionsStr}
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
                defaultValue={values.exclusionsStr}
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
                defaultValue={values.minCertLevel}
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
                defaultValue={values.minAge}
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
              defaultValue={values.requirementsStr}
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
              defaultChecked
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
            {isSubmitting ? "Creating..." : "Create Duplicate Tour"}
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
