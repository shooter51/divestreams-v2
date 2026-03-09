import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../lib/require-feature.server";
import { PLAN_FEATURES } from "../../../../lib/plan-features";
import { formatLabel, formatTime, formatDisplayDate } from "../../../lib/format";
import { useT } from "../../../i18n/use-t";
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
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_TRAINING);

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
  const t = useT();

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("tenant.training.dashboard.title")}</h1>
          <p className="text-foreground-muted">{orgName}</p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/tenant/training/import"
            className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success-hover transition-colors"
          >
            {t("tenant.training.dashboard.importCourses")}
          </Link>
          <Link
            to="/tenant/training/courses"
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
          >
            {t("tenant.training.dashboard.manageCourses")}
          </Link>
          <Link
            to="/tenant/training/sessions"
            className="px-4 py-2 border border-brand text-brand rounded-lg hover:bg-brand-muted transition-colors"
          >
            {t("tenant.training.dashboard.viewSessions")}
          </Link>
          <Link
            to="/tenant/training/series"
            className="px-4 py-2 border border-brand text-brand rounded-lg hover:bg-brand-muted transition-colors"
          >
            {t("tenant.training.dashboard.viewSeries")}
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title={t("tenant.training.dashboard.activeCourses")}
          value={stats.activeCourses}
          icon="📚"
          linkTo="/tenant/training/courses"
        />
        <StatCard
          title={t("tenant.training.dashboard.upcomingSessions")}
          value={stats.upcomingSessions}
          icon="📅"
          linkTo="/tenant/training/sessions"
        />
        <StatCard
          title={t("tenant.training.dashboard.activeEnrollments")}
          value={stats.activeEnrollments}
          icon="👥"
          linkTo="/tenant/training/enrollments"
        />
        <StatCard
          title={t("tenant.training.dashboard.certificationsThisMonth")}
          value={stats.certificationsThisMonth}
          icon="🏅"
          linkTo="/tenant/training/enrollments?status=completed"
        />
        {stats.activeSeries !== undefined && (
          <StatCard
            title={t("tenant.training.dashboard.activeSeries")}
            value={stats.activeSeries}
            icon="📋"
            linkTo="/tenant/training/series"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Upcoming Sessions */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t("tenant.training.dashboard.upcomingTrainingSessions")}</h2>
          <div className="space-y-3">
            {upcomingSessions.length === 0 ? (
              <p className="text-foreground-muted text-center py-4">
                {t("tenant.training.dashboard.noUpcomingSessions")}
              </p>
            ) : (
              upcomingSessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/tenant/training/sessions/${session.id}`}
                  className="flex items-center justify-between p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay transition-colors cursor-pointer no-underline text-inherit"
                >
                  <div>
                    <p className="font-medium">{session.courseName}</p>
                    <p className="text-sm text-foreground-muted">
                      {session.startDate
                        ? new Date(session.startDate + "T00:00:00").toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        : ""}
                      {session.startTime ? ` at ${formatTime(session.startTime)}` : ""}
                    </p>
                    {session.location && (
                      <p className="text-xs text-foreground-subtle">{session.location}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {session.enrolledCount}/{session.maxStudents || "~"}
                    </p>
                    <p className="text-sm text-foreground-muted">{t("tenant.training.enrolled")}</p>
                    {session.agencyName && (
                      <span className="text-xs px-2 py-1 bg-brand-muted text-brand rounded-full">
                        {session.agencyName}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link
            to="/tenant/training/sessions"
            className="block text-center text-brand mt-4 text-sm hover:underline"
          >
            {t("tenant.training.dashboard.viewAllSessions")}
          </Link>
        </div>

        {/* Recent Enrollments */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">{t("tenant.training.dashboard.recentEnrollments")}</h2>
          <div className="space-y-3">
            {recentEnrollments.length === 0 ? (
              <p className="text-foreground-muted text-center py-4">
                {t("tenant.training.dashboard.noRecentEnrollments")}
              </p>
            ) : (
              recentEnrollments.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  to={`/tenant/training/enrollments/${enrollment.id}`}
                  className="flex items-center justify-between p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay transition-colors cursor-pointer no-underline text-inherit"
                >
                  <div>
                    <p className="font-medium">
                      {enrollment.customerFirstName} {enrollment.customerLastName}
                    </p>
                    <p className="text-sm text-foreground-muted">{enrollment.courseName}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${getStatusStyle(
                        enrollment.status
                      )}`}
                    >
                      {formatLabel(enrollment.status)}
                    </span>
                    {enrollment.enrolledAt && (
                      <p className="text-xs text-foreground-subtle mt-1">
                        {formatDisplayDate(enrollment.enrolledAt)}
                      </p>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link
            to="/tenant/training/enrollments"
            className="block text-center text-brand mt-4 text-sm hover:underline"
          >
            {t("tenant.training.dashboard.viewAllEnrollments")}
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-surface-raised rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">{t("common.quickActions")}</h2>
        <div className="flex gap-4">
          <Link
            to="/tenant/training/courses/new"
            className="flex items-center gap-2 px-4 py-3 bg-surface-inset rounded-lg hover:bg-surface-overlay transition-colors"
          >
            <span className="text-xl">+</span>
            <span>{t("tenant.training.courses.createCourse")}</span>
          </Link>
          <Link
            to="/tenant/training/sessions/new"
            className="flex items-center gap-2 px-4 py-3 bg-surface-inset rounded-lg hover:bg-surface-overlay transition-colors"
          >
            <span className="text-xl">+</span>
            <span>{t("tenant.training.sessions.scheduleSession")}</span>
          </Link>
          <Link
            to="/tenant/training/enrollments/new"
            className="flex items-center gap-2 px-4 py-3 bg-surface-inset rounded-lg hover:bg-surface-overlay transition-colors"
          >
            <span className="text-xl">+</span>
            <span>{t("tenant.training.enrollments.newEnrollment")}</span>
          </Link>
          <Link
            to="/tenant/training/series/new"
            className="flex items-center gap-2 px-4 py-3 bg-surface-inset rounded-lg hover:bg-surface-overlay transition-colors"
          >
            <span className="text-xl">+</span>
            <span>{t("tenant.training.series.createSeries")}</span>
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
    <div className="bg-surface-raised rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-foreground-muted text-sm">{title}</p>
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
      return "bg-brand-muted text-brand";
    case "in_progress":
      return "bg-warning-muted text-warning";
    case "completed":
      return "bg-success-muted text-success";
    case "cancelled":
      return "bg-danger-muted text-danger";
    case "withdrawn":
      return "bg-surface-inset text-foreground";
    default:
      return "bg-surface-inset text-foreground";
  }
}
