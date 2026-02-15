import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useSearchParams, useNavigate } from "react-router";
import { requireOrgContext } from "../../../lib/auth/org-context.server";
import { db } from "../../../lib/db";
import { trips, bookings, customers, tours } from "../../../lib/db/schema";
import { eq, sql, and, gte, count, desc } from "drizzle-orm";
import { UpgradePrompt } from "../../components/ui/UpgradePrompt";
import { LIMIT_LABELS, DEFAULT_PLAN_LIMITS, FEATURE_LABELS, type PlanLimits } from "../../../lib/plan-features";
import { getUsage, checkAllLimits, type UsageStats, type LimitCheck } from "../../../lib/usage.server";


export const meta: MetaFunction = () => {
  return [{ title: "Dashboard - DiveStreams" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  // Helper to safely run a query and return a default on failure
  async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      console.error("Dashboard query failed:", error);
      return fallback;
    }
  }

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // Run all dashboard queries in parallel with error resilience
  const [
    todayBookingsResult,
    totalCustomersResult,
    activeTripsResult,
    weekRevenueResult,
    upcomingTripsRaw,
    recentBookingsRaw,
    usage,
  ] = await Promise.all([
    safeQuery(
      () => db.select({ count: count() }).from(bookings).where(
        and(eq(bookings.organizationId, ctx.org.id), gte(bookings.createdAt, today))
      ).then(r => r[0]),
      { count: 0 }
    ),
    safeQuery(
      () => db.select({ count: count() }).from(customers).where(
        eq(customers.organizationId, ctx.org.id)
      ).then(r => r[0]),
      { count: 0 }
    ),
    safeQuery(
      () => db.select({ count: count() }).from(trips).where(
        and(eq(trips.organizationId, ctx.org.id), eq(trips.status, "scheduled"))
      ).then(r => r[0]),
      { count: 0 }
    ),
    safeQuery(
      () => db.select({ total: sql<number>`COALESCE(SUM(${bookings.total}), 0)` }).from(bookings).where(
        and(eq(bookings.organizationId, ctx.org.id), gte(bookings.createdAt, startOfWeek))
      ).then(r => r[0]),
      { total: 0 }
    ),
    safeQuery(
      () => db.select({
        id: trips.id,
        date: trips.date,
        startTime: trips.startTime,
        maxParticipants: trips.maxParticipants,
        tourName: tours.name,
      })
      .from(trips)
      .innerJoin(tours, eq(trips.tourId, tours.id))
      .where(and(eq(trips.organizationId, ctx.org.id), gte(trips.date, today.toISOString().split("T")[0])))
      .orderBy(trips.date, trips.startTime)
      .limit(5),
      [] as { id: string; date: string | null; startTime: string | null; maxParticipants: number | null; tourName: string }[]
    ),
    safeQuery(
      () => db.select({
        id: bookings.id,
        total: bookings.total,
        status: bookings.status,
        createdAt: bookings.createdAt,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        tourName: tours.name,
        tripDate: trips.date,
      })
      .from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .innerJoin(trips, eq(bookings.tripId, trips.id))
      .innerJoin(tours, eq(trips.tourId, tours.id))
      .where(eq(bookings.organizationId, ctx.org.id))
      .orderBy(desc(bookings.createdAt))
      .limit(5),
      [] as { id: string; total: string | null; status: string; createdAt: Date | null; customerFirstName: string; customerLastName: string; tourName: string; tripDate: string | null }[]
    ),
    safeQuery(
      () => getUsage(ctx.org.id),
      { users: 0, customers: 0, toursPerMonth: 0, storageGb: 0 } as UsageStats
    ),
  ]);

  const stats = {
    todayBookings: todayBookingsResult?.count || 0,
    weekRevenue: Number(weekRevenueResult?.total || 0),
    activeTrips: activeTripsResult?.count || 0,
    totalCustomers: totalCustomersResult?.count || 0,
  };

  // Get booking counts for upcoming trips (batch query)
  const tripIds = upcomingTripsRaw.map(t => t.id);
  const bookingCounts = await safeQuery(
    () => tripIds.length > 0
      ? db.select({
          tripId: bookings.tripId,
          count: sql<number>`SUM(${bookings.participants})`,
        })
        .from(bookings)
        .where(sql`${bookings.tripId} IN ${tripIds}`)
        .groupBy(bookings.tripId)
      : Promise.resolve([]),
    [] as { tripId: string | null; count: number }[]
  );

  const bookingCountMap = new Map(bookingCounts.map(b => [b.tripId, Number(b.count) || 0]));

  const formattedTrips = upcomingTripsRaw.map(trip => ({
    id: trip.id,
    name: trip.tourName,
    date: formatDate(trip.date),
    time: trip.startTime,
    participants: bookingCountMap.get(trip.id) || 0,
    maxParticipants: trip.maxParticipants || 0,
  }));

  const recentBookings = recentBookingsRaw.map(b => ({
    id: b.id,
    customer: `${b.customerFirstName} ${b.customerLastName}`,
    trip: b.tourName,
    amount: Number(b.total || 0).toFixed(2),
    status: b.status,
    date: formatDate(b.tripDate),
  }));

  // Format dates in trips and bookings
  const formattedTrips = upcomingTrips.map((trip) => ({
    ...trip,
    date: formatDate(trip.date),
  }));

  const formattedBookings = recentBookings.map((booking) => ({
    ...booking,
    date: formatDate(booking.date),
  }));

  // Get plan limits from subscription plan details or use defaults
  const planLimits = ctx.subscription?.planDetails?.limits ?? DEFAULT_PLAN_LIMITS.free;

  // Calculate limit checks using centralized function
  const limitChecks = checkAllLimits(usage, planLimits);

  return {
    stats,
    upcomingTrips: formattedTrips,
    recentBookings: formattedBookings,
    subscription: ctx.subscription,
    usage,
    planLimits,
    limitChecks,
    planName: ctx.subscription?.planDetails?.displayName ?? ctx.subscription?.plan ?? "Free",
    isPremium: ctx.isPremium,
    orgName: ctx.org.name,
  };
}

export default function DashboardPage() {
  const {
    stats,
    upcomingTrips,
    recentBookings,
    subscription,
    usage,
    planLimits,
    limitChecks,
    planName,
    isPremium,
    orgName
  } = useLoaderData<typeof loader>();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Handle upgrade modal from query params
  const upgradeParam = searchParams.get("upgrade");
  const limitExceededParam = searchParams.get("limit_exceeded");
  const showUpgradeModal = !!(upgradeParam || limitExceededParam);

  const closeUpgradeModal = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("upgrade");
    newParams.delete("limit_exceeded");
    navigate({ search: newParams.toString() }, { replace: true });
  };

  // Check if any limit is approaching warning threshold (using pre-calculated limitChecks)
  const hasWarning = Object.values(limitChecks).some(check => check.warning || !check.allowed);

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-foreground-muted">{orgName}</p>
        </div>

        {/* Subscription Status */}
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              subscription?.status === "active"
                ? "bg-success-muted text-success"
                : subscription?.status === "trialing"
                ? "bg-brand-muted text-brand"
                : "bg-warning-muted text-warning"
            }`}>
              {subscription?.plan || "free"} - {subscription?.status || "active"}
            </span>
          </div>
          {!isPremium && (
            <Link to="/tenant/settings/billing" className="text-sm text-brand hover:underline mt-1 inline-block">
              Upgrade for more features
            </Link>
          )}
        </div>
      </div>

      {/* Free Tier Usage Warning */}
      {!isPremium && hasWarning && (
        <div className="mb-6">
          <UpgradePrompt feature="higher limits" />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard title="Today's Bookings" value={stats.todayBookings} icon="calendar" />
        <StatCard
          title="This Week's Revenue"
          value={`$${stats.weekRevenue.toLocaleString()}`}
          icon="dollar"
        />
        <StatCard title="Active Trips" value={stats.activeTrips} icon="boat" />
        <StatCard title="Total Customers" value={stats.totalCustomers} icon="users" />
      </div>

      {/* Usage Card */}
      <UsageCard
        planName={planName}
        limitChecks={limitChecks}
        usage={usage}
        planLimits={planLimits}
        isPremium={isPremium}
        hasWarning={hasWarning}
      />

      <div className="grid grid-cols-2 gap-6">
        {/* Upcoming Trips */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Upcoming Trips</h2>
          <div className="space-y-3">
            {upcomingTrips.map((trip) => (
              <Link
                key={trip.id}
                to={`/tenant/trips/${trip.id}`}
                className="flex items-center justify-between p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay transition-colors cursor-pointer no-underline text-inherit"
              >
                <div>
                  <p className="font-medium">{trip.name}</p>
                  <p className="text-sm text-foreground-muted">
                    {trip.date} at {trip.time}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {trip.participants}/{trip.maxParticipants}
                  </p>
                  <p className="text-sm text-foreground-muted">participants</p>
                </div>
              </Link>
            ))}
          </div>
          <Link
            to="/tenant/trips"
            className="block text-center text-brand mt-4 text-sm hover:underline"
          >
            View all trips →
          </Link>
        </div>

        {/* Recent Bookings */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Recent Bookings</h2>
          <div className="space-y-3">
            {recentBookings.map((booking) => (
              <Link
                key={booking.id}
                to={`/tenant/bookings/${booking.id}`}
                className="flex items-center justify-between p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay transition-colors cursor-pointer no-underline text-inherit"
              >
                <div>
                  <p className="font-medium">{booking.customer}</p>
                  <p className="text-sm text-foreground-muted">{booking.trip}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${booking.amount}</p>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      booking.status === "confirmed"
                        ? "bg-success-muted text-success"
                        : "bg-warning-muted text-warning"
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <Link
            to="/tenant/bookings"
            className="block text-center text-brand mt-4 text-sm hover:underline"
          >
            View all bookings →
          </Link>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={closeUpgradeModal}
          limitExceeded={limitExceededParam}
          feature={upgradeParam}
        />
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: string;
}) {
  const iconMap: Record<string, React.ReactNode> = {
    calendar: (
      <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    dollar: (
      <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    boat: (
      <svg className="w-6 h-6 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15l9-9 9 9M12 3v18" />
      </svg>
    ),
    users: (
      <svg className="w-6 h-6 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
  };

  return (
    <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        {iconMap[icon] || <span className="text-2xl">{icon}</span>}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-foreground-muted text-sm">{title}</p>
    </div>
  );
}

interface UsageCardProps {
  planName: string;
  limitChecks: Record<keyof UsageStats, LimitCheck>;
  usage: UsageStats;
  planLimits: PlanLimits;
  isPremium: boolean;
  hasWarning: boolean;
}

function UsageCard({ planName, limitChecks, usage, planLimits, isPremium, hasWarning }: UsageCardProps) {
  const usageItems: Array<{
    key: keyof typeof LIMIT_LABELS;
    label: string;
    current: number;
    limit: number;
    check: LimitCheck;
    unit?: string;
  }> = [
    { key: "users", label: LIMIT_LABELS.users, current: usage.users, limit: planLimits.users, check: limitChecks.users },
    { key: "customers", label: LIMIT_LABELS.customers, current: usage.customers, limit: planLimits.customers, check: limitChecks.customers },
    { key: "toursPerMonth", label: LIMIT_LABELS.toursPerMonth, current: usage.toursPerMonth, limit: planLimits.toursPerMonth, check: limitChecks.toursPerMonth },
    { key: "storageGb", label: LIMIT_LABELS.storageGb, current: usage.storageGb, limit: planLimits.storageGb, check: limitChecks.storageGb, unit: "GB" },
  ];

  return (
    <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Usage Overview</h2>
          <p className="text-sm text-foreground-muted">Current plan: <span className="font-medium text-foreground">{planName}</span></p>
        </div>
        {hasWarning && !isPremium && (
          <Link
            to="/tenant/settings/billing"
            className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-hover transition-colors"
          >
            Upgrade Plan
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {usageItems.map((item) => (
          <UsageItem
            key={item.key}
            label={item.label}
            current={item.current}
            limit={item.limit}
            check={item.check}
            unit={item.unit}
          />
        ))}
      </div>
    </div>
  );
}

interface UsageItemProps {
  label: string;
  current: number;
  limit: number;
  check: LimitCheck;
  unit?: string;
}

function UsageItem({ label, current, limit, check, unit }: UsageItemProps) {
  const isUnlimited = limit === -1;
  const isOverLimit = !check.allowed;
  const isWarning = check.warning;

  // Determine progress bar color
  let progressColor = "bg-brand";
  if (isOverLimit) {
    progressColor = "bg-danger";
  } else if (isWarning) {
    progressColor = "bg-warning";
  }

  // Determine text color for the count
  let textColor = "text-foreground";
  if (isOverLimit) {
    textColor = "text-danger";
  } else if (isWarning) {
    textColor = "text-warning";
  }

  const formatValue = (val: number) => {
    if (unit === "GB") {
      return val.toFixed(1);
    }
    return val.toLocaleString();
  };

  return (
    <div className="p-3 bg-surface-inset rounded-lg">
      <p className="text-sm text-foreground-muted mb-1">{label}</p>
      <p className={`text-lg font-semibold ${textColor}`}>
        {formatValue(current)} / {isUnlimited ? <span className="text-xl">&#8734;</span> : formatValue(limit)}
        {unit && <span className="text-sm font-normal text-foreground-muted ml-1">{unit}</span>}
      </p>

      {/* Progress bar */}
      {!isUnlimited && (
        <div className="mt-2">
          <div
            className="w-full h-2 bg-surface-overlay rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={check.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label}: ${check.percent}% used`}
          >
            <div
              className={`h-full ${progressColor} transition-all duration-300`}
              style={{ width: `${Math.min(check.percent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-foreground-muted mt-1">
            {check.percent}% used
            {check.remaining > 0 && ` - ${check.remaining} remaining`}
          </p>
        </div>
      )}

      {isUnlimited && (
        <p className="text-xs text-success mt-2">Unlimited</p>
      )}
    </div>
  );
}

interface UpgradeModalProps {
  onClose: () => void;
  limitExceeded: string | null;
  feature: string | null;
}

function UpgradeModal({ onClose, limitExceeded, feature }: UpgradeModalProps) {
  const limitLabels: Record<string, string> = {
    users: "team members",
    customers: "customers",
    toursPerMonth: "tours this month",
    storageGb: "storage",
  };

  // Get feature label from centralized FEATURE_LABELS, with fallback formatting
  const getFeatureLabel = (featureKey: string): string => {
    // Check centralized FEATURE_LABELS first
    if (featureKey in FEATURE_LABELS) {
      return FEATURE_LABELS[featureKey as keyof typeof FEATURE_LABELS];
    }
    // Fallback: format snake_case or kebab-case to Title Case
    return featureKey
      .replace(/^has_/, "")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const title = limitExceeded
    ? `${limitLabels[limitExceeded] || limitExceeded} Limit Reached`
    : feature
      ? `Upgrade to Access ${getFeatureLabel(feature)}`
      : "Upgrade Your Plan";

  const description = limitExceeded
    ? `You've reached the maximum number of ${limitLabels[limitExceeded] || limitExceeded} for your current plan. Upgrade to get more.`
    : feature
      ? `The ${getFeatureLabel(feature)} feature requires a higher tier plan.`
      : "Unlock more features and higher limits with an upgraded plan.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-raised rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-foreground-subtle hover:text-foreground-muted"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-brand-muted rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
          <p className="text-foreground-muted mb-6">{description}</p>

          <div className="space-y-3">
            <Link
              to="/tenant/settings/billing"
              className="block w-full px-4 py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand-hover transition-colors"
            >
              View Upgrade Options
            </Link>
            <button
              onClick={onClose}
              className="block w-full px-4 py-3 text-foreground-muted font-medium rounded-lg hover:bg-surface-overlay transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
