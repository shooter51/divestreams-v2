import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getSessions, getCourses } from "../../../../../lib/db/training.server";
import { useNotification } from "../../../../../lib/use-notification";
import { useT } from "../../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Training Sessions - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId") || "";
  const status = url.searchParams.get("status") || "";

  // Get sessions with filters
  const sessions = await getSessions(ctx.org.id, {
    courseId: courseId || undefined,
    status: status || undefined,
  });

  // Get courses for filter dropdown
  const courses = await getCourses(ctx.org.id);

  return {
    sessions,
    courses,
    total: sessions.length,
    courseId,
    status,
    isPremium: ctx.isPremium,
  };
}

const sessionTypeColors: Record<string, string> = {
  classroom: "bg-blue-100 text-blue-700",
  pool: "bg-cyan-100 text-cyan-700",
  confined_water: "bg-teal-100 text-teal-700",
  open_water: "bg-emerald-100 text-emerald-700",
  exam: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-700",
};

const statusColors: Record<string, string> = {
  open: "bg-brand-muted text-brand",
  scheduled: "bg-brand-muted text-brand",
  in_progress: "bg-warning-muted text-warning",
  completed: "bg-success-muted text-success",
  cancelled: "bg-danger-muted text-danger",
};

export default function SessionsPage() {
  useNotification();
  const t = useT();

  const { sessions, courses, total, courseId, status } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const sessionTypeLabels: Record<string, string> = {
    classroom: t("tenant.training.sessions.typeClassroom"),
    pool: t("tenant.training.sessions.typePool"),
    confined_water: t("tenant.training.sessions.typeConfinedWater"),
    open_water: t("tenant.training.sessions.typeOpenWater"),
    exam: t("tenant.training.sessions.typeExam"),
    other: t("tenant.training.sessions.typeOther"),
  };

  const statusLabels: Record<string, string> = {
    open: t("tenant.training.sessions.statusOpen"),
    full: t("tenant.training.sessions.statusFull"),
    scheduled: t("tenant.training.sessions.statusScheduled"),
    in_progress: t("tenant.training.sessions.statusInProgress"),
    completed: t("tenant.training.sessions.statusCompleted"),
    cancelled: t("tenant.training.sessions.statusCancelled"),
  };

  function formatTime(time: string | null | undefined): string {
    if (!time) return t("tenant.training.sessions.tbd");
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  }

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasFilters = courseId || status;

  // Group sessions by date
  const sessionsByDate: Record<string, typeof sessions> = {};
  sessions.forEach((session) => {
    const date = session.startDate;
    if (!sessionsByDate[date]) sessionsByDate[date] = [];
    sessionsByDate[date].push(session);
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("tenant.training.sessions.title")}</h1>
          <p className="text-foreground-muted">{t("tenant.training.sessions.sessionCount", { count: total })}</p>
        </div>
        <Link
          to="/tenant/training/sessions/new"
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          {t("tenant.training.sessions.newSession")}
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-surface-raised rounded-xl p-4 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Course Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("tenant.training.sessions.course")}
            </label>
            <select
              value={courseId}
              onChange={(e) => updateFilter("courseId", e.target.value)}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            >
              <option value="">{t("tenant.training.sessions.allCourses")}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("common.status")}
            </label>
            <select
              value={status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            >
              <option value="">{t("tenant.training.sessions.allStatuses")}</option>
              <option value="scheduled">{t("tenant.training.sessions.statusScheduled")}</option>
              <option value="in_progress">{t("tenant.training.sessions.statusInProgress")}</option>
              <option value="completed">{t("tenant.training.sessions.statusCompleted")}</option>
              <option value="cancelled">{t("tenant.training.sessions.statusCancelled")}</option>
            </select>
          </div>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-foreground-muted hover:text-foreground hover:bg-surface-overlay rounded-lg"
            >
              {t("tenant.training.sessions.clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-12 shadow-sm text-center">
          <p className="text-foreground-muted">
            {hasFilters
              ? t("tenant.training.sessions.noMatchingFilters")
              : t("tenant.training.sessions.noSessionsYet")}
          </p>
          <Link
            to="/tenant/training/courses"
            className="inline-block mt-4 text-brand hover:underline"
          >
            {t("tenant.training.sessions.scheduleFromCourse")}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(sessionsByDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dateSessions]) => (
              <div key={date}>
                <h3 className="font-semibold text-foreground mb-3">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                <div className="space-y-3">
                  {dateSessions.map((session) => (
                    <Link
                      key={session.id}
                      to={`/tenant/training/sessions/${session.id}`}
                      className="flex items-center justify-between bg-surface-raised rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <p className="text-lg font-bold">{formatTime(session.startTime)}</p>
                          {session.endDate && session.endDate !== session.startDate && (
                            <p className="text-xs text-foreground-muted">
                              {t("tenant.training.sessions.toDate", { date: new Date(session.endDate + "T00:00:00").toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              }) })}
                            </p>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{session.courseName}</p>
                            {session.sessionType && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  sessionTypeColors[session.sessionType] || "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {sessionTypeLabels[session.sessionType] || session.sessionType}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-foreground-muted">
                            {session.agencyName && (
                              <span className="text-xs bg-surface-inset px-2 py-0.5 rounded">
                                {session.agencyName}
                              </span>
                            )}
                            {session.instructorName && (
                              <span>{t("tenant.training.sessions.instructor")}: {session.instructorName}</span>
                            )}
                            {session.location && (
                              <span>@ {session.location}</span>
                            )}
                            {session.seriesId && session.seriesName && (
                              <Link
                                to={`/tenant/training/series/${session.seriesId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-brand hover:underline"
                              >
                                {t("tenant.training.sessions.series")}: {session.seriesName}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-medium">
                            {session.enrolledCount || 0}{session.maxStudents ? `/${session.maxStudents}` : ""} {t("tenant.training.sessions.enrolled")}
                          </p>
                          <p className="text-sm text-foreground-muted">
                            {session.priceOverride
                              ? `$${session.priceOverride}`
                              : session.coursePrice
                              ? `$${session.coursePrice}`
                              : t("tenant.training.sessions.priceTbd")}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-3 py-1 rounded-full ${
                            statusColors[session.status] || "bg-surface-inset text-foreground"
                          }`}
                        >
                          {statusLabels[session.status] || session.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Quick Info */}
      <div className="mt-8 p-4 bg-brand-muted rounded-lg">
        <p className="text-sm text-brand">
          <strong>{t("tenant.training.sessions.tip")}:</strong> {t("tenant.training.sessions.tipText")}
        </p>
      </div>
    </div>
  );
}
