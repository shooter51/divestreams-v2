import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getCourses, getAgencies } from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [{ title: "Training Courses - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const agencyFilter = url.searchParams.get("agency") || "";
  const statusFilter = url.searchParams.get("status") || "";

  // Get courses and agencies
  const [courseList, agencies] = await Promise.all([
    getCourses(ctx.org.id),
    getAgencies(ctx.org.id),
  ]);

  // Apply filters on the results
  let filteredCourses = courseList;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredCourses = filteredCourses.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.code?.toLowerCase().includes(searchLower) ||
        c.description?.toLowerCase().includes(searchLower)
    );
  }

  if (agencyFilter) {
    filteredCourses = filteredCourses.filter((c) => c.agencyId === agencyFilter);
  }

  if (statusFilter === "active") {
    filteredCourses = filteredCourses.filter((c) => c.isActive);
  } else if (statusFilter === "inactive") {
    filteredCourses = filteredCourses.filter((c) => !c.isActive);
  }

  // Transform to UI format
  const courses = filteredCourses.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code || "",
    description: c.description || "",
    agencyName: c.agencyName || "No Agency",
    levelName: c.levelName || "No Level",
    durationDays: c.durationDays || 0,
    price: c.price ? Number(c.price).toFixed(2) : "0.00",
    currency: c.currency || "USD",
    maxStudents: c.maxStudents || 0,
    isActive: c.isActive ?? true,
    isPublic: c.isPublic ?? false,
  }));

  return {
    courses,
    agencies,
    total: courses.length,
    search,
    agencyFilter,
    statusFilter,
  };
}

export default function CoursesIndexPage() {
  const { courses, agencies, total, search, agencyFilter, statusFilter } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get("search") as string;
    const agency = formData.get("agency") as string;
    const status = formData.get("status") as string;
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (agency) params.agency = agency;
    if (status) params.status = status;
    setSearchParams(params);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Training Courses</h1>
          <p className="text-gray-500">{total} courses</p>
        </div>
        <Link
          to="/app/training/courses/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Course
        </Link>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-4 flex-wrap">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search courses..."
          className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Filter
        </button>
      </form>

      {/* Course List */}
      {courses.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-gray-500">
            {search || agencyFilter || statusFilter
              ? "No courses found matching your filters."
              : "No courses yet. Create your first training course to get started."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Course
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Agency / Level
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Duration
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Price
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Status
                </th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <Link
                        to={`/app/training/courses/${course.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {course.name}
                      </Link>
                      {course.code && (
                        <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {course.code}
                        </span>
                      )}
                    </div>
                    {course.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">
                        {course.description}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="font-medium">{course.agencyName}</p>
                      <p className="text-gray-500">{course.levelName}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">
                      {course.durationDays} {course.durationDays === 1 ? "day" : "days"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium">
                      ${course.price} {course.currency}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        course.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {course.isActive ? "Active" : "Inactive"}
                    </span>
                    {course.isPublic && (
                      <span className="ml-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                        Public
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/app/training/courses/${course.id}`}
                      className="text-blue-600 hover:underline text-sm"
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
