import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, Link, useFetcher } from "react-router";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import {
  getCourseById,
  getSessions,
  deleteCourse,
  updateCourse,
} from "../../../../../lib/db/training.server";
import { redirectWithNotification, useNotification } from "../../../../../lib/use-notification";
import { formatLabel, formatTime } from "../../../../lib/format";
import { useT } from "../../../../i18n/use-t";
import { CsrfInput } from "../../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Course Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const courseId = params.id;

  if (!courseId) {
    throw new Response("Course ID required", { status: 400 });
  }

  const course = await getCourseById(ctx.org.id, courseId);

  if (!course) {
    throw new Response("Course not found", { status: 404 });
  }

  // Get sessions for this course
  const sessions = await getSessions(ctx.org.id, { courseId });

  return { course, sessions };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const courseId = params.id!;

  if (intent === "toggle-active") {
    const course = await getCourseById(ctx.org.id, courseId);
    if (course) {
      await updateCourse(ctx.org.id, courseId, { isActive: !course.isActive });
    }
    return { toggled: true };
  }

  if (intent === "toggle-public") {
    const course = await getCourseById(ctx.org.id, courseId);
    if (course) {
      await updateCourse(ctx.org.id, courseId, { isPublic: !course.isPublic });
    }
    return { toggled: true };
  }

  if (intent === "delete") {
    const course = await getCourseById(ctx.org.id, courseId);
    const courseName = course?.name || "Course";
    await deleteCourse(ctx.org.id, courseId);
    return redirect(redirectWithNotification("/tenant/training/courses", `${courseName} has been successfully deleted`, "success"));
  }

  return null;
}

export default function CourseDetailPage() {
  const { course, sessions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const t = useT();

  // Show notifications from URL params
  useNotification();

  const handleDelete = () => {
    if (
      confirm(
        "Are you sure you want to delete this course? This cannot be undone."
      )
    ) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  // Calculate session stats
  const upcomingSessions = sessions.filter(
    (s) => s.status === "scheduled" && new Date(s.startDate) >= new Date()
  );
  const totalEnrolled = sessions.reduce((sum, s) => sum + (s.enrolledCount || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/training/courses" className="text-brand hover:underline text-sm">
          &larr; {t("tenant.training.courses.backToCourses")}
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{course.name}</h1>
            {course.code && (
              <span className="text-sm bg-surface-inset text-foreground-muted px-2 py-1 rounded">
                {course.code}
              </span>
            )}
            {!course.isActive && (
              <span className="text-sm bg-surface-inset text-foreground-muted px-2 py-1 rounded">
                {t("common.inactive")}
              </span>
            )}
            {course.isPublic ? (
              <span className="text-sm bg-brand-muted text-brand px-2 py-1 rounded">
                {t("tenant.training.courses.public")}
              </span>
            ) : (
              <span className="text-sm bg-surface-inset text-foreground-muted px-2 py-1 rounded">
                {t("tenant.training.courses.private")}
              </span>
            )}
          </div>
          <p className="text-foreground-muted">
            {course.agencyName || "No Agency"} - {course.levelName || "No Level"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/tenant/training/sessions/new?courseId=${course.id}`}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
          >
            {t("tenant.training.sessions.scheduleSession")}
          </Link>
          <Link
            to={`/tenant/training/courses/${course.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.edit")}
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                ${Number(course.price).toFixed(2)}
              </p>
              <p className="text-foreground-muted text-sm">{t("common.price")} ({course.currency})</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{course.durationDays || "—"}</p>
              <p className="text-foreground-muted text-sm">{course.durationDays === 1 ? t("tenant.training.day") : t("tenant.training.days")}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{upcomingSessions.length}</p>
              <p className="text-foreground-muted text-sm">{t("tenant.training.dashboard.upcomingSessions")}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{totalEnrolled}</p>
              <p className="text-foreground-muted text-sm">{t("tenant.training.courses.totalEnrolled")}</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-3">{t("common.description")}</h2>
            <p className="text-foreground">
              {course.description || t("tenant.training.courses.noDescription")}
            </p>
          </div>

          {/* Course Structure */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.training.courses.courseStructure")}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-foreground-muted">{t("tenant.training.courses.classroomHours")}</p>
                <p>{course.classroomHours ?? t("tenant.training.notSpecified")}</p>
              </div>
              <div>
                <p className="text-foreground-muted">{t("tenant.training.courses.poolHours")}</p>
                <p>{course.poolHours ?? t("tenant.training.notSpecified")}</p>
              </div>
              <div>
                <p className="text-foreground-muted">{t("tenant.training.courses.openWaterDives")}</p>
                <p>{course.openWaterDives ?? t("tenant.training.notSpecified")}</p>
              </div>
              <div>
                <p className="text-foreground-muted">{t("tenant.training.courses.maxStudents")}</p>
                <p>{course.maxStudents || t("tenant.training.notSpecified")}</p>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.training.courses.requirements")}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-foreground-muted">{t("tenant.training.courses.minimumAge")}</p>
                <p>{course.minAge ? `${course.minAge} ${t("tenant.training.courses.years")}` : t("tenant.training.courses.noMinimum")}</p>
              </div>
              <div>
                <p className="text-foreground-muted">{t("tenant.training.courses.requiredCertification")}</p>
                <p>{course.requiredCertLevel || t("tenant.training.courses.noneRequired")}</p>
              </div>
            </div>
            {course.prerequisites && (
              <div className="mt-4">
                <p className="text-foreground-muted text-sm">{t("tenant.training.courses.prerequisites")}</p>
                <p className="text-sm">{course.prerequisites}</p>
              </div>
            )}
            {course.medicalRequirements && (
              <div className="mt-4">
                <p className="text-foreground-muted text-sm">{t("tenant.training.courses.medicalRequirements")}</p>
                <p className="text-sm">{course.medicalRequirements}</p>
              </div>
            )}
          </div>

          {/* Sessions List */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">{t("tenant.training.sessions.title")}</h2>
              <Link
                to={`/tenant/training/sessions?courseId=${course.id}`}
                className="text-brand text-sm hover:underline"
              >
                {t("tenant.training.viewAll")}
              </Link>
            </div>
            {sessions.length === 0 ? (
              <p className="text-foreground-muted text-sm">{t("tenant.training.sessions.noSessionsYet")}</p>
            ) : (
              <div className="space-y-3">
                {sessions.slice(0, 5).map((session) => (
                  <Link
                    key={session.id}
                    to={`/tenant/training/sessions/${session.id}`}
                    className="flex justify-between items-center p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(session.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {session.startTime && ` at ${formatTime(session.startTime)}`}
                      </p>
                      <p className="text-sm text-foreground-muted">
                        {session.location || t("tenant.training.sessions.locationTBD")}
                        {session.instructorName && ` - ${session.instructorName}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {session.enrolledCount || 0}/{session.maxStudents || course.maxStudents || "?"}{" "}
                        {t("tenant.training.students")}
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          session.status === "completed"
                            ? "bg-success-muted text-success"
                            : session.status === "cancelled"
                            ? "bg-danger-muted text-danger"
                            : session.status === "in_progress"
                            ? "bg-warning-muted text-warning"
                            : "bg-brand-muted text-brand"
                        }`}
                      >
                        {formatLabel(session.status)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Course Images */}
          {course.images && course.images.length > 0 && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">{t("tenant.training.courses.courseImages")}</h2>
              <div className="space-y-2">
                {course.images.map((img: string, idx: number) => (
                  <div key={idx} className="relative">
                    <img
                      src={img}
                      alt={`Course image ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    {idx === 0 && (
                      <span className="absolute top-2 left-2 bg-brand text-white text-xs px-2 py-1 rounded">
                        {t("tenant.training.courses.mainImage")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("common.quickActions")}</h2>
            <div className="space-y-2">
              <Link
                to={`/tenant/training/sessions/new?courseId=${course.id}`}
                className="block w-full text-center bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
              >
                {t("tenant.training.sessions.scheduleSession")}
              </Link>
              <fetcher.Form method="post">
                <CsrfInput />
                <input type="hidden" name="intent" value="toggle-active" />
                <button
                  type="submit"
                  className="w-full text-center border px-4 py-2 rounded-lg hover:bg-surface-inset"
                >
                  {course.isActive ? t("tenant.training.courses.deactivateCourse") : t("tenant.training.courses.activateCourse")}
                </button>
              </fetcher.Form>
              <fetcher.Form method="post">
                <CsrfInput />
                <input type="hidden" name="intent" value="toggle-public" />
                <button
                  type="submit"
                  className="w-full text-center border px-4 py-2 rounded-lg hover:bg-surface-inset"
                >
                  {course.isPublic ? t("tenant.training.courses.makePrivate") : t("tenant.training.courses.makePublic")}
                </button>
              </fetcher.Form>
            </div>
          </div>

          {/* Included Items */}
          {(course.materialsIncluded ||
            course.equipmentIncluded ||
            (course.includedItems && course.includedItems.length > 0)) && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">{t("tenant.training.courses.whatsIncluded")}</h2>
              <ul className="space-y-2 text-sm">
                {course.materialsIncluded && (
                  <li className="flex items-center gap-2">
                    <span className="text-success">&#10003;</span>
                    {t("tenant.training.courses.courseMaterials")}
                  </li>
                )}
                {course.equipmentIncluded && (
                  <li className="flex items-center gap-2">
                    <span className="text-success">&#10003;</span>
                    {t("tenant.training.courses.equipment")}
                  </li>
                )}
                {course.includedItems?.map((item: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-success">&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Required Items */}
          {course.requiredItems && course.requiredItems.length > 0 && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">{t("tenant.training.courses.studentsMustBring")}</h2>
              <ul className="space-y-2 text-sm">
                {course.requiredItems.map((item: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-foreground-subtle">&#8226;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-foreground-subtle">
            <p>
              Created{" "}
              {course.createdAt
                ? new Date(course.createdAt).toLocaleDateString()
                : "Unknown"}
            </p>
            {course.updatedAt && (
              <p>
                Updated {new Date(course.updatedAt).toLocaleDateString()}
              </p>
            )}
            <p>Course ID: {course.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
