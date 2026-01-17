import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getAgencies,
  getLevels,
  createCourse,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [{ title: "Create Course - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  const [agencies, levels] = await Promise.all([
    getAgencies(ctx.org.id),
    getLevels(ctx.org.id),
  ]);

  return { agencies, levels };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

  // Extract form values
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const description = formData.get("description") as string;
  const agencyId = formData.get("agencyId") as string;
  const levelId = formData.get("levelId") as string;
  const durationDays = formData.get("durationDays") as string;
  const classroomHours = formData.get("classroomHours") as string;
  const poolHours = formData.get("poolHours") as string;
  const openWaterDives = formData.get("openWaterDives") as string;
  const price = formData.get("price") as string;
  const currency = formData.get("currency") as string;
  const maxStudents = formData.get("maxStudents") as string;
  const minAge = formData.get("minAge") as string;
  const prerequisites = formData.get("prerequisites") as string;
  const isActive = formData.get("isActive") === "true";
  const isPublic = formData.get("isPublic") === "true";

  // Basic validation
  const errors: Record<string, string> = {};

  if (!name || name.trim().length === 0) {
    errors.name = "Course name is required";
  }

  if (!price || isNaN(parseFloat(price))) {
    errors.price = "Valid price is required";
  }

  if (Object.keys(errors).length > 0) {
    // Convert FormData to plain object with string values
    const values: Record<string, string> = {};
    formData.forEach((value, key) => {
      if (typeof value === "string") {
        values[key] = value;
      }
    });
    return { errors, values };
  }

  // Create course
  await createCourse({
    organizationId: ctx.org.id,
    name: name.trim(),
    code: code?.trim() || undefined,
    description: description?.trim() || undefined,
    agencyId: agencyId || undefined,
    levelId: levelId || undefined,
    durationDays: durationDays ? parseInt(durationDays, 10) : undefined,
    classroomHours: classroomHours ? parseInt(classroomHours, 10) : undefined,
    poolHours: poolHours ? parseInt(poolHours, 10) : undefined,
    openWaterDives: openWaterDives ? parseInt(openWaterDives, 10) : undefined,
    price: price,
    currency: currency || "USD",
    maxStudents: maxStudents ? parseInt(maxStudents, 10) : undefined,
    minAge: minAge ? parseInt(minAge, 10) : undefined,
    prerequisites: prerequisites?.trim() || undefined,
    isActive,
    isPublic,
  });

  return redirect("/app/training/courses");
}

export default function NewCoursePage() {
  const { agencies, levels } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/app/training/courses" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Courses
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create Course</h1>
        <p className="text-gray-500">
          Create a new training course that can be scheduled as sessions.
        </p>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Course Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                defaultValue={actionData?.values?.name}
                placeholder="e.g., Open Water Diver"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {actionData?.errors?.name && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="code" className="block text-sm font-medium mb-1">
                Course Code
              </label>
              <input
                type="text"
                id="code"
                name="code"
                defaultValue={actionData?.values?.code}
                placeholder="e.g., OWD, AOWD, EFR"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={actionData?.values?.description}
                placeholder="Describe the course, what students will learn..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="agencyId" className="block text-sm font-medium mb-1">
                  Certification Agency
                </label>
                <select
                  id="agencyId"
                  name="agencyId"
                  defaultValue={actionData?.values?.agencyId || ""}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Agency</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="levelId" className="block text-sm font-medium mb-1">
                  Certification Level
                </label>
                <select
                  id="levelId"
                  name="levelId"
                  defaultValue={actionData?.values?.levelId || ""}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Level</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name} {level.agencyName ? `(${level.agencyName})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Duration & Structure */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Duration & Structure</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="durationDays" className="block text-sm font-medium mb-1">
                Duration (days)
              </label>
              <input
                type="number"
                id="durationDays"
                name="durationDays"
                min="1"
                defaultValue={actionData?.values?.durationDays || "3"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="classroomHours" className="block text-sm font-medium mb-1">
                Classroom Hours
              </label>
              <input
                type="number"
                id="classroomHours"
                name="classroomHours"
                min="0"
                defaultValue={actionData?.values?.classroomHours}
                placeholder="e.g., 8"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="poolHours" className="block text-sm font-medium mb-1">
                Pool/Confined Water Hours
              </label>
              <input
                type="number"
                id="poolHours"
                name="poolHours"
                min="0"
                defaultValue={actionData?.values?.poolHours}
                placeholder="e.g., 4"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="openWaterDives" className="block text-sm font-medium mb-1">
                Open Water Dives
              </label>
              <input
                type="number"
                id="openWaterDives"
                name="openWaterDives"
                min="0"
                defaultValue={actionData?.values?.openWaterDives}
                placeholder="e.g., 4"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
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
                  defaultValue={actionData?.values?.price}
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
                defaultValue={actionData?.values?.currency || "USD"}
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
              <label htmlFor="maxStudents" className="block text-sm font-medium mb-1">
                Max Students per Session
              </label>
              <input
                type="number"
                id="maxStudents"
                name="maxStudents"
                min="1"
                defaultValue={actionData?.values?.maxStudents || "4"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
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
                defaultValue={actionData?.values?.minAge}
                placeholder="e.g., 10"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Prerequisites */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Prerequisites</h2>
          <div>
            <label htmlFor="prerequisites" className="block text-sm font-medium mb-1">
              Prerequisites
            </label>
            <textarea
              id="prerequisites"
              name="prerequisites"
              rows={2}
              defaultValue={actionData?.values?.prerequisites}
              placeholder="e.g., Open Water Diver certification, minimum 10 logged dives"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Status</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked={actionData?.values?.isActive !== "false"}
                className="rounded"
              />
              <span className="font-medium">Active</span>
              <span className="text-gray-500 text-sm">
                (Inactive courses cannot be scheduled)
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isPublic"
                value="true"
                defaultChecked={actionData?.values?.isPublic === "true"}
                className="rounded"
              />
              <span className="font-medium">Public</span>
              <span className="text-gray-500 text-sm">
                (Visible on public booking pages)
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Creating..." : "Create Course"}
          </button>
          <Link
            to="/app/training/courses"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
