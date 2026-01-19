import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getEnrollments, getSessions } from "../../../../../lib/db/training.server";

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
  enrolled: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  dropped: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-700",
};

const paymentStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  partial: "bg-orange-100 text-orange-700",
  paid: "bg-green-100 text-green-700",
  refunded: "bg-gray-100 text-gray-600",
};

export default function EnrollmentsPage() {
  const { enrollments, sessions, total, status, sessionId, stats } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

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
          <p className="text-gray-500">{total} total enrollments</p>
        </div>
        <Link
          to="/app/training/enrollments/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          New Enrollment
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-blue-600">{stats.enrolled}</p>
          <p className="text-gray-500 text-sm">Enrolled</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-yellow-600">
            {stats.inProgress}
          </p>
          <p className="text-gray-500 text-sm">In Progress</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-gray-500 text-sm">Completed</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{stats.certified}</p>
          <p className="text-gray-500 text-sm">Certified</p>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} className="mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Session
          </label>
          <select
            name="sessionId"
            defaultValue={sessionId}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Filter
        </button>
        {(status || sessionId) && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Clear
          </button>
        )}
      </form>

      {/* Enrollments Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Student
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Course
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Session Date
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Status
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Payment
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Certification
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  {status || sessionId
                    ? "No enrollments found matching your filters."
                    : "No enrollments yet. Create your first enrollment to get started."}
                </td>
              </tr>
            ) : (
              enrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/app/customers/${enrollment.student.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {enrollment.student.firstName} {enrollment.student.lastName}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {enrollment.student.email}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{enrollment.course.name}</p>
                    <p className="text-sm text-gray-500">
                      {enrollment.course.agencyName}{" "}
                      {enrollment.course.levelName &&
                        `- ${enrollment.course.levelName}`}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p>{enrollment.sessionDate}</p>
                    <p className="text-xs text-gray-400">
                      Enrolled: {enrollment.enrolledAt}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        statusColors[enrollment.status] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {enrollment.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        paymentStatusColors[enrollment.paymentStatus || "pending"] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {enrollment.paymentStatus || "pending"}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      ${enrollment.amountPaid} paid
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {enrollment.certificationNumber ? (
                      <div>
                        <p className="text-sm font-medium text-green-600">
                          {enrollment.certificationNumber}
                        </p>
                        <p className="text-xs text-gray-500">
                          {enrollment.certificationDate}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Not certified</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/app/training/enrollments/${enrollment.id}`}
                      className="text-blue-600 hover:underline text-sm"
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
