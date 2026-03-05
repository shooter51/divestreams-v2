export default function EquipmentSection() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Equipment</h1>
      <p className="text-foreground-muted mb-6">
        Track your rental gear inventory, monitor equipment condition, manage rental pricing, and keep service records up to date.
      </p>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/equipment-list.png"
        alt="Equipment inventory list"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Adding Equipment</h2>
      <p className="text-foreground-muted mb-4">
        Click <strong>New Equipment</strong> to add gear to your inventory. For each item, specify:
      </p>
      <ul className="list-disc list-inside text-foreground-muted space-y-1 mb-4">
        <li><strong>Name</strong> &mdash; item description (e.g., &ldquo;BCD - Large&rdquo;)</li>
        <li><strong>Category</strong> &mdash; BCD, regulator, wetsuit, mask, fins, tank, etc.</li>
        <li><strong>Condition</strong> &mdash; new, good, fair, or needs service</li>
        <li><strong>Rental Price</strong> &mdash; daily rental rate</li>
        <li><strong>Last Service Date</strong> &mdash; when the item was last inspected or serviced</li>
        <li><strong>Next Service Date</strong> &mdash; when the next service is due</li>
      </ul>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Condition Tracking</h2>
      <p className="text-foreground-muted mb-4">
        Keep condition ratings current. Items marked as &ldquo;needs service&rdquo; are flagged in the inventory list so you can prioritize maintenance. Regular condition updates help prevent gear failures and ensure customer safety.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Rentals</h2>
      <p className="text-foreground-muted mb-4">
        The <strong>Rentals</strong> tab shows currently rented items, who has them, and when they&rsquo;re due back. This helps you track gear that&rsquo;s out with customers and plan availability for upcoming trips.
      </p>

      <div className="bg-warning-muted border-l-4 border-warning p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Important</p>
        <p className="text-sm text-foreground-muted">
          Keep service dates accurate. Regulators and BCDs require annual service for safety. DiveStreams will flag items approaching their service due date.
        </p>
      </div>
    </div>
  );
}
