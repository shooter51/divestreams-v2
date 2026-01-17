/**
 * New Course Route
 *
 * Form to create a new training course. Requires premium subscription.
 * Part of the Training Module.
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getCertificationAgencies,
  getCertificationLevels,
  createTrainingCourse,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [
  { title: "New Course - Training - DiveStreams" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Check freemium access - training is a premium feature
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      agencies: [],
      levels: [],
    };
  }

  // Load agencies and levels for dropdowns
  const [agencies, levelsData] = await Promise.all([
    getCertificationAgencies(ctx.org.id),
    getCertificationLevels(ctx.org.id),
  ]);

  // Transform levels to include agency info
  const levels = levelsData.map((item) => ({
    id: item.level.id,
    name: item.level.name,
    code: item.level.code,
    agencyId: item.level.agencyId,
    agencyName: item.agency?.name || "Unknown Agency",
  }));

  return {
    hasAccess: true,
    agencies,
    levels,
  };
}

interface ActionErrors {
  name?: string;
  agencyId?: string;
  levelId?: string;
  price?: string;
  general?: string;
}

interface FormValues {
  name?: string;
  description?: string;
  agencyId?: string;
  levelId?: string;
  scheduleType?: string;
  price?: string;
  depositAmount?: string;
  maxStudents?: string;
  totalSessions?: string;
  hasExam?: string;
  examPassScore?: string;
  minOpenWaterDives?: string;
}

interface ActionResponse {
  errors: ActionErrors;
  values: FormValues;
}

export async function action({ request }: ActionFunctionArgs): Promise<ActionResponse | Response> {
  const ctx = await requireOrgContext(request);

  // Check freemium access
  if (!ctx.isPremium) {
    return {
      errors: { general: "Training is a premium feature. Please upgrade to create courses." },
      values: {},
    };
  }

  const formData = await request.formData();

  // Extract form values
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const agencyId = formData.get("agencyId") as string;
  const levelId = formData.get("levelId") as string;
  const scheduleType = formData.get("scheduleType") as string || "fixed";
  const price = formData.get("price") as string;
  const depositAmount = formData.get("depositAmount") as string;
  const maxStudents = formData.get("maxStudents") as string;
  const totalSessions = formData.get("totalSessions") as string;
  const hasExam = formData.get("hasExam") === "true";
  const examPassScore = formData.get("examPassScore") as string;
  const minOpenWaterDives = formData.get("minOpenWaterDives") as string;

  // Validation
  const errors: ActionErrors = {};
  const values = {
    name,
    description,
    agencyId,
    levelId,
    scheduleType,
    price,
    depositAmount,
    maxStudents,
    totalSessions,
    hasExam: hasExam ? "true" : "false",
    examPassScore,
    minOpenWaterDives,
  };

  if (!name || name.trim().length === 0) {
    errors.name = "Course name is required";
  }

  if (!agencyId) {
    errors.agencyId = "Certification agency is required";
  }

  if (!levelId) {
    errors.levelId = "Certification level is required";
  }

  if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
    errors.price = "Valid price is required";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values };
  }

  try {
    // Create the course
    const course = await createTrainingCourse(ctx.org.id, {
      name: name.trim(),
      description: description?.trim() || undefined,
      agencyId,
      levelId,
      scheduleType,
      price,
      depositAmount: depositAmount || undefined,
      maxStudents: maxStudents ? parseInt(maxStudents) : undefined,
      totalSessions: totalSessions ? parseInt(totalSessions) : undefined,
      hasExam,
      examPassScore: examPassScore ? parseInt(examPassScore) : undefined,
      minOpenWaterDives: minOpenWaterDives ? parseInt(minOpenWaterDives) : undefined,
    });

    // Redirect to course detail page on success
    return redirect(`/app/training/courses/${course.id}`);
  } catch (error) {
    console.error("Failed to create course:", error);
    return {
      errors: { general: "Failed to create course. Please try again." },
      values,
    };
  }
}

export default function NewCoursePage() {
  const { hasAccess, agencies, levels } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Premium gate
  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h1 className="text-2xl font-bold mb-4">Create Training Course</h1>
        <p className="text-gray-600 mb-6">
          Create and manage certification courses for your dive shop.
          Available on Premium plans.
        </p>
        <Link
          to="/app/settings/billing"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Upgrade to Premium
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/app/training/courses" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Courses
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create Course</h1>
        <p className="text-gray-500">
          Create a new training course for student enrollment.
        </p>
      </div>

      {actionData?.errors?.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {actionData.errors.general}
        </div>
      )}

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
                placeholder="e.g., PADI Open Water Diver"
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
                defaultValue={actionData?.values?.description}
                placeholder="Describe the course content and what students will learn..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Certification Details */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Certification Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="agencyId" className="block text-sm font-medium mb-1">
                Certification Agency *
              </label>
              <select
                id="agencyId"
                name="agencyId"
                defaultValue={actionData?.values?.agencyId || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Agency</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name} ({agency.code})
                  </option>
                ))}
              </select>
              {actionData?.errors?.agencyId && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.agencyId}</p>
              )}
              {agencies.length === 0 && (
                <p className="text-amber-600 text-sm mt-1">
                  No agencies configured.{" "}
                  <Link to="/app/training/settings/agencies" className="underline">
                    Add an agency first
                  </Link>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="levelId" className="block text-sm font-medium mb-1">
                Certification Level *
              </label>
              <select
                id="levelId"
                name="levelId"
                defaultValue={actionData?.values?.levelId || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Level</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name} ({level.agencyName})
                  </option>
                ))}
              </select>
              {actionData?.errors?.levelId && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.levelId}</p>
              )}
              {levels.length === 0 && (
                <p className="text-amber-600 text-sm mt-1">
                  No levels configured.{" "}
                  <Link to="/app/training/settings/levels" className="underline">
                    Add certification levels first
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Scheduling */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Scheduling</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="scheduleType" className="block text-sm font-medium mb-1">
                Schedule Type
              </label>
              <select
                id="scheduleType"
                name="scheduleType"
                defaultValue={actionData?.values?.scheduleType || "fixed"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="fixed">Fixed Schedule</option>
                <option value="on_demand">On Demand</option>
              </select>
              <p className="text-gray-500 text-xs mt-1">
                Fixed: Pre-scheduled class dates. On Demand: Student-initiated scheduling.
              </p>
            </div>

            <div>
              <label htmlFor="totalSessions" className="block text-sm font-medium mb-1">
                Total Sessions
              </label>
              <input
                type="number"
                id="totalSessions"
                name="totalSessions"
                min="1"
                defaultValue={actionData?.values?.totalSessions || "4"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="maxStudents" className="block text-sm font-medium mb-1">
                Max Students
              </label>
              <input
                type="number"
                id="maxStudents"
                name="maxStudents"
                min="1"
                defaultValue={actionData?.values?.maxStudents || "6"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Pricing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-1">
                Course Price *
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
                  placeholder="e.g., 599.00"
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              {actionData?.errors?.price && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.price}</p>
              )}
            </div>

            <div>
              <label htmlFor="depositAmount" className="block text-sm font-medium mb-1">
                Deposit Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  id="depositAmount"
                  name="depositAmount"
                  step="0.01"
                  min="0"
                  defaultValue={actionData?.values?.depositAmount}
                  placeholder="Optional"
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Leave empty for full payment on enrollment.
              </p>
            </div>
          </div>
        </div>

        {/* Assessment */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Assessment Requirements</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasExam"
                name="hasExam"
                value="true"
                defaultChecked={actionData?.values?.hasExam === "true" || actionData?.values?.hasExam === undefined}
                className="rounded"
              />
              <span className="font-medium">Requires Written Exam</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="examPassScore" className="block text-sm font-medium mb-1">
                  Exam Pass Score (%)
                </label>
                <input
                  type="number"
                  id="examPassScore"
                  name="examPassScore"
                  min="0"
                  max="100"
                  defaultValue={actionData?.values?.examPassScore || "75"}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="minOpenWaterDives" className="block text-sm font-medium mb-1">
                  Min Open Water Dives
                </label>
                <input
                  type="number"
                  id="minOpenWaterDives"
                  name="minOpenWaterDives"
                  min="0"
                  defaultValue={actionData?.values?.minOpenWaterDives || "4"}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
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
