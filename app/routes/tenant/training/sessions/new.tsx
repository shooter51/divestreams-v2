import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import { getCourseById, getCourses, createSession } from "../../../../../lib/db/training.server";
import { redirectWithNotification } from "../../../../../lib/use-notification";
import { useT } from "../../../../i18n/use-t";
import { CsrfInput } from "../../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Schedule Session - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");

  // Get all courses for dropdown
  const courses = await getCourses(ctx.org.id);

  // If a courseId is provided, get that course's details
  let selectedCourse = null;
  if (courseId) {
    selectedCourse = await getCourseById(ctx.org.id, courseId);
  }

  return { courses, selectedCourse, courseId };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const formData = await request.formData();

  const courseId = formData.get("courseId") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const startTime = formData.get("startTime") as string;
  const location = formData.get("location") as string;
  const meetingPoint = formData.get("meetingPoint") as string;
  const instructorName = formData.get("instructorName") as string;
  const maxStudents = formData.get("maxStudents") as string;
  const priceOverride = formData.get("priceOverride") as string;
  const notes = formData.get("notes") as string;
  const sessionType = formData.get("sessionType") as string;

  // Validation
  const errors: Record<string, string> = {};

  if (!courseId) {
    errors.courseId = "Please select a course";
  }

  if (!startDate) {
    errors.startDate = "Start date is required";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Create the session
  await createSession({
    organizationId: ctx.org.id,
    courseId,
    startDate,
    endDate: endDate || undefined,
    startTime: startTime || undefined,
    location: location || undefined,
    meetingPoint: meetingPoint || undefined,
    instructorName: instructorName || undefined,
    maxStudents: maxStudents ? parseInt(maxStudents) : undefined,
    priceOverride: priceOverride || undefined,
    notes: notes || undefined,
    sessionType: sessionType || undefined,
    status: "scheduled",
  });

  return redirect(redirectWithNotification("/tenant/training/sessions", "Session has been successfully created", "success"));
}

export default function NewSessionPage() {
  const { courses, selectedCourse, courseId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const t = useT();

  // Get tomorrow's date as default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/training/sessions" className="text-brand hover:underline text-sm">
          &larr; {t("tenant.training.sessions.backToSessions")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.training.sessions.scheduleSession")}</h1>
        {selectedCourse && (
          <p className="text-foreground-muted">
            {t("tenant.training.sessions.creatingSessionFor")}: <strong>{selectedCourse.name}</strong>
          </p>
        )}
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Course Selection */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.training.sessions.course")}</h2>

          <div>
            <label htmlFor="courseId" className="block text-sm font-medium mb-1">
              {t("tenant.training.sessions.selectCourse")} *
            </label>
            <select
              id="courseId"
              name="courseId"
              required
              defaultValue={courseId || ""}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            >
              <option value="">{t("tenant.training.sessions.chooseCourse")}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} {course.agencyName ? `(${course.agencyName})` : ""}
                </option>
              ))}
            </select>
            {actionData?.errors?.courseId && (
              <p className="text-danger text-sm mt-1">{actionData.errors.courseId}</p>
            )}
          </div>

          {selectedCourse && (
            <div className="mt-4 p-3 bg-surface-inset rounded-lg text-sm">
              <p><strong>{t("common.duration")}:</strong> {t("tenant.training.sessions.durationDays", { count: selectedCourse.durationDays || 1 })}</p>
              <p><strong>{t("common.price")}:</strong> ${Number(selectedCourse.price).toFixed(2)}</p>
              {selectedCourse.maxStudents && (
                <p><strong>{t("tenant.training.sessions.defaultMaxStudents")}:</strong> {selectedCourse.maxStudents}</p>
              )}
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.training.sessions.dateAndTime")}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium mb-1">
                {t("tenant.training.sessions.startDate")} *
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                required
                defaultValue={defaultDate}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              {actionData?.errors?.startDate && (
                <p className="text-danger text-sm mt-1">{actionData.errors.startDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium mb-1">
                {t("tenant.training.sessions.endDate")}
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              <p className="text-xs text-foreground-muted mt-1">{t("tenant.training.sessions.leaveBlankSingleDay")}</p>
            </div>

            <div>
              <label htmlFor="startTime" className="block text-sm font-medium mb-1">
                {t("tenant.training.sessions.startTime")}
              </label>
              <input
                type="time"
                id="startTime"
                name="startTime"
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.training.sessions.location")}</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="location" className="block text-sm font-medium mb-1">
                {t("tenant.training.sessions.locationVenue")}
              </label>
              <input
                type="text"
                id="location"
                name="location"
                placeholder={t("tenant.training.sessions.locationPlaceholder")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="meetingPoint" className="block text-sm font-medium mb-1">
                {t("tenant.training.sessions.meetingPoint")}
              </label>
              <input
                type="text"
                id="meetingPoint"
                name="meetingPoint"
                placeholder={t("tenant.training.sessions.meetingPointPlaceholder")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Instructor & Capacity */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.training.sessions.instructorAndCapacity")}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="instructorName" className="block text-sm font-medium mb-1">
                {t("tenant.training.sessions.instructorName")}
              </label>
              <input
                type="text"
                id="instructorName"
                name="instructorName"
                placeholder={t("tenant.training.sessions.instructorNamePlaceholder")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="maxStudents" className="block text-sm font-medium mb-1">
                {t("tenant.training.sessions.maxStudents")}
              </label>
              <input
                type="number"
                id="maxStudents"
                name="maxStudents"
                min="1"
                placeholder={selectedCourse?.maxStudents?.toString() || "8"}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              <p className="text-xs text-foreground-muted mt-1">{t("tenant.training.sessions.leaveBlankCourseDefault")}</p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.training.sessions.pricing")}</h2>

          <div>
            <label htmlFor="priceOverride" className="block text-sm font-medium mb-1">
              {t("tenant.training.sessions.priceOverride")}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-foreground-muted">$</span>
              <input
                type="number"
                id="priceOverride"
                name="priceOverride"
                min="0"
                step="0.01"
                placeholder={selectedCourse ? Number(selectedCourse.price).toFixed(2) : "0.00"}
                className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
            <p className="text-xs text-foreground-muted mt-1">
              {t("tenant.training.sessions.leaveBlankCoursePrice")}
              {selectedCourse && ` ($${Number(selectedCourse.price).toFixed(2)})`}
            </p>
          </div>
        </div>

        {/* Session Type */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.training.sessions.sessionType")}</h2>
          <div>
            <label htmlFor="sessionType" className="block text-sm font-medium mb-1">
              {t("tenant.training.sessions.sessionType")}
            </label>
            <select
              id="sessionType"
              name="sessionType"
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            >
              <option value="">{t("tenant.training.sessions.notSpecified")}</option>
              <option value="classroom">{t("tenant.training.sessions.typeClassroom")}</option>
              <option value="pool">{t("tenant.training.sessions.typePool")}</option>
              <option value="confined_water">{t("tenant.training.sessions.typeConfinedWater")}</option>
              <option value="open_water">{t("tenant.training.sessions.typeOpenWater")}</option>
              <option value="exam">{t("tenant.training.sessions.typeExam")}</option>
              <option value="other">{t("tenant.training.sessions.typeOther")}</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.training.sessions.additionalNotes")}</h2>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-1">
              {t("tenant.training.sessions.internalNotes")}
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder={t("tenant.training.sessions.notesPlaceholder")}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? t("common.creating") : t("tenant.training.sessions.createSession")}
          </button>
          <Link
            to="/tenant/training/sessions"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
