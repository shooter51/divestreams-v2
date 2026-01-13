import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { equipmentSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { createEquipment } from "../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Add Equipment - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireTenant(request);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const formData = await request.formData();

  const validation = validateFormData(formData, equipmentSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  await createEquipment(tenant.schemaName, {
    category: formData.get("category") as string,
    name: formData.get("name") as string,
    brand: (formData.get("brand") as string) || undefined,
    model: (formData.get("model") as string) || undefined,
    serialNumber: (formData.get("serialNumber") as string) || undefined,
    size: (formData.get("size") as string) || undefined,
    status: (formData.get("status") as string) || undefined,
    condition: (formData.get("condition") as string) || undefined,
    rentalPrice: formData.get("rentalPrice") ? Number(formData.get("rentalPrice")) : undefined,
    isRentable: formData.get("isRentable") === "true",
  });

  return redirect("/app/equipment");
}

export default function NewEquipmentPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/app/equipment" className="text-blue-600 hover:underline text-sm">
          ← Back to Equipment
        </Link>
        <h1 className="text-2xl font-bold mt-2">Add Equipment</h1>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="category" className="block text-sm font-medium mb-1">
                  Category *
                </label>
                <select
                  id="category"
                  name="category"
                  required
                  defaultValue={actionData?.values?.category || ""}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category...</option>
                  <option value="bcd">BCD</option>
                  <option value="regulator">Regulator</option>
                  <option value="wetsuit">Wetsuit</option>
                  <option value="mask">Mask</option>
                  <option value="fins">Fins</option>
                  <option value="tank">Tank</option>
                  <option value="computer">Dive Computer</option>
                  <option value="other">Other</option>
                </select>
                {actionData?.errors?.category && (
                  <p className="text-red-500 text-sm mt-1">{actionData.errors.category}</p>
                )}
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  placeholder="e.g., Aqualung Pro HD"
                  defaultValue={actionData?.values?.name}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {actionData?.errors?.name && (
                  <p className="text-red-500 text-sm mt-1">{actionData.errors.name}</p>
                )}
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
                  placeholder="e.g., Aqualung"
                  defaultValue={actionData?.values?.brand}
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
                  placeholder="e.g., Pro HD"
                  defaultValue={actionData?.values?.model}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="serialNumber" className="block text-sm font-medium mb-1">
                  Serial Number
                </label>
                <input
                  type="text"
                  id="serialNumber"
                  name="serialNumber"
                  defaultValue={actionData?.values?.serialNumber}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="size" className="block text-sm font-medium mb-1">
                  Size
                </label>
                <select
                  id="size"
                  name="size"
                  defaultValue={actionData?.values?.size || ""}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">N/A</option>
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Status & Condition */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Status & Condition</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={actionData?.values?.status || "available"}
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
                Condition
              </label>
              <select
                id="condition"
                name="condition"
                defaultValue={actionData?.values?.condition || "good"}
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
          <h2 className="font-semibold mb-4">Rental Information</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isRentable"
                value="true"
                defaultChecked={actionData?.values?.isRentable !== "false"}
                className="rounded"
              />
              <span className="font-medium">Available for Rental</span>
            </label>

            <div className="w-1/2">
              <label htmlFor="rentalPrice" className="block text-sm font-medium mb-1">
                Rental Price (per day)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  id="rentalPrice"
                  name="rentalPrice"
                  step="0.01"
                  min="0"
                  defaultValue={actionData?.values?.rentalPrice}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
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
                defaultValue={actionData?.values?.lastServiceDate}
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
                defaultValue={actionData?.values?.nextServiceDate}
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
              defaultValue={actionData?.values?.serviceNotes}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Purchase Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Purchase Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="purchaseDate" className="block text-sm font-medium mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                id="purchaseDate"
                name="purchaseDate"
                defaultValue={actionData?.values?.purchaseDate}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="purchasePrice" className="block text-sm font-medium mb-1">
                Purchase Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  id="purchasePrice"
                  name="purchasePrice"
                  step="0.01"
                  min="0"
                  defaultValue={actionData?.values?.purchasePrice}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <label htmlFor="notes" className="block text-sm font-medium mb-1">
            Additional Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={actionData?.values?.notes}
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
            {isSubmitting ? "Saving..." : "Add Equipment"}
          </button>
          <Link
            to="/app/equipment"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
