import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { requireTenant } from "../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => {
  return [{ title: "Dashboard - DiveStreams" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);

  // TODO: Fetch actual stats from tenant database
  return {
    stats: {
      todayBookings: 8,
      weekRevenue: 4250,
      activeTrips: 3,
      totalCustomers: 156,
    },
    upcomingTrips: [
      {
        id: "1",
        name: "Morning 2-Tank Dive",
        date: "Today",
        time: "8:00 AM",
        participants: 6,
        maxParticipants: 8,
      },
      {
        id: "2",
        name: "Sunset Dive",
        date: "Today",
        time: "4:00 PM",
        participants: 4,
        maxParticipants: 6,
      },
      {
        id: "3",
        name: "Discovery Snorkel",
        date: "Tomorrow",
        time: "9:00 AM",
        participants: 12,
        maxParticipants: 15,
      },
    ],
    recentBookings: [
      {
        id: "1",
        customer: "John Smith",
        trip: "Morning 2-Tank Dive",
        date: "2 hours ago",
        status: "confirmed",
        amount: 150,
      },
      {
        id: "2",
        customer: "Sarah Johnson",
        trip: "Sunset Dive",
        date: "5 hours ago",
        status: "pending",
        amount: 85,
      },
      {
        id: "3",
        customer: "Mike Wilson",
        trip: "Discovery Snorkel",
        date: "Yesterday",
        status: "confirmed",
        amount: 65,
      },
    ],
  };
}

export default function DashboardPage() {
  const { stats, upcomingTrips, recentBookings } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

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
              <div
                key={trip.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
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
              </div>
            ))}
          </div>
          <a
            href="/app/trips"
            className="block text-center text-blue-600 mt-4 text-sm hover:underline"
          >
            View all trips →
          </a>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Recent Bookings</h2>
          <div className="space-y-3">
            {recentBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
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
              </div>
            ))}
          </div>
          <a
            href="/app/bookings"
            className="block text-center text-blue-600 mt-4 text-sm hover:underline"
          >
            View all bookings →
          </a>
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
