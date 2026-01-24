import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireOrgContext } from "../../../lib/auth/org-context.server";
import { db } from "../../../lib/db";
import { trips, bookings, customers, tours } from "../../../lib/db/schema";
import { eq, sql, and, gte, count, desc } from "drizzle-orm";
import { UpgradePrompt } from "../../components/ui/UpgradePrompt";

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

  // Get dashboard stats
  const [todayBookingsResult] = await db
    .select({ count: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.organizationId, ctx.org.id),
        gte(bookings.createdAt, today)
      )
    );

  const [totalCustomersResult] = await db
    .select({ count: count() })
    .from(customers)
    .where(eq(customers.organizationId, ctx.org.id));

  const [activeTripsResult] = await db
    .select({ count: count() })
    .from(trips)
    .where(
      and(
        eq(trips.organizationId, ctx.org.id),
        eq(trips.status, "scheduled")
      )
    );

  // Get week revenue (sum of bookings this week)
  const [weekRevenueResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${bookings.total}), 0)` })
    .from(bookings)
    .where(
      and(
        eq(bookings.organizationId, ctx.org.id),
        gte(bookings.createdAt, startOfWeek)
      )
    );

  const stats = {
    todayBookings: todayBookingsResult?.count || 0,
    weekRevenue: Number(weekRevenueResult?.total || 0),
    activeTrips: activeTripsResult?.count || 0,
    totalCustomers: totalCustomersResult?.count || 0,
  };

  // Get upcoming trips with tour info
  const upcomingTripsRaw = await db
    .select({
      id: trips.id,
      date: trips.date,
      startTime: trips.startTime,
      maxParticipants: trips.maxParticipants,
      tourName: tours.name,
    })
    .from(trips)
    .innerJoin(tours, eq(trips.tourId, tours.id))
    .where(
      and(
        eq(trips.organizationId, ctx.org.id),
        gte(trips.date, today.toISOString().split("T")[0])
      )
    )
    .orderBy(trips.date, trips.startTime)
    .limit(5);

  // Get booking counts for each trip
  const tripIds = upcomingTripsRaw.map(t => t.id);
  const bookingCounts = tripIds.length > 0 ? await db
    .select({
      tripId: bookings.tripId,
      count: sql<number>`SUM(${bookings.participants})`,
    })
    .from(bookings)
    .where(sql`${bookings.tripId} IN ${tripIds}`)
    .groupBy(bookings.tripId) : [];

  const bookingCountMap = new Map(bookingCounts.map(b => [b.tripId, Number(b.count) || 0]));

  const upcomingTrips = upcomingTripsRaw.map(trip => ({
    id: trip.id,
    name: trip.tourName,
    date: trip.date,
    time: trip.startTime,
    participants: bookingCountMap.get(trip.id) || 0,
    maxParticipants: trip.maxParticipants || 0,
  }));

  // Get recent bookings with customer and trip info
  const recentBookingsRaw = await db
    .select({
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
    .limit(5);

  const recentBookings = recentBookingsRaw.map(b => ({
    id: b.id,
    customer: `${b.customerFirstName} ${b.customerLastName}`,
    trip: b.tourName,
    amount: Number(b.total || 0).toFixed(2),
    status: b.status,
    date: b.tripDate,
  }));

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // Format dates in trips and bookings
  const formattedTrips = upcomingTrips.map((trip) => ({
    ...trip,
    date: formatDate(trip.date),
  }));

  const formattedBookings = recentBookings.map((booking) => ({
    ...booking,
    date: formatDate(booking.date),
  }));

  return {
    stats,
    upcomingTrips: formattedTrips,
    recentBookings: formattedBookings,
    subscription: ctx.subscription,
    limits: ctx.limits,
    usage: ctx.usage,
    isPremium: ctx.isPremium,
    orgName: ctx.org.name,
  };
}

export default function DashboardPage() {
  const { stats, upcomingTrips, recentBookings, subscription, limits, usage, isPremium, orgName } = useLoaderData<typeof loader>();

  // Calculate usage percentages - using correct property names from TierLimits and OrgUsage
  const bookingsUsagePercent = limits.bookingsPerMonth > 0
    ? Math.round((usage.bookingsThisMonth / limits.bookingsPerMonth) * 100)
    : 0;
  const customersUsagePercent = limits.customers > 0
    ? Math.round((usage.customers / limits.customers) * 100)
    : 0;

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500">{orgName}</p>
        </div>

        {/* Subscription Status */}
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              subscription?.status === "active"
                ? "bg-green-100 text-green-700"
                : subscription?.status === "trialing"
                ? "bg-blue-100 text-blue-700"
                : "bg-yellow-100 text-yellow-700"
            }`}>
              {subscription?.plan || "free"} - {subscription?.status || "active"}
            </span>
          </div>
          {!isPremium && (
            <Link to="/tenant/settings/billing" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
              Upgrade for more features
            </Link>
          )}
        </div>
      </div>

      {/* Free Tier Usage Warning */}
      {!isPremium && (bookingsUsagePercent > 80 || customersUsagePercent > 80) && (
        <div className="mb-6">
          <UpgradePrompt feature="higher limits" />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard title="Today's Bookings" value={stats.todayBookings} icon="📅" />
        <StatCard
          title="This Week's Revenue"
          value={`$${stats.weekRevenue.toLocaleString()}`}
          icon="💰"
        />
        <StatCard title="Active Trips" value={stats.activeTrips} icon="🚤" />
        <StatCard title="Total Customers" value={stats.totalCustomers} icon="👥" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Upcoming Trips */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Upcoming Trips</h2>
          <div className="space-y-3">
            {upcomingTrips.map((trip) => (
              <Link
                key={trip.id}
                to={`/app/trips/${trip.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer no-underline text-inherit"
              >
                <div>
                  <p className="font-medium">{trip.name}</p>
                  <p className="text-sm text-gray-500">
                    {trip.date} at {trip.time}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {trip.participants}/{trip.maxParticipants}
                  </p>
                  <p className="text-sm text-gray-500">participants</p>
                </div>
              </Link>
            ))}
          </div>
          <Link
            to="/tenant/trips"
            className="block text-center text-blue-600 mt-4 text-sm hover:underline"
          >
            View all trips →
          </Link>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Recent Bookings</h2>
          <div className="space-y-3">
            {recentBookings.map((booking) => (
              <Link
                key={booking.id}
                to={`/app/bookings/${booking.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer no-underline text-inherit"
              >
                <div>
                  <p className="font-medium">{booking.customer}</p>
                  <p className="text-sm text-gray-500">{booking.trip}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${booking.amount}</p>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      booking.status === "confirmed"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
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
            className="block text-center text-blue-600 mt-4 text-sm hover:underline"
          >
            View all bookings →
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
}: {
  title: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-gray-500 text-sm">{title}</p>
    </div>
  );
}
