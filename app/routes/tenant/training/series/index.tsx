import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getSeriesList, getCourses } from "../../../../../lib/db/training.server";
import { useNotification } from "../../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "Training Series - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId") || "";
  const status = url.searchParams.get("status") || "";

  const [seriesList, courses] = await Promise.all([
    getSeriesList(ctx.org.id, {
      courseId: courseId || undefined,
      status: status || undefined,
    }),
    getCourses(ctx.org.id),
  ]);

  return {
    seriesList,
    courses,
    total: seriesList.length,
    courseId,
    status,
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

export default function SeriesPage() {
  useNotification();

  const { seriesList, courses, total, courseId, status } = useLoaderData<typeof loader>();
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Training Series</h1>
          <p className="text-foreground-muted">{total} series{total !== 1 ? "" : ""}</p>
        </div>
        <Link
          to="/tenant/training/series/new"
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          New Series
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-surface-raised rounded-xl p-4 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4 items-end">
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

      {/* Series List */}
      {seriesList.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-12 shadow-sm text-center">
          <p className="text-foreground-muted">
            {hasFilters
              ? "No series match your filters."
              : "No training series created yet."}
          </p>
          <Link
            to="/tenant/training/series/new"
            className="inline-block mt-4 text-brand hover:underline"
          >
            Create your first series
          </Link>
        </div>
      ) : (
        <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-inset border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Name</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Course</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Sessions</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Enrolled</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {seriesList.map((series) => (
                <tr key={series.id} className="hover:bg-surface-inset">
                  <td className="px-6 py-4">
                    <p className="font-medium">{series.name}</p>
                    {series.instructorName && (
                      <p className="text-sm text-foreground-muted">Instructor: {series.instructorName}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{series.courseName}</p>
                    {series.agencyName && (
                      <span className="text-xs bg-surface-inset px-2 py-0.5 rounded">
                        {series.agencyName}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{series.sessionCount ?? 0} sessions</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">
                      {series.enrolledCount ?? 0}{series.maxStudents ? `/${series.maxStudents}` : ""}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-3 py-1 rounded-full ${
                        statusColors[series.status] || "bg-surface-inset text-foreground"
                      }`}
                    >
                      {statusLabels[series.status] || series.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/tenant/training/series/${series.id}`}
                      className="text-brand hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
