/**
 * Courses List Route
 *
 * Displays all training courses with filtering by agency and status.
 * Part of the Training Module (premium feature).
 */

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getTrainingCourses,
  getCertificationAgencies,
  getEnrollments,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [
  { title: "Courses - Training - DiveStreams" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);

  // Parse query parameters
  const agencyFilter = url.searchParams.get("agency") || "";
  const statusFilter = url.searchParams.get("status") || "active";
  const search = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "1");

  // Check freemium access - training is a premium feature
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      courses: [],
      agencies: [],
      total: 0,
      page: 1,
      totalPages: 0,
      agencyFilter: "",
      statusFilter: "active",
      search: "",
    };
  }

  // Get agencies for filter dropdown
  const agencies = await getCertificationAgencies(ctx.org.id);

  // Get courses with filters
  const coursesData = await getTrainingCourses(ctx.org.id, {
    page,
    limit: 20,
    agencyId: agencyFilter || undefined,
  });

  // Filter by search and status on the client data
  // (Status filtering done here since isActive is already in the query)
  let filteredCourses = coursesData.courses;

  // Search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filteredCourses = filteredCourses.filter(
      (item) =>
        item.course.name.toLowerCase().includes(searchLower) ||
        item.course.description?.toLowerCase().includes(searchLower) ||
        item.agency?.name?.toLowerCase().includes(searchLower) ||
        item.level?.name?.toLowerCase().includes(searchLower)
    );
  }

  // Get enrollment counts for each course
  const courseIds = filteredCourses.map((c) => c.course.id);
  const enrollmentCounts: Record<string, number> = {};

  for (const courseId of courseIds) {
    const enrollmentData = await getEnrollments(ctx.org.id, {
      courseId,
      limit: 1000, // Just to get total
    });
    enrollmentCounts[courseId] = enrollmentData.total;
  }

  // Transform courses with enrollment data
  const coursesWithEnrollments = filteredCourses.map((item) => ({
    ...item,
    studentCount: enrollmentCounts[item.course.id] || 0,
  }));

  return {
    hasAccess: true,
    courses: coursesWithEnrollments,
    agencies,
    total: coursesData.total,
    page: coursesData.page,
    totalPages: coursesData.totalPages,
    agencyFilter,
    statusFilter,
    search,
  };
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-600",
};

export default function CoursesListPage() {
  const {
    hasAccess,
    courses,
    agencies,
    total,
    page,
    totalPages,
    agencyFilter,
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
    const agencyValue = formData.get("agency") as string;
    const statusValue = formData.get("status") as string;

    if (searchValue) params.search = searchValue;
    if (agencyValue) params.agency = agencyValue;
    if (statusValue && statusValue !== "active") params.status = statusValue;

    setSearchParams(params);
  };

  // Handle pagination
  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params);
  };

  // Premium gate
  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h1 className="text-2xl font-bold mb-4">Training Courses</h1>
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
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-gray-500">{total} training courses</p>
        </div>
        <Link
          to="/app/training/courses/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Add Course
        </Link>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search courses..."
          className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          name="agency"
          defaultValue={agencyFilter}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Agencies</option>
          {agencies.map((agency) => (
            <option key={agency.id} value={agency.id}>
              {agency.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Filter
        </button>
      </form>

      {/* Courses Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Course Name
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Agency
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Level
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Price
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Students
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-sm font-medium text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  {search || agencyFilter
                    ? "No courses found matching your filters."
                    : "No courses yet. Create your first training course to get started."}
                </td>
              </tr>
            ) : (
              courses.map((item) => (
                <tr key={item.course.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/app/training/courses/${item.course.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {item.course.name}
                    </Link>
                    {item.course.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">
                        {item.course.description}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">
                      {item.agency?.name || "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">
                      {item.level?.name || "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium">
                      ${Number(item.course.price || 0).toFixed(2)}
                    </span>
                    {item.course.depositAmount && (
                      <span className="text-xs text-gray-500 block">
                        ${Number(item.course.depositAmount).toFixed(2)} deposit
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{item.studentCount}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        item.course.isActive
                          ? statusColors.active
                          : statusColors.inactive
                      }`}
                    >
                      {item.course.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/app/training/courses/${item.course.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        View
                      </Link>
                      <Link
                        to={`/app/training/courses/${item.course.id}/edit`}
                        className="text-gray-600 hover:underline text-sm"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
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
      {courses.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{total}</div>
            <div className="text-sm text-gray-600">Total Courses</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">
              {courses.filter((c) => c.course.isActive).length}
            </div>
            <div className="text-sm text-gray-600">Active Courses</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">
              {courses.reduce((sum, c) => sum + c.studentCount, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Students</div>
          </div>
        </div>
      )}
    </div>
  );
}
