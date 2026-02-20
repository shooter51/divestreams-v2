import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getEnrollments, getSessions } from "../../../../../lib/db/training.server";
import { useNotification } from "../../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "Enrollments - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const sessionId = url.searchParams.get("sessionId") || "";

  // Get enrollments with optional filters
  const enrollments = await getEnrollments(ctx.org.id, {
    status: status || undefined,
    sessionId: sessionId || undefined,
  });

  // Get sessions for the filter dropdown
  const sessions = await getSessions(ctx.org.id);

  // Transform to UI format
  const enrollmentData = enrollments.map((e) => ({
    id: e.id,
    student: {
      id: e.customerId,
      firstName: e.customerFirstName || "",
      lastName: e.customerLastName || "",
      email: e.customerEmail || "",
    },
    course: {
      name: e.courseName || "Unknown Course",
      agencyName: e.agencyName || "",
      levelName: e.levelName || "",
    },
    sessionDate: e.sessionStartDate || "",
    status: e.status,
    paymentStatus: e.paymentStatus,
    amountPaid: e.amountPaid || "0.00",
    certificationNumber: e.certificationNumber,
    certificationDate: e.certificationDate,
    enrolledAt: e.enrolledAt
      ? new Date(e.enrolledAt).toLocaleDateString()
      : "",
    completedAt: e.completedAt
      ? new Date(e.completedAt).toLocaleDateString()
      : null,
  }));

  // Calculate stats
  const stats = {
    enrolled: enrollments.filter((e) => e.status === "enrolled").length,
    inProgress: enrollments.filter((e) => e.status === "in_progress").length,
    completed: enrollments.filter((e) => e.status === "completed").length,
    certified: enrollments.filter((e) => e.certificationNumber).length,
  };

  return {
    enrollments: enrollmentData,
    sessions,
    total: enrollments.length,
    status,
    sessionId,
    stats,
  };
}

const statusColors: Record<string, string> = {
  enrolled: "bg-brand-muted text-brand",
  in_progress: "bg-warning-muted text-warning",
  completed: "bg-success-muted text-success",
  dropped: "bg-surface-inset text-foreground-muted",
  failed: "bg-danger-muted text-danger",
};

const paymentStatusColors: Record<string, string> = {
  pending: "bg-warning-muted text-warning",
  partial: "bg-warning-muted text-warning",
  paid: "bg-success-muted text-success",
  refunded: "bg-surface-inset text-foreground-muted",
};

export default function EnrollmentsPage() {
  useNotification();

  const { enrollments, sessions, total, status, sessionId, stats } =
    useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params: Record<string, string> = {};
    const newStatus = formData.get("status") as string;
    const newSessionId = formData.get("sessionId") as string;
    if (newStatus) params.status = newStatus;
    if (newSessionId) params.sessionId = newSessionId;
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Training Enrollments</h1>
          <p className="text-foreground-muted">{total} total enrollments</p>
        </div>
        <Link
          to="/tenant/training/enrollments/new"
          className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
        >
          New Enrollment
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-brand">{stats.enrolled}</p>
          <p className="text-foreground-muted text-sm">Enrolled</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-warning">
            {stats.inProgress}
          </p>
          <p className="text-foreground-muted text-sm">In Progress</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-success">{stats.completed}</p>
          <p className="text-foreground-muted text-sm">Completed</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{stats.certified}</p>
          <p className="text-foreground-muted text-sm">Certified</p>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} className="mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
          >
            <option value="">All Statuses</option>
            <option value="enrolled">Enrolled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="dropped">Dropped</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Session
          </label>
          <select
            name="sessionId"
            defaultValue={sessionId}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
          >
            <option value="">All Sessions</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.courseName} - {session.startDate}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay"
        >
          Filter
        </button>
        {(status || sessionId) && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 text-foreground-muted hover:text-foreground"
          >
            Clear
          </button>
        )}
      </form>

      {/* Enrollments Table */}
      <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-inset border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">
                Student
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">
                Course
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">
                Session Date
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">
                Status
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">
                Payment
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">
                Certification
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-foreground-muted">
                  {status || sessionId
                    ? "No enrollments found matching your filters."
                    : "No enrollments yet. Create your first enrollment to get started."}
                </td>
              </tr>
            ) : (
              enrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-surface-inset">
                  <td className="px-6 py-4">
                    <Link
                      to={`/tenant/customers/${enrollment.student.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {enrollment.student.firstName} {enrollment.student.lastName}
                    </Link>
                    <p className="text-sm text-foreground-muted">
                      {enrollment.student.email}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{enrollment.course.name}</p>
                    <p className="text-sm text-foreground-muted">
                      {enrollment.course.agencyName}{" "}
                      {enrollment.course.levelName &&
                        `- ${enrollment.course.levelName}`}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p>{enrollment.sessionDate}</p>
                    <p className="text-xs text-foreground-subtle">
                      Enrolled: {enrollment.enrolledAt}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        statusColors[enrollment.status] ||
                        "bg-surface-inset text-foreground"
                      }`}
                    >
                      {enrollment.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        paymentStatusColors[enrollment.paymentStatus || "pending"] ||
                        "bg-surface-inset text-foreground"
                      }`}
                    >
                      {enrollment.paymentStatus || "pending"}
                    </span>
                    <p className="text-xs text-foreground-muted mt-1">
                      ${enrollment.amountPaid} paid
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {enrollment.certificationNumber ? (
                      <div>
                        <p className="text-sm font-medium text-success">
                          {enrollment.certificationNumber}
                        </p>
                        <p className="text-xs text-foreground-muted">
                          {enrollment.certificationDate}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-foreground-subtle">Not certified</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/tenant/training/enrollments/${enrollment.id}`}
                      className="text-brand hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
