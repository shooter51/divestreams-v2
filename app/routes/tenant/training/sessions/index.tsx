import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getSessions, getCourses } from "../../../../../lib/db/training.server";
import { useNotification } from "../../../../../lib/use-notification";

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

const statusColors: Record<string, string> = {
  scheduled: "bg-brand-muted text-brand",
  in_progress: "bg-warning-muted text-warning",
  completed: "bg-success-muted text-success",
  cancelled: "bg-danger-muted text-danger",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function SessionsPage() {
  useNotification();

  const { sessions, courses, total, courseId, status } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

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
          <h1 className="text-2xl font-bold">Training Sessions</h1>
          <p className="text-foreground-muted">{total} session{total !== 1 ? "s" : ""}</p>
        </div>
        <Link
          to="/tenant/training/courses"
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          New Session
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-surface-raised rounded-xl p-4 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Course Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-foreground mb-1">
              Course
            </label>
            <select
              value={courseId}
              onChange={(e) => updateFilter("courseId", e.target.value)}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            >
              <option value="">All Courses</option>
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
              Status
            </label>
            <select
              value={status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-foreground-muted hover:text-foreground hover:bg-surface-overlay rounded-lg"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-12 shadow-sm text-center">
          <p className="text-foreground-muted">
            {hasFilters
              ? "No sessions match your filters."
              : "No training sessions scheduled yet."}
          </p>
          <Link
            to="/tenant/training/courses"
            className="inline-block mt-4 text-brand hover:underline"
          >
            Schedule a session from a course
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
                          <p className="text-lg font-bold">{session.startTime || "TBD"}</p>
                          {session.endDate && session.endDate !== session.startDate && (
                            <p className="text-xs text-foreground-muted">
                              to {new Date(session.endDate + "T00:00:00").toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{session.courseName}</p>
                          <div className="flex items-center gap-2 text-sm text-foreground-muted">
                            {session.agencyName && (
                              <span className="text-xs bg-surface-inset px-2 py-0.5 rounded">
                                {session.agencyName}
                              </span>
                            )}
                            {session.instructorName && (
                              <span>Instructor: {session.instructorName}</span>
                            )}
                            {session.location && (
                              <span>@ {session.location}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-medium">
                            {session.enrolledCount || 0}{session.maxStudents ? `/${session.maxStudents}` : ""} enrolled
                          </p>
                          <p className="text-sm text-foreground-muted">
                            {session.priceOverride
                              ? `$${session.priceOverride}`
                              : session.coursePrice
                              ? `$${session.coursePrice}`
                              : "Price TBD"}
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
          <strong>Tip:</strong> Sessions are created from the course detail page.
          Select a course and click "Schedule Session" to create a new training session.
        </p>
      </div>
    </div>
  );
}
