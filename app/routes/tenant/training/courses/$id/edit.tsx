import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgContext } from "../../../../../../lib/auth/org-context.server";
import {
  getCourseById,
  getAgencies,
  getLevels,
  updateCourse,
} from "../../../../../../lib/db/training.server";
import { getTenantDb } from "../../../../../../lib/db/tenant.server";
import { ImageManager, type Image } from "../../../../../components/ui";

export const meta: MetaFunction = () => [{ title: "Edit Course - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const courseId = params.id;

  if (!courseId) {
    throw new Response("Course ID required", { status: 400 });
  }

  const [course, agencies, levels] = await Promise.all([
    getCourseById(ctx.org.id, courseId),
    getAgencies(ctx.org.id),
    getLevels(ctx.org.id),
  ]);

  if (!course) {
    throw new Response("Course not found", { status: 404 });
  }

  // Get images from tenant schema
  const { db, schema } = getTenantDb(ctx.org.slug);
  const courseImages = await db
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
        eq(schema.images.entityType, "course"),
        eq(schema.images.entityId, courseId)
      )
    )
    .orderBy(asc(schema.images.sortOrder));

  const images: Image[] = courseImages.map((img) => ({
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

  return { course, agencies, levels, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const courseId = params.id;

  if (!courseId) {
    throw new Response("Course ID required", { status: 400 });
  }

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
  const medicalRequirements = formData.get("medicalRequirements") as string;
  const requiredCertLevel = formData.get("requiredCertLevel") as string;
  const isActive = formData.get("isActive") === "true";
  const isPublic = formData.get("isPublic") === "true";
  const materialsIncluded = formData.get("materialsIncluded") === "true";
  const equipmentIncluded = formData.get("equipmentIncluded") === "true";

  // Parse arrays
  const includedItemsStr = formData.get("includedItemsStr") as string;
  const requiredItemsStr = formData.get("requiredItemsStr") as string;

  const includedItems = includedItemsStr
    ? includedItemsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  const requiredItems = requiredItemsStr
    ? requiredItemsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  // Note: Images are handled separately by ImageManager component

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

  // Update course
  await updateCourse(ctx.org.id, courseId, {
    name: name.trim(),
    code: code?.trim() || null,
    description: description?.trim() || null,
    agencyId: agencyId || null,
    levelId: levelId || null,
    durationDays: durationDays ? parseInt(durationDays, 10) : 1,
    classroomHours: classroomHours ? parseInt(classroomHours, 10) : null,
    poolHours: poolHours ? parseInt(poolHours, 10) : null,
    openWaterDives: openWaterDives ? parseInt(openWaterDives, 10) : null,
    price: price,
    currency: currency || "USD",
    maxStudents: maxStudents ? parseInt(maxStudents, 10) : 4,
    minAge: minAge ? parseInt(minAge, 10) : null,
    prerequisites: prerequisites?.trim() || null,
    medicalRequirements: medicalRequirements?.trim() || null,
    requiredCertLevel: requiredCertLevel?.trim() || null,
    isActive,
    isPublic,
    materialsIncluded,
    equipmentIncluded,
    includedItems,
    requiredItems,
  });

  return redirect(`/tenant/training/courses/${courseId}`);
}

export default function EditCoursePage() {
  const { course, agencies, levels, images } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          to={`/tenant/training/courses/${course.id}`}
          className="text-brand hover:underline text-sm"
        >
          &larr; Back to Course
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Course</h1>
        <p className="text-foreground-muted">Update course details.</p>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                defaultValue={actionData?.values?.name || course.name}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                required
              />
              {actionData?.errors?.name && (
                <p className="text-danger text-sm mt-1">{actionData.errors.name}</p>
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
                defaultValue={actionData?.values?.code || course.code || ""}
                placeholder="e.g., OWD, AOWD, EFR"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                defaultValue={actionData?.values?.description || course.description || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                  defaultValue={actionData?.values?.agencyId || course.agencyId || ""}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                  defaultValue={actionData?.values?.levelId || course.levelId || ""}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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

        {/* Course Images */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Course Images</h2>
          <ImageManager
            entityType="course"
            entityId={course.id}
            images={images}
            maxImages={5}
          />
        </div>

        {/* Duration & Structure */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                defaultValue={actionData?.values?.durationDays || course.durationDays || 1}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                defaultValue={actionData?.values?.classroomHours || course.classroomHours || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                defaultValue={actionData?.values?.poolHours || course.poolHours || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                defaultValue={actionData?.values?.openWaterDives || course.openWaterDives || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Pricing & Capacity */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Pricing & Capacity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-1">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                <input
                  type="number"
                  id="price"
                  name="price"
                  step="0.01"
                  min="0"
                  defaultValue={actionData?.values?.price || course.price}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
              {actionData?.errors?.price && (
                <p className="text-danger text-sm mt-1">{actionData.errors.price}</p>
              )}
            </div>

            <div>
              <label htmlFor="currency" className="block text-sm font-medium mb-1">
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                defaultValue={actionData?.values?.currency || course.currency || "USD"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                defaultValue={actionData?.values?.maxStudents || course.maxStudents || 4}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                defaultValue={actionData?.values?.minAge || course.minAge || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* What's Included */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">What's Included</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="materialsIncluded"
                  value="true"
                  defaultChecked={
                    actionData?.values?.materialsIncluded === "true" ||
                    (course.materialsIncluded ?? false)
                  }
                  className="rounded"
                />
                <span className="text-sm">Course Materials</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="equipmentIncluded"
                  value="true"
                  defaultChecked={
                    actionData?.values?.equipmentIncluded === "true" ||
                    (course.equipmentIncluded ?? false)
                  }
                  className="rounded"
                />
                <span className="text-sm">Equipment</span>
              </label>
            </div>

            <div>
              <label htmlFor="includedItemsStr" className="block text-sm font-medium mb-1">
                Additional Included Items
              </label>
              <input
                type="text"
                id="includedItemsStr"
                name="includedItemsStr"
                placeholder="Logbook, Certification card, Photos (comma-separated)"
                defaultValue={
                  actionData?.values?.includedItemsStr ||
                  course.includedItems?.join(", ") ||
                  ""
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="requiredItemsStr" className="block text-sm font-medium mb-1">
                Students Must Bring
              </label>
              <input
                type="text"
                id="requiredItemsStr"
                name="requiredItemsStr"
                placeholder="Swimsuit, Towel, Sunscreen (comma-separated)"
                defaultValue={
                  actionData?.values?.requiredItemsStr ||
                  course.requiredItems?.join(", ") ||
                  ""
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Prerequisites & Requirements */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Prerequisites & Requirements</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="requiredCertLevel" className="block text-sm font-medium mb-1">
                Required Certification Level
              </label>
              <input
                type="text"
                id="requiredCertLevel"
                name="requiredCertLevel"
                placeholder="e.g., Open Water Diver"
                defaultValue={
                  actionData?.values?.requiredCertLevel || course.requiredCertLevel || ""
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="prerequisites" className="block text-sm font-medium mb-1">
                Prerequisites
              </label>
              <textarea
                id="prerequisites"
                name="prerequisites"
                rows={2}
                defaultValue={
                  actionData?.values?.prerequisites || course.prerequisites || ""
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="medicalRequirements" className="block text-sm font-medium mb-1">
                Medical Requirements
              </label>
              <textarea
                id="medicalRequirements"
                name="medicalRequirements"
                rows={2}
                placeholder="e.g., Medical questionnaire required, physician clearance if over 45"
                defaultValue={
                  actionData?.values?.medicalRequirements || course.medicalRequirements || ""
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Status</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked={
                  actionData?.values?.isActive !== "false" && course.isActive
                }
                className="rounded"
              />
              <span className="font-medium">Active</span>
              <span className="text-foreground-muted text-sm">
                (Inactive courses cannot be scheduled)
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isPublic"
                value="true"
                defaultChecked={
                  actionData?.values?.isPublic === "true" || course.isPublic
                }
                className="rounded"
              />
              <span className="font-medium">Public</span>
              <span className="text-foreground-muted text-sm">
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
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            to={`/tenant/training/courses/${course.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
