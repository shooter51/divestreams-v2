export default function DashboardSection() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Dashboard</h1>
      <p className="text-foreground-muted mb-6">
        The dashboard is your daily command center. It gives you a snapshot of today&rsquo;s activity, upcoming trips, recent bookings, and key performance metrics.
      </p>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/dashboard.png"
        alt="Dashboard overview"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Stats Cards</h2>
      <p className="text-foreground-muted mb-4">
        At the top of the dashboard you&rsquo;ll see four summary cards:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Today&rsquo;s Bookings</strong> &mdash; number of bookings scheduled for today</li>
        <li><strong>Weekly Revenue</strong> &mdash; total revenue for the current week</li>
        <li><strong>Active Trips</strong> &mdash; trips currently open for booking</li>
        <li><strong>Total Customers</strong> &mdash; your entire customer base count</li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Upcoming Trips</h2>
      <p className="text-foreground-muted mb-4">
        The upcoming trips section lists your next scheduled trips with date, tour name, current bookings vs. capacity, and status. Click any trip to view its full details or manage bookings.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Recent Bookings</h2>
      <p className="text-foreground-muted mb-4">
        See the latest bookings as they come in, including customer name, trip, participant count, and payment status. This helps you stay on top of new reservations without navigating away from the dashboard.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Usage Overview</h2>
      <p className="text-foreground-muted mb-4">
        The usage overview shows your current subscription plan limits &mdash; how many tours, trips, and team members you&rsquo;ve used out of your plan allowance.
      </p>

      <div className="bg-brand-muted border-l-4 border-brand p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Tip</p>
        <p className="text-sm text-foreground-muted">
          Bookmark the dashboard as your browser homepage so you always start your day with a clear view of operations.
        </p>
      </div>
    </div>
  );
}
