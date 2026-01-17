/**
 * Training Dashboard Route
 *
 * Main overview dashboard for the training module showing stats,
 * upcoming sessions, and recent enrollments.
 */

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import {
  getTrainingDashboardStats,
  getEnrollments,
  getCourseSessions,
} from "../../../../lib/db/training.server";

export const meta: MetaFunction = () => [
  { title: "Training - DiveStreams" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Check freemium access - training is a premium feature
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      stats: null,
      recentEnrollments: null,
      upcomingSessions: null,
    };
  }

  const [stats, enrollmentsData, sessions] = await Promise.all([
    getTrainingDashboardStats(ctx.org.id),
    getEnrollments(ctx.org.id, { limit: 5 }),
    getCourseSessions(ctx.org.id, { status: "scheduled" }),
  ]);

  // Filter to next 7 days
  const today = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcomingSessions = sessions
    .filter((s) => {
      const sessionDate = new Date(s.session.scheduledDate);
      return sessionDate >= today && sessionDate <= nextWeek;
    })
    .slice(0, 5);

  return {
    hasAccess: true,
    stats,
    recentEnrollments: enrollmentsData.enrollments,
    upcomingSessions,
  };
}

export default function TrainingDashboard() {
  const { hasAccess, stats, recentEnrollments, upcomingSessions } =
    useLoaderData<typeof loader>();

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">🎓</div>
        <h1 className="text-2xl font-bold mb-4">Training Module</h1>
        <p className="text-gray-600 mb-6">
          Manage dive certifications, courses, and student progress with the
          Training Module. Available on Premium plans.
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Training Dashboard</h1>
        <Link
          to="/app/training/courses/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Course
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Active Enrollments"
          value={stats?.activeEnrollments || 0}
          color="blue"
        />
        <StatCard
          title="Certified This Month"
          value={stats?.completedThisMonth || 0}
          color="green"
        />
        <StatCard
          title="Upcoming Sessions"
          value={stats?.upcomingSessions || 0}
          color="purple"
        />
        <StatCard
          title="Active Courses"
          value={stats?.availableCourses || 0}
          color="gray"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Enrollments */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold">Recent Enrollments</h2>
            <Link
              to="/app/training/enrollments"
              className="text-blue-600 text-sm hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="divide-y">
            {recentEnrollments && recentEnrollments.length > 0 ? (
              recentEnrollments.map((item) => (
                <Link
                  key={item.enrollment.id}
                  to={`/app/training/enrollments/${item.enrollment.id}`}
                  className="p-4 flex justify-between items-center hover:bg-gray-50 block"
                >
                  <div>
                    <div className="font-medium">
                      {item.customer?.firstName} {item.customer?.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.course?.name}
                    </div>
                  </div>
                  <StatusBadge status={item.enrollment.status} />
                </Link>
              ))
            ) : (
              <div className="p-4 text-gray-500 text-center">
                No enrollments yet
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold">Upcoming Sessions</h2>
            <Link
              to="/app/training/sessions"
              className="text-blue-600 text-sm hover:underline"
            >
              View Calendar
            </Link>
          </div>
          <div className="divide-y">
            {upcomingSessions && upcomingSessions.length > 0 ? (
              upcomingSessions.map((item) => (
                <Link
                  key={item.session.id}
                  to={`/app/training/sessions/${item.session.id}`}
                  className="p-4 flex justify-between items-center hover:bg-gray-50 block"
                >
                  <div>
                    <div className="font-medium">{item.course?.name}</div>
                    <div className="text-sm text-gray-500">
                      {item.session.sessionType} - {item.session.location || "TBD"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatDate(item.session.scheduledDate)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.session.startTime}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-4 text-gray-500 text-center">
                No upcoming sessions
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickLink href="/app/training/courses" icon="📚" label="Courses" />
        <QuickLink href="/app/training/sessions" icon="📅" label="Sessions" />
        <QuickLink href="/app/training/enrollments" icon="👥" label="Enrollments" />
        <QuickLink href="/app/training/settings/agencies" icon="⚙️" label="Settings" />
      </div>
    </div>
  );
}

// Helper Components

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: "blue" | "green" | "purple" | "gray";
}) {
  const colorClasses = {
    blue: "text-blue-600",
    green: "text-green-600",
    purple: "text-purple-600",
    gray: "text-gray-600",
  };

  return (
    <div className="bg-white p-6 rounded-lg border">
      <div className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</div>
      <div className="text-gray-600">{title}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusStyles: Record<string, string> = {
    certified: "bg-green-100 text-green-800",
    completed: "bg-green-100 text-green-800",
    in_progress: "bg-blue-100 text-blue-800",
    enrolled: "bg-blue-100 text-blue-800",
    scheduled: "bg-yellow-100 text-yellow-800",
    pending_scheduling: "bg-gray-100 text-gray-800",
    withdrawn: "bg-red-100 text-red-800",
  };

  const style = statusStyles[status] || "bg-gray-100 text-gray-800";

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      to={href}
      className="p-4 bg-white rounded-lg border text-center hover:bg-gray-50"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-medium">{label}</div>
    </Link>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
