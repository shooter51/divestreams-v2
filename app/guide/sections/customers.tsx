export default function CustomersSection() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Customers</h1>
      <p className="text-foreground-muted mb-6">
        The customers section stores profiles for everyone who books with your shop. Customer records are created automatically when someone books online, or you can add them manually.
      </p>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/customers-list.png"
        alt="Customers list view"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Customer Profiles</h2>
      <p className="text-foreground-muted mb-4">
        Each customer profile includes:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Contact Info</strong> &mdash; name, email, phone number</li>
        <li><strong>Certification Level</strong> &mdash; Open Water, Advanced, Rescue, Divemaster, etc.</li>
        <li><strong>Emergency Contact</strong> &mdash; name and phone number for emergencies</li>
        <li><strong>Booking History</strong> &mdash; all past and upcoming bookings</li>
        <li><strong>Total Spent</strong> &mdash; lifetime revenue from this customer</li>
      </ul>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/customer-detail.png"
        alt="Customer detail view"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Adding Customers</h2>
      <p className="text-foreground-muted mb-4">
        Click <strong>New Customer</strong> to manually create a profile. This is useful for walk-in customers or when entering historical data. When a customer books through your public site, their profile is created automatically.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Searching and Filtering</h2>
      <p className="text-foreground-muted mb-4">
        Use the search bar to find customers by name or email. The list shows key details at a glance including certification level and total bookings, making it easy to identify your regulars.
      </p>

      <div className="bg-brand-muted border-l-4 border-brand p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Tip</p>
        <p className="text-sm text-foreground-muted">
          Keep certification levels up to date. When creating bookings, DiveStreams uses certification info to help ensure divers are qualified for the selected tour.
        </p>
      </div>
    </div>
  );
}
