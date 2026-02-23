# Reports Implementation Exploration

## Overview

Comprehensive reporting system for dive shop operations: revenue, bookings, customers, inventory, and staff performance.

---

## Current State

### Existing Data Sources (lib/db/schema.ts)

| Table | Report Metrics |
|-------|----------------|
| `bookings` | Booking count, revenue, participants, sources |
| `transactions` | Sales, refunds, payment methods |
| `customers` | New vs returning, lifetime value, demographics |
| `trips` | Capacity utilization, cancellations |
| `tours` | Popularity, revenue per tour |
| `boats` | Usage, maintenance costs |
| `equipment` | Rental frequency, revenue |
| `staff` | Assignments, tips, commissions |

### Existing Job Queue
`REPORT` queue defined in `/lib/jobs/index.ts` - can be used for scheduled report generation.

---

## Report Categories

### 1. Revenue Reports

| Report | Metrics | Filters |
|--------|---------|---------|
| Revenue Summary | Total revenue, refunds, net | Date range, payment method |
| Revenue by Tour | Revenue per tour type | Date range, tour |
| Revenue by Day/Week/Month | Time series revenue | Comparison period |
| Payment Method Breakdown | Cash vs card vs online | Date range |
| Refund Analysis | Refund rate, reasons | Date range |

### 2. Booking Reports

| Report | Metrics | Filters |
|--------|---------|---------|
| Booking Summary | Total bookings, avg value | Date range, status |
| Booking by Source | Website, widget, walk-in | Date range |
| Cancellation Rate | Cancel %, reasons | Date range |
| Capacity Utilization | Trips at capacity % | Date range, tour |
| Lead Time Analysis | Days before trip booked | Date range |

### 3. Customer Reports

| Report | Metrics | Filters |
|--------|---------|---------|
| New vs Returning | Customer acquisition | Date range |
| Customer Lifetime Value | Avg spend over time | Customer segment |
| Geographic Distribution | Customers by location | Date range |
| Certification Levels | Divers by cert level | Active/all |
| Customer Acquisition Cost | Marketing ROI | Channel |

### 4. Operations Reports

| Report | Metrics | Filters |
|--------|---------|---------|
| Trip Summary | Trips run, cancelled | Date range |
| Boat Utilization | Usage %, maintenance | Boat, date range |
| Equipment Rental | Items rented, revenue | Date range |
| Staff Performance | Trips led, tips, ratings | Staff, date range |
| Weather Impact | Cancellations by weather | Date range |

### 5. Financial Reports

| Report | Metrics | Filters |
|--------|---------|---------|
| Daily Cash Summary | Cash in/out, variance | Date |
| P&L Summary | Revenue - Costs | Date range |
| Tax Report | Taxable sales by rate | Date range, tax type |
| Commission Report | Staff commissions owed | Pay period |

---

## UI Design

### Reports Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Reports                                   [Export ▼] [🗓️]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Revenue     │ │ Bookings    │ │ Customers   │           │
│  │ $24,580     │ │ 156         │ │ 89 new      │           │
│  │ ↑ 12%       │ │ ↑ 8%        │ │ ↑ 15%       │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  Revenue Over Time                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ $8K ─────────────────────────────────────────────── │   │
│  │ $6K ─────────────────────────╭─╮───────────────── │   │
│  │ $4K ─────────────────╭─╮────╯ ╰─╮───────────── │   │
│  │ $2K ───────────╭─╮──╯ ╰───────╯ ╰──────── │   │
│  │ $0  ─────────────────────────────────────────────── │   │
│  │     Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Popular Reports                                            │
│  ├─ 📊 Revenue by Tour                                      │
│  ├─ 📅 Booking Trends                                       │
│  ├─ 👥 Customer Retention                                   │
│  └─ ⛵ Boat Utilization                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Individual Report View

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back   Revenue by Tour                                   │
│                                                             │
│  Date Range: [Last 30 Days ▼]   Compare to: [Previous ▼]   │
│                                                             │
│  ┌───────────────────┬──────────┬───────┬─────────────┐   │
│  │ Tour              │ Bookings │ Rev   │ Change      │   │
│  ├───────────────────┼──────────┼───────┼─────────────┤   │
│  │ Snorkeling Adv    │ 45       │ $4,050│ ↑ 15%       │   │
│  │ Scuba Discovery   │ 32       │ $4,800│ ↑ 8%        │   │
│  │ Night Dive        │ 18       │ $2,700│ ↓ 5%        │   │
│  │ Whale Shark Tour  │ 12       │ $3,600│ ↑ 25%       │   │
│  └───────────────────┴──────────┴───────┴─────────────┘   │
│                                                             │
│  [📥 Export CSV] [📄 Export PDF] [📧 Schedule Email]       │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Route Structure

```
/app/routes/tenant/reports/
├── index.tsx           # Reports dashboard
├── revenue.tsx         # Revenue reports
├── bookings.tsx        # Booking reports
├── customers.tsx       # Customer reports
├── operations.tsx      # Operations reports
├── financial.tsx       # Financial reports
└── export.tsx          # Export API
```

### Data Aggregation

```typescript
// Example: Revenue by Tour loader
export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, schema } = await requireTenantAuth(request);
  const url = new URL(request.url);

  const startDate = url.searchParams.get('start') || subDays(new Date(), 30);
  const endDate = url.searchParams.get('end') || new Date();

  const revenueByTour = await db
    .select({
      tourId: schema.tours.id,
      tourName: schema.tours.name,
      bookingCount: count(schema.bookings.id),
      totalRevenue: sum(schema.bookings.totalPrice),
      avgBookingValue: avg(schema.bookings.totalPrice),
    })
    .from(schema.bookings)
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(
      and(
        gte(schema.bookings.createdAt, startDate),
        lte(schema.bookings.createdAt, endDate),
        eq(schema.bookings.status, 'confirmed')
      )
    )
    .groupBy(schema.tours.id, schema.tours.name)
    .orderBy(desc(sum(schema.bookings.totalPrice)));

  return { revenueByTour, dateRange: { start: startDate, end: endDate } };
}
```

### Charting Library Options

#### Option A: Recharts (Recommended)
```bash
npm install recharts
```
- React-first, declarative API
- Good documentation
- Responsive out of the box

#### Option B: Chart.js + react-chartjs-2
```bash
npm install chart.js react-chartjs-2
```
- More chart types
- Canvas-based (better perf for large data)

#### Option C: Tremor
```bash
npm install @tremor/react
```
- Built for dashboards
- Beautiful defaults
- Tailwind-based

**Recommendation:** Recharts for simplicity, Tremor for polished look.

---

## Export Functionality

### Export Formats

| Format | Use Case | Library |
|--------|----------|---------|
| CSV | Spreadsheet import | Built-in |
| PDF | Formal reports | `@react-pdf/renderer` |
| Excel | Formatted data | `exceljs` |

### CSV Export
```typescript
// routes/tenant/reports/export.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, schema } = await requireTenantAuth(request);
  const url = new URL(request.url);

  const reportType = url.searchParams.get('type');
  const format = url.searchParams.get('format') || 'csv';

  const data = await generateReportData(reportType, tenant, schema);

  if (format === 'csv') {
    const csv = convertToCSV(data);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${reportType}-${Date.now()}.csv"`,
      },
    });
  }

  // PDF generation...
}
```

### PDF Generation
```typescript
import { Document, Page, Text, View } from '@react-pdf/renderer';

function RevenueReportPDF({ data, dateRange }) {
  return (
    <Document>
      <Page>
        <View>
          <Text>Revenue Report</Text>
          <Text>{dateRange.start} - {dateRange.end}</Text>
          {/* Table of data */}
        </View>
      </Page>
    </Document>
  );
}
```

---

## Scheduled Reports

### Schema Addition
```typescript
scheduledReports: pgTable('scheduled_reports', {
  id: uuid().primaryKey(),
  tenantId: uuid().references(() => tenants.id),
  reportType: varchar(50).notNull(),
  frequency: varchar(20).notNull(), // 'daily', 'weekly', 'monthly'
  dayOfWeek: integer(), // 0-6 for weekly
  dayOfMonth: integer(), // 1-31 for monthly
  time: time().default('08:00'),
  recipients: jsonb(), // array of email addresses
  format: varchar(10).default('pdf'),
  filters: jsonb(), // saved filter settings
  lastRunAt: timestamp(),
  nextRunAt: timestamp(),
  isActive: boolean().default(true),
});
```

### Job Queue Integration
```typescript
// lib/jobs/index.ts
import { Queue } from 'bullmq';

export const reportQueue = new Queue('report', { connection: redis });

// Scheduled job to check and run reports
await reportQueue.add('check-scheduled-reports', {}, {
  repeat: { cron: '0 * * * *' }, // Every hour
});

// Worker processes report generation
async function processScheduledReports() {
  const dueReports = await db.query.scheduledReports.findMany({
    where: and(
      eq(scheduledReports.isActive, true),
      lte(scheduledReports.nextRunAt, new Date())
    ),
  });

  for (const report of dueReports) {
    await generateAndEmailReport(report);
    await updateNextRunTime(report);
  }
}
```

---

## Dashboard Widgets

### Quick Stats Component
```tsx
function QuickStats({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        title="Revenue"
        value={formatCurrency(stats.revenue)}
        change={stats.revenueChange}
        trend={stats.revenueChange > 0 ? 'up' : 'down'}
      />
      <StatCard
        title="Bookings"
        value={stats.bookings}
        change={stats.bookingsChange}
      />
      <StatCard
        title="Customers"
        value={stats.newCustomers}
        subtitle="new this period"
      />
      <StatCard
        title="Capacity"
        value={`${stats.capacityUtilization}%`}
        subtitle="average utilization"
      />
    </div>
  );
}
```

---

## Implementation Priority

### Phase 1 (Core Reports)
1. Reports dashboard with summary stats
2. Revenue report (by date, by tour)
3. Booking report (count, trends)
4. CSV export

### Phase 2 (Enhanced)
1. Customer reports (new vs returning, LTV)
2. Operations reports (utilization)
3. Charts with Recharts
4. Date range picker with comparison

### Phase 3 (Advanced)
1. PDF export
2. Scheduled email reports
3. Financial reports (P&L, tax)
4. Custom report builder

### Phase 4 (Enterprise)
1. Real-time dashboard widgets
2. Multi-location roll-up
3. Benchmarking (vs industry averages)
4. Forecasting/predictions

---

## Dependencies

```bash
npm install recharts date-fns
# For PDF:
npm install @react-pdf/renderer
# For Excel:
npm install exceljs
```

## Estimated Effort

| Phase | Features | Effort |
|-------|----------|--------|
| Phase 1 | Core reports + CSV | 3-4 days |
| Phase 2 | Enhanced + charts | 3-4 days |
| Phase 3 | PDF + scheduled | 4-5 days |
| Phase 4 | Enterprise | 5-7 days |

---

## Questions to Resolve

1. Which reports are highest priority for MVP?
2. Charting library preference (Recharts vs Tremor)?
3. PDF export needed for Phase 1?
4. Scheduled reports priority?
5. Real-time dashboard updates needed?
