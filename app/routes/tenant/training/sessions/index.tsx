/**
 * Sessions List Route
 *
 * Displays all training sessions with filtering by course, status, and date range.
 * Supports both list and calendar views.
 * Part of the Training Module (premium feature).
 */

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getCourseSessions,
  getTrainingCourses,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [
  { title: "Sessions - Training - DiveStreams" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);

  // Parse query parameters
  const courseFilter = url.searchParams.get("course") || "";
  const statusFilter = url.searchParams.get("status") || "";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";
  const search = url.searchParams.get("search") || "";
  const view = url.searchParams.get("view") || "list";

  // Check freemium access - training is a premium feature
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      sessions: [],
      courses: [],
      total: 0,
      courseFilter: "",
      statusFilter: "",
      dateFrom: "",
      dateTo: "",
      search: "",
      view: "list",
    };
  }

  // Get courses for filter dropdown
  const coursesData = await getTrainingCourses(ctx.org.id, { limit: 100 });

  // Get sessions with filters
  const sessionsData = await getCourseSessions(ctx.org.id, {
    courseId: courseFilter || undefined,
    status: statusFilter || undefined,
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
  });

  // Client-side search filtering
  let filteredSessions = sessionsData;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredSessions = filteredSessions.filter(
      (item) =>
        item.course?.name?.toLowerCase().includes(searchLower) ||
        item.session.location?.toLowerCase().includes(searchLower) ||
        item.session.sessionType?.toLowerCase().includes(searchLower)
    );
  }

  // Sort by date (most recent first for past, soonest for upcoming)
  filteredSessions.sort((a, b) => {
    const dateA = new Date(a.session.scheduledDate);
    const dateB = new Date(b.session.scheduledDate);
    return dateA.getTime() - dateB.getTime();
  });

  return {
    hasAccess: true,
    sessions: filteredSessions,
    courses: coursesData.courses,
    total: filteredSessions.length,
    courseFilter,
    statusFilter,
    dateFrom,
    dateTo,
    search,
    view,
  };
}

const sessionTypeLabels: Record<string, { label: string; color: string }> = {
  classroom: { label: "Classroom", color: "bg-blue-100 text-blue-800" },
  pool: { label: "Pool", color: "bg-cyan-100 text-cyan-800" },
  open_water: { label: "Open Water", color: "bg-green-100 text-green-800" },
  confined_water: { label: "Confined Water", color: "bg-teal-100 text-teal-800" },
  exam: { label: "Exam", color: "bg-purple-100 text-purple-800" },
};

const statusColors: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "bg-yellow-100 text-yellow-800" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

export default function SessionsListPage() {
  const {
    hasAccess,
    sessions,
    courses,
    total,
    courseFilter,
    statusFilter,
    dateFrom,
    dateTo,
    search,
    view: initialView,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState(initialView);

  // Handle search form submission
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params: Record<string, string> = {};

    const searchValue = formData.get("search") as string;
    const courseValue = formData.get("course") as string;
    const statusValue = formData.get("status") as string;
    const dateFromValue = formData.get("dateFrom") as string;
    const dateToValue = formData.get("dateTo") as string;

    if (searchValue) params.search = searchValue;
    if (courseValue) params.course = courseValue;
    if (statusValue) params.status = statusValue;
    if (dateFromValue) params.dateFrom = dateFromValue;
    if (dateToValue) params.dateTo = dateToValue;
    if (viewMode !== "list") params.view = viewMode;

    setSearchParams(params);
  };

  // Toggle view mode
  const toggleView = (mode: string) => {
    setViewMode(mode);
    const params = new URLSearchParams(searchParams);
    if (mode === "list") {
      params.delete("view");
    } else {
      params.set("view", mode);
    }
    setSearchParams(params);
  };

  // Format time for display
  const formatTime = (time: string) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Group sessions by date for calendar view
  const groupSessionsByDate = () => {
    const grouped: Record<string, typeof sessions> = {};
    sessions.forEach((item) => {
      const date = item.session.scheduledDate;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(item);
    });
    return grouped;
  };

  // Premium gate
  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">📅</div>
        <h1 className="text-2xl font-bold mb-4">Training Sessions</h1>
        <p className="text-gray-600 mb-6">
          Schedule and manage course sessions for your dive shop.
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

  const groupedSessions = viewMode === "calendar" ? groupSessionsByDate() : {};

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-gray-500">{total} training sessions</p>
        </div>
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => toggleView("list")}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === "list"
                  ? "bg-white shadow text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              List
            </button>
            <button
              onClick={() => toggleView("calendar")}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === "calendar"
                  ? "bg-white shadow text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Calendar
            </button>
          </div>
          <Link
            to="/app/training/sessions/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Schedule Session
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search sessions..."
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
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          name="dateFrom"
          defaultValue={dateFrom}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="From Date"
        />
        <input
          type="date"
          name="dateTo"
          defaultValue={dateTo}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="To Date"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Filter
        </button>
      </form>

      {/* List View */}
      {viewMode === "list" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Date
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Time
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Course
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Type
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Location
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
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {search || courseFilter || statusFilter || dateFrom || dateTo
                      ? "No sessions found matching your filters."
                      : "No sessions scheduled yet. Create your first training session to get started."}
                  </td>
                </tr>
              ) : (
                sessions.map((item) => (
                  <tr key={item.session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-medium">
                        {formatDate(item.session.scheduledDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">
                        {formatTime(item.session.startTime)}
                        {item.session.endTime && (
                          <span className="text-gray-500">
                            {" - "}{formatTime(item.session.endTime)}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/app/training/courses/${item.course?.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {item.course?.name || "N/A"}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          sessionTypeLabels[item.session.sessionType]?.color ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {sessionTypeLabels[item.session.sessionType]?.label ||
                          item.session.sessionType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">
                        {item.session.location || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm">
                        {item.session.maxStudents || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          statusColors[item.session.status]?.color ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {statusColors[item.session.status]?.label ||
                          item.session.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/app/training/sessions/${item.session.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View
                        </Link>
                        <Link
                          to={`/app/training/sessions/${item.session.id}/edit`}
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
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {Object.keys(groupedSessions).length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              {search || courseFilter || statusFilter || dateFrom || dateTo
                ? "No sessions found matching your filters."
                : "No sessions scheduled yet. Create your first training session to get started."}
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(groupedSessions)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, daySessions]) => (
                  <div key={date} className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      {formatDate(date)}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {daySessions.map((item) => (
                        <Link
                          key={item.session.id}
                          to={`/app/training/sessions/${item.session.id}`}
                          className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-sm">
                              {formatTime(item.session.startTime)}
                              {item.session.endTime && (
                                <span className="text-gray-500">
                                  {" - "}{formatTime(item.session.endTime)}
                                </span>
                              )}
                            </span>
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                                statusColors[item.session.status]?.color ||
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {statusColors[item.session.status]?.label ||
                                item.session.status}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.course?.name || "N/A"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {sessionTypeLabels[item.session.sessionType]?.label ||
                              item.session.sessionType}
                            {item.session.location && (
                              <span> - {item.session.location}</span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {sessions.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{total}</div>
            <div className="text-sm text-gray-600">Total Sessions</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-yellow-600">
              {sessions.filter((s) => s.session.status === "scheduled").length}
            </div>
            <div className="text-sm text-gray-600">Scheduled</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">
              {sessions.filter((s) => s.session.status === "completed").length}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(sessions.map((s) => s.course?.id)).size}
            </div>
            <div className="text-sm text-gray-600">Unique Courses</div>
          </div>
        </div>
      )}
    </div>
  );
}
