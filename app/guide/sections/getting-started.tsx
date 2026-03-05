export default function GettingStarted() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Getting Started</h1>
      <p className="text-foreground-muted mb-6">
        Welcome to DiveStreams! This guide walks you through setting up your dive shop, creating your first tour, and taking your first booking.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">1. Complete Your Shop Profile</h2>
      <p className="text-foreground-muted mb-4">
        Head to <strong>Settings &gt; General</strong> to fill in your shop name, address, phone number, timezone, and currency. This information appears on your public booking site and customer communications.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">2. Invite Your Team</h2>
      <p className="text-foreground-muted mb-4">
        Go to <strong>Settings &gt; Team</strong> and invite staff members by email. Each team member gets their own login. You can assign roles like admin, instructor, or staff to control what they can access.
      </p>

      <div className="bg-brand-muted border-l-4 border-brand p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Tip</p>
        <p className="text-sm text-foreground-muted">
          Instructors can be assigned to trips and training sessions. Make sure to invite all your dive masters and instructors early.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">3. Create Your First Tour</h2>
      <p className="text-foreground-muted mb-4">
        Tours are templates for the dive experiences you offer. Navigate to <strong>Tours</strong> and click <strong>New Tour</strong>. Enter the tour name, type (single dive, multi-dive, course, snorkel, etc.), price, duration, max participants, and what&rsquo;s included. You can also attach dive sites and upload photos.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">4. Schedule a Trip</h2>
      <p className="text-foreground-muted mb-4">
        Trips are scheduled instances of your tours. Go to <strong>Trips</strong>, click <strong>New Trip</strong>, select a tour, pick a date and time, assign a boat and staff, and set the capacity. You can also create recurring trips for regular schedules.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">5. Connect Stripe for Payments</h2>
      <p className="text-foreground-muted mb-4">
        To accept online payments, go to <strong>Settings &gt; Integrations</strong> and connect your Stripe account. Once connected, customers can pay when booking through your public site or embedded widget.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">6. Enable Your Public Site</h2>
      <p className="text-foreground-muted mb-4">
        DiveStreams gives you a customer-facing website at your subdomain (e.g., <code className="bg-surface-inset px-1.5 py-0.5 rounded text-sm">yourshop.divestreams.com</code>). Go to <strong>Settings &gt; Public Site</strong> to customize the appearance, add content, and enable online bookings.
      </p>

      <div className="bg-brand-muted border-l-4 border-brand p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Tip</p>
        <p className="text-sm text-foreground-muted">
          You can also embed a booking widget on your existing website using the code from <strong>Settings &gt; Booking Widget</strong>.
        </p>
      </div>
    </div>
  );
}
