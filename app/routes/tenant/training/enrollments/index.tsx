/**
 * Enrollments List Route
 *
 * Displays all student enrollments with filtering by course, status, and search.
 * Part of the Training Module (premium feature).
 */

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getEnrollments,
  getTrainingCourses,
  getStudentProgress,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [
  { title: "Enrollments - Training - DiveStreams" },
];

// Enrollment status configuration with labels and colors
const statusConfig: Record<string, { label: string; color: string }> = {
  pending_scheduling: {
    label: "Pending Scheduling",
    color: "bg-yellow-100 text-yellow-800",
  },
  scheduled: {
    label: "Scheduled",
    color: "bg-blue-100 text-blue-800",
  },
  enrolled: {
    label: "Enrolled",
    color: "bg-indigo-100 text-indigo-800",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-purple-100 text-purple-800",
  },
  completed: {
    label: "Completed",
    color: "bg-teal-100 text-teal-800",
  },
  certified: {
    label: "Certified",
    color: "bg-green-100 text-green-800",
  },
  withdrawn: {
    label: "Withdrawn",
    color: "bg-red-100 text-red-800",
  },
};

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);

  // Parse query parameters
  const courseFilter = url.searchParams.get("course") || "";
  const statusFilter = url.searchParams.get("status") || "";
  const search = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "1");

  // Check freemium access - training is a premium feature
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      enrollments: [],
      courses: [],
      total: 0,
      page: 1,
      totalPages: 0,
      courseFilter: "",
      statusFilter: "",
      search: "",
    };
  }

  // Get courses for filter dropdown
  const coursesData = await getTrainingCourses(ctx.org.id, { limit: 100 });
  const courses = coursesData.courses;

  // Get enrollments with filters
  const enrollmentsData = await getEnrollments(ctx.org.id, {
    page,
    limit: 20,
    courseId: courseFilter || undefined,
    status: statusFilter || undefined,
  });

  // Filter by student name search (client-side filtering for now)
  let filteredEnrollments = enrollmentsData.enrollments;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredEnrollments = filteredEnrollments.filter((item) => {
      const firstName = item.customer?.firstName?.toLowerCase() || "";
      const lastName = item.customer?.lastName?.toLowerCase() || "";
      const email = item.customer?.email?.toLowerCase() || "";
      const fullName = `${firstName} ${lastName}`;

      return (
        firstName.includes(searchLower) ||
        lastName.includes(searchLower) ||
        fullName.includes(searchLower) ||
        email.includes(searchLower)
      );
    });
  }

  // Get progress for each enrollment (for display)
  const enrollmentsWithProgress = await Promise.all(
    filteredEnrollments.map(async (item) => {
      const progress = await getStudentProgress(ctx.org.id, item.enrollment.id);
      return {
        ...item,
        progress: progress?.progress?.total || 0,
      };
    })
  );

  return {
    hasAccess: true,
    enrollments: enrollmentsWithProgress,
    courses,
    total: enrollmentsData.total,
    page: enrollmentsData.page,
    totalPages: enrollmentsData.totalPages,
    courseFilter,
    statusFilter,
    search,
  };
}

export default function EnrollmentsListPage() {
  const {
    hasAccess,
    enrollments,
    courses,
    total,
    page,
    totalPages,
    courseFilter,
    statusFilter,
    search,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle search form submission
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params: Record<string, string> = {};

    const searchValue = formData.get("search") as string;
    const courseValue = formData.get("course") as string;
    const statusValue = formData.get("status") as string;

    if (searchValue) params.search = searchValue;
    if (courseValue) params.course = courseValue;
    if (statusValue) params.status = statusValue;

    setSearchParams(params);
  };

  // Handle pagination
  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  // Format date for display
  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString();
  };

  // Premium gate
  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">👥</div>
        <h1 className="text-2xl font-bold mb-4">Student Enrollments</h1>
        <p className="text-gray-600 mb-6">
          Track student enrollments and progress through certification courses.
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
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Enrollments</h1>
          <p className="text-gray-500">{total} student enrollments</p>
        </div>
        <Link
          to="/app/training/enrollments/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          New Enrollment
        </Link>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search by student name..."
          className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          name="course"
          defaultValue={courseFilter}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Courses</option>
          {courses.map((item) => (
            <option key={item.course.id} value={item.course.id}>
              {item.course.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(statusConfig).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Filter
        </button>
      </form>

      {/* Enrollments Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Student Name
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Course
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Status
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Enrolled Date
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Progress
              </th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {search || courseFilter || statusFilter
                    ? "No enrollments found matching your filters."
                    : "No enrollments yet. Create your first enrollment to get started."}
                </td>
              </tr>
            ) : (
              enrollments.map((item) => {
                const status = item.enrollment.status || "pending_scheduling";
                const config = statusConfig[status] || statusConfig.pending_scheduling;

                return (
                  <tr key={item.enrollment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        to={`/app/training/enrollments/${item.enrollment.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {item.customer?.firstName || "Unknown"}{" "}
                        {item.customer?.lastName || "Student"}
                      </Link>
                      {item.customer?.email && (
                        <p className="text-sm text-gray-500">
                          {item.customer.email}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">
                        {item.course?.name || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs rounded-full ${config.color}`}
                      >
                        {config.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">
                        {formatDate(item.enrollment.enrolledAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {item.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/app/training/enrollments/${item.enrollment.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View
                        </Link>
                        <Link
                          to={`/app/customers/${item.customer?.id}`}
                          className="text-gray-600 hover:underline text-sm"
                        >
                          Student
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t flex justify-between items-center">
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {enrollments.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{total}</div>
            <div className="text-sm text-gray-600">Total Enrollments</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">
              {
                enrollments.filter(
                  (e) =>
                    e.enrollment.status === "in_progress" ||
                    e.enrollment.status === "enrolled" ||
                    e.enrollment.status === "scheduled"
                ).length
              }
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">
              {
                enrollments.filter((e) => e.enrollment.status === "certified")
                  .length
              }
            </div>
            <div className="text-sm text-gray-600">Certified</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-yellow-600">
              {
                enrollments.filter(
                  (e) => e.enrollment.status === "pending_scheduling"
                ).length
              }
            </div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
        </div>
      )}
    </div>
  );
}
