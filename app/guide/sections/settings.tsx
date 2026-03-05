export default function SettingsSection() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Settings</h1>
      <p className="text-foreground-muted mb-6">
        Configure your dive shop profile, manage your team, set up payment processing, and control integrations.
      </p>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/settings.png"
        alt="Settings page"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">General Settings</h2>
      <p className="text-foreground-muted mb-4">
        Update your shop name, contact details, address, and timezone. These details appear on booking confirmations and customer communications.
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Shop name</strong> &mdash; shown in the sidebar and on emails</li>
        <li><strong>Currency</strong> &mdash; used for all pricing and reports</li>
        <li><strong>Timezone</strong> &mdash; affects how trip times are displayed</li>
        <li><strong>Logo</strong> &mdash; appears on customer-facing pages</li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Team Management</h2>
      <p className="text-foreground-muted mb-4">
        Invite staff members and assign roles. DiveStreams supports three roles:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Owner</strong> &mdash; full access including billing and settings</li>
        <li><strong>Manager</strong> &mdash; can manage trips, bookings, and customers</li>
        <li><strong>Staff</strong> &mdash; view-only access to trips they are assigned to</li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Payments &amp; Stripe</h2>
      <p className="text-foreground-muted mb-4">
        Connect your Stripe account to accept card payments online. Once connected, customers can pay when booking through your public page. You can also record manual payments (cash, bank transfer) directly in DiveStreams.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Integrations</h2>
      <p className="text-foreground-muted mb-4">
        Connect external services to streamline your workflow:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Google Calendar</strong> &mdash; sync trips to your Google Calendar automatically</li>
        <li><strong>Zapier</strong> &mdash; connect DiveStreams to thousands of other apps</li>
      </ul>

      <div className="bg-warning-muted border-l-4 border-warning p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Important</p>
        <p className="text-sm text-foreground-muted">
          Only owners can access billing and settings. Make sure your account email is current — it is used for important account notifications.
        </p>
      </div>
    </div>
  );
}
