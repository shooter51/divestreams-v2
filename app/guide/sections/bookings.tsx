export default function BookingsSection() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Bookings</h1>
      <p className="text-foreground-muted mb-6">
        The bookings section is where you manage all customer reservations. Bookings can be created by customers through your public site or booking widget, or manually by your staff.
      </p>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/bookings-list.png"
        alt="Bookings list view"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Creating a Booking</h2>
      <p className="text-foreground-muted mb-4">
        To create a booking manually, click <strong>New Booking</strong> and fill in:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Trip</strong> &mdash; select from upcoming open trips</li>
        <li><strong>Customer</strong> &mdash; choose an existing customer or create a new one</li>
        <li><strong>Number of Participants</strong> &mdash; how many people in this booking</li>
        <li><strong>Special Requests</strong> &mdash; dietary needs, equipment preferences, etc.</li>
      </ul>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/booking-detail.png"
        alt="Booking detail view"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Payment Tracking</h2>
      <p className="text-foreground-muted mb-4">
        Each booking tracks its payment status. If you&rsquo;ve connected Stripe, online payments are recorded automatically. For walk-in or cash payments, you can update the payment status manually from the booking detail page.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Managing Bookings</h2>
      <p className="text-foreground-muted mb-4">
        From the bookings list, you can filter by date range, trip, or payment status. Click any booking to view full details, edit participant info, or update payment status. You can also cancel a booking from the detail view.
      </p>

      <div className="bg-brand-muted border-l-4 border-brand p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Tip</p>
        <p className="text-sm text-foreground-muted">
          Use the special requests field to note important information like certification levels, medical conditions, or pickup locations. This info is visible to your staff when preparing for the trip.
        </p>
      </div>
    </div>
  );
}
