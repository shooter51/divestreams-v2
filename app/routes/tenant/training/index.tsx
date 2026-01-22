import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import {
  getTrainingDashboardStats,
  getUpcomingTrainingSessions,
  getRecentEnrollments,
} from "../../../../lib/db/training.server";

export const meta: MetaFunction = () => {
  return [{ title: "Training - DiveStreams" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  const [stats, upcomingSessions, recentEnrollments] = await Promise.all([
    getTrainingDashboardStats(ctx.org.id),
    getUpcomingTrainingSessions(ctx.org.id, 5),
    getRecentEnrollments(ctx.org.id, 5),
  ]);

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  const formattedSessions = upcomingSessions.map((session) => ({
    ...session,
    startDate: formatDate(session.startDate),
  }));

  const formattedEnrollments = recentEnrollments.map((enrollment) => ({
    ...enrollment,
    enrolledAt: formatDate(enrollment.enrolledAt),
  }));

  return {
    stats,
    upcomingSessions: formattedSessions,
    recentEnrollments: formattedEnrollments,
    orgName: ctx.org.name,
  };
}

export default function TrainingDashboardPage() {
  const { stats, upcomingSessions, recentEnrollments, orgName } =
    useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Training Dashboard</h1>
          <p className="text-gray-500">{orgName}</p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/app/training/import"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Import Courses
          </Link>
          <Link
            to="/app/training/courses"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Manage Courses
          </Link>
          <Link
            to="/app/training/sessions"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            View Sessions
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Courses"
          value={stats.activeCourses}
          icon="📚"
          linkTo="/app/training/courses"
        />
        <StatCard
          title="Upcoming Sessions"
          value={stats.upcomingSessions}
          icon="📅"
          linkTo="/app/training/sessions"
        />
        <StatCard
          title="Active Enrollments"
          value={stats.activeEnrollments}
          icon="👥"
          linkTo="/app/training/enrollments"
        />
        <StatCard
          title="Certifications This Month"
          value={stats.certificationsThisMonth}
          icon="🏅"
          linkTo="/app/training/enrollments?status=completed"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Upcoming Sessions */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Upcoming Training Sessions</h2>
          <div className="space-y-3">
            {upcomingSessions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No upcoming sessions scheduled
              </p>
            ) : (
              upcomingSessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/app/training/sessions/${session.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer no-underline text-inherit"
                >
                  <div>
                    <p className="font-medium">{session.courseName}</p>
                    <p className="text-sm text-gray-500">
                      {session.startDate}
                      {session.startTime ? ` at ${session.startTime}` : ""}
                    </p>
                    {session.location && (
                      <p className="text-xs text-gray-400">{session.location}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {session.enrolledCount}/{session.maxStudents || "~"}
                    </p>
                    <p className="text-sm text-gray-500">enrolled</p>
                    {session.agencyName && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {session.agencyName}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link
            to="/app/training/sessions"
            className="block text-center text-blue-600 mt-4 text-sm hover:underline"
          >
            View all sessions
          </Link>
        </div>

        {/* Recent Enrollments */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Recent Enrollments</h2>
          <div className="space-y-3">
            {recentEnrollments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No recent enrollments
              </p>
            ) : (
              recentEnrollments.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  to={`/app/training/enrollments/${enrollment.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer no-underline text-inherit"
                >
                  <div>
                    <p className="font-medium">
                      {enrollment.customerFirstName} {enrollment.customerLastName}
                    </p>
                    <p className="text-sm text-gray-500">{enrollment.courseName}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${getStatusStyle(
                        enrollment.status
                      )}`}
                    >
                      {enrollment.status}
                    </span>
                    {enrollment.enrolledAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        {enrollment.enrolledAt}
                      </p>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link
            to="/app/training/enrollments"
            className="block text-center text-blue-600 mt-4 text-sm hover:underline"
          >
            View all enrollments
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <Link
            to="/app/training/courses/new"
            className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-xl">+</span>
            <span>Create Course</span>
          </Link>
          <Link
            to="/app/training/sessions/new"
            className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-xl">+</span>
            <span>Schedule Session</span>
          </Link>
          <Link
            to="/app/training/enrollments/new"
            className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-xl">+</span>
            <span>New Enrollment</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  linkTo,
}: {
  title: string;
  value: string | number;
  icon: string;
  linkTo?: string;
}) {
  const content = (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-gray-500 text-sm">{title}</p>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="no-underline text-inherit">
        {content}
      </Link>
    );
  }

  return content;
}

function getStatusStyle(status: string | null): string {
  switch (status) {
    case "enrolled":
      return "bg-blue-100 text-blue-700";
    case "in_progress":
      return "bg-yellow-100 text-yellow-700";
    case "completed":
      return "bg-green-100 text-green-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "withdrawn":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}
