import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { eq } from "drizzle-orm";
import { requireTenant } from "../../../../../lib/auth/tenant-auth.server";
import { getEquipmentById } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { equipmentSchema, validateFormData, getFormValues } from "../../../../../lib/validation";

export const meta: MetaFunction = () => [{ title: "Edit Equipment - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const equipmentId = params.id;

  if (!equipmentId) {
    throw new Response("Equipment ID required", { status: 400 });
  }

  const equipmentData = await getEquipmentById(tenant.schemaName, equipmentId);

  if (!equipmentData) {
    throw new Response("Equipment not found", { status: 404 });
  }

  const equipment = {
    id: equipmentData.id,
    name: equipmentData.name,
    category: equipmentData.category,
    brand: equipmentData.brand || "",
    model: equipmentData.model || "",
    serialNumber: equipmentData.serialNumber || "",
    size: equipmentData.size || "",
    condition: equipmentData.condition,
    status: equipmentData.status,
    isRentable: equipmentData.isRentable,
    rentalPrice: equipmentData.rentalPrice?.toString() || "",
    purchaseDate: equipmentData.purchaseDate || "",
    purchasePrice: equipmentData.purchasePrice?.toString() || "",
    lastServiceDate: equipmentData.lastServiceDate || "",
    nextServiceDate: equipmentData.nextServiceDate || "",
    serviceNotes: equipmentData.serviceNotes || "",
    notes: equipmentData.notes || "",
  };

  return { equipment };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const equipmentId = params.id;

  if (!equipmentId) {
    throw new Response("Equipment ID required", { status: 400 });
  }

  const formData = await request.formData();
  const validation = validateFormData(formData, equipmentSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Update equipment in database
  const { db, schema } = getTenantDb(tenant.schemaName);

  await db
    .update(schema.equipment)
    .set({
      name: validation.data.name,
      category: validation.data.category,
      brand: validation.data.brand,
      model: validation.data.model,
      serialNumber: validation.data.serialNumber,
      size: validation.data.size,
      condition: validation.data.condition,
      status: validation.data.status,
      isRentable: validation.data.isRentable,
      rentalPrice: validation.data.rentalPrice?.toString(),
      purchaseDate: validation.data.purchaseDate,
      purchasePrice: validation.data.purchasePrice?.toString(),
      lastServiceDate: validation.data.lastServiceDate,
      nextServiceDate: validation.data.nextServiceDate,
      serviceNotes: validation.data.serviceNotes,
      notes: validation.data.notes,
      updatedAt: new Date(),
    })
    .where(eq(schema.equipment.id, equipmentId));

  return redirect(`/app/equipment/${equipmentId}`);
}

export default function EditEquipmentPage() {
  const { equipment } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/app/equipment/${equipment.id}`} className="text-blue-600 hover:underline text-sm">
          ← Back to Equipment
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Equipment</h1>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Equipment Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={actionData?.values?.name || equipment.name}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="category" className="block text-sm font-medium mb-1">
                  Category *
                </label>
                <select
                  id="category"
                  name="category"
                  required
                  defaultValue={actionData?.values?.category || equipment.category}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bcd">BCD</option>
                  <option value="regulator">Regulator</option>
                  <option value="wetsuit">Wetsuit</option>
                  <option value="mask">Mask</option>
                  <option value="fins">Fins</option>
                  <option value="tank">Tank</option>
                  <option value="computer">Dive Computer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="size" className="block text-sm font-medium mb-1">
                  Size
                </label>
                <input
                  type="text"
                  id="size"
                  name="size"
                  placeholder="e.g., M, L, XL"
                  defaultValue={actionData?.values?.size || equipment.size}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="brand" className="block text-sm font-medium mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  id="brand"
                  name="brand"
                  defaultValue={actionData?.values?.brand || equipment.brand}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="model" className="block text-sm font-medium mb-1">
                  Model
                </label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  defaultValue={actionData?.values?.model || equipment.model}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="serialNumber" className="block text-sm font-medium mb-1">
                Serial Number
              </label>
              <input
                type="text"
                id="serialNumber"
                name="serialNumber"
                defaultValue={actionData?.values?.serialNumber || equipment.serialNumber}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Status & Condition */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Status & Condition</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-1">
                Status *
              </label>
              <select
                id="status"
                name="status"
                required
                defaultValue={actionData?.values?.status || equipment.status}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="available">Available</option>
                <option value="rented">Rented</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>

            <div>
              <label htmlFor="condition" className="block text-sm font-medium mb-1">
                Condition *
              </label>
              <select
                id="condition"
                name="condition"
                required
                defaultValue={actionData?.values?.condition || equipment.condition}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rental */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Rental Settings</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isRentable"
                value="true"
                defaultChecked={actionData?.values?.isRentable !== "false" && equipment.isRentable}
                className="rounded"
              />
              <span className="font-medium">Available for Rent</span>
            </label>

            <div>
              <label htmlFor="rentalPrice" className="block text-sm font-medium mb-1">
                Daily Rental Price ($)
              </label>
              <input
                type="number"
                id="rentalPrice"
                name="rentalPrice"
                step="0.01"
                min="0"
                defaultValue={actionData?.values?.rentalPrice || equipment.rentalPrice}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Service */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Service Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lastServiceDate" className="block text-sm font-medium mb-1">
                Last Service Date
              </label>
              <input
                type="date"
                id="lastServiceDate"
                name="lastServiceDate"
                defaultValue={actionData?.values?.lastServiceDate || equipment.lastServiceDate}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="nextServiceDate" className="block text-sm font-medium mb-1">
                Next Service Due
              </label>
              <input
                type="date"
                id="nextServiceDate"
                name="nextServiceDate"
                defaultValue={actionData?.values?.nextServiceDate || equipment.nextServiceDate}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="serviceNotes" className="block text-sm font-medium mb-1">
              Service Notes
            </label>
            <textarea
              id="serviceNotes"
              name="serviceNotes"
              rows={2}
              defaultValue={actionData?.values?.serviceNotes || equipment.serviceNotes}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Notes</h2>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={actionData?.values?.notes || equipment.notes}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
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
            to={`/app/equipment/${equipment.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
