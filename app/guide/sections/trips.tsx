export default function TripsSection() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Trips &amp; Scheduling</h1>
      <p className="text-foreground-muted mb-6">
        Trips are the scheduled instances of your tours. While a tour defines the experience, a trip puts it on the calendar with a specific date, time, boat, and crew.
      </p>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/trips-list.png"
        alt="Trips list view"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Creating a Trip</h2>
      <p className="text-foreground-muted mb-4">
        Navigate to <strong>Trips &gt; New Trip</strong> and configure:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Tour</strong> &mdash; which tour template to use</li>
        <li><strong>Date</strong> &mdash; the trip date</li>
        <li><strong>Start / End Time</strong> &mdash; departure and return times</li>
        <li><strong>Boat</strong> &mdash; assign a vessel from your fleet</li>
        <li><strong>Capacity Override</strong> &mdash; optionally adjust max participants for this specific trip</li>
        <li><strong>Price Override</strong> &mdash; optionally set a different price for this trip</li>
        <li><strong>Staff</strong> &mdash; assign dive masters, instructors, or crew</li>
      </ul>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/trip-detail.png"
        alt="Trip detail view"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Trip Statuses</h2>
      <p className="text-foreground-muted mb-4">
        Each trip has a status that reflects its lifecycle:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Open</strong> &mdash; accepting bookings</li>
        <li><strong>Confirmed</strong> &mdash; has enough bookings and is confirmed to run</li>
        <li><strong>Full</strong> &mdash; capacity reached, no more bookings accepted</li>
        <li><strong>Completed</strong> &mdash; the trip has finished</li>
        <li><strong>Cancelled</strong> &mdash; the trip was cancelled</li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Recurring Trips</h2>
      <p className="text-foreground-muted mb-4">
        For regular schedules, create recurring trips. When creating a trip, enable the recurrence option and choose a pattern:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Daily</strong> &mdash; every day</li>
        <li><strong>Weekly</strong> &mdash; same day each week</li>
        <li><strong>Biweekly</strong> &mdash; every two weeks</li>
        <li><strong>Monthly</strong> &mdash; same date each month</li>
      </ul>
      <p className="text-foreground-muted mb-4">
        Set an end date for the recurrence and DiveStreams will generate all the individual trips automatically.
      </p>

      <div className="bg-brand-muted border-l-4 border-brand p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Tip</p>
        <p className="text-sm text-foreground-muted">
          Use recurring trips for your regular morning and afternoon dives. You can always edit or cancel individual trips in the series without affecting the others.
        </p>
      </div>

      <div className="bg-warning-muted border-l-4 border-warning p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Important</p>
        <p className="text-sm text-foreground-muted">
          Cancelling a trip will notify all booked customers by email. Make sure to update your customers if you need to reschedule instead.
        </p>
      </div>
    </div>
  );
}
