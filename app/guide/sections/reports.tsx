export default function ReportsSection() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Reports</h1>
      <p className="text-foreground-muted mb-6">
        Track your business performance with revenue summaries, booking analytics, customer insights, and equipment utilisation reports.
      </p>

      <img
        className="rounded-xl shadow-md border border-border-muted w-full my-4"
        src="/guide/screenshots/reports.png"
        alt="Reports overview"
      />

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Revenue Report</h2>
      <p className="text-foreground-muted mb-4">
        View total revenue, average booking value, and payment collection rates over any date range. Filter by tour type, payment status, or booking source to identify your most profitable activities.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Bookings Report</h2>
      <p className="text-foreground-muted mb-4">
        See booking volume trends, cancellation rates, and no-show rates. Understand when your peak booking windows are and which trips fill fastest.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Customer Report</h2>
      <p className="text-foreground-muted mb-4">
        Identify your top customers by total spend and dive count. Track new customer acquisition month over month and monitor repeat booking rates.
      </p>

      <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Equipment Utilisation</h2>
      <p className="text-foreground-muted mb-4">
        See which rental items are most in demand and calculate revenue per piece of equipment. Use this data to decide what gear to add or retire.
      </p>

      <div className="bg-brand-muted border-l-4 border-brand p-4 rounded-r-xl my-4">
        <p className="text-sm font-medium">Tip</p>
        <p className="text-sm text-foreground-muted">
          All reports can be exported to CSV for further analysis in Excel or Google Sheets.
        </p>
      </div>
    </div>
  );
}
