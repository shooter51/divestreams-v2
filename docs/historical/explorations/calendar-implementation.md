# Calendar Implementation Exploration

## Current State

### Existing Code
`/app/routes/tenant/calendar.tsx` - **Placeholder only**:
```tsx
export default function CalendarPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Calendar</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm min-h-[500px]">
        <p className="text-gray-500">Calendar view coming soon...</p>
      </div>
    </div>
  );
}
```

### Related Data
The `trips` table already has calendar-relevant fields:
- `date` - Trip date
- `startTime` / `endTime` - Time slots
- `status` - scheduled, in_progress, completed, cancelled
- `maxParticipants` / bookings count
- `tourId` / `boatId` - Associated resources

---

## Calendar Features

### 1. Monthly/Weekly/Daily Views

**Views Needed:**
| View | Use Case |
|------|----------|
| Month | Overview of trip schedule, capacity at a glance |
| Week | Detailed scheduling, staff assignment |
| Day | Individual trip management, check-ins |
| Resource | Boat/guide availability by resource |

### 2. Visual Elements

- **Color coding** by tour type or status
- **Capacity indicators** (full, available, low availability)
- **Drag-and-drop** trip rescheduling
- **Quick-add** trip from calendar click
- **Tooltip** with trip details on hover

### 3. Filtering & Controls

- Filter by: tour type, boat, guide, status
- Date range navigation
- Today button
- Search trips

---

## Library Options

### Option A: FullCalendar (Recommended)
```bash
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

**Pros:**
- Feature-complete (month/week/day/resource views)
- Drag-and-drop built-in
- Large community, well documented
- Free for basic features

**Cons:**
- Premium features require license ($499/year)
- Large bundle size (~150KB gzipped)

### Option B: React Big Calendar
```bash
npm install react-big-calendar
```

**Pros:**
- Fully open source
- Lighter weight (~50KB)
- Good customization

**Cons:**
- Less polished UX
- Fewer built-in features
- More custom work needed

### Option C: Custom with date-fns
Build from scratch using CSS Grid + date-fns.

**Pros:**
- Complete control
- Minimal bundle size
- Matches exact design needs

**Cons:**
- Significant development time
- Must implement all interactions

**Recommendation:** FullCalendar for fastest delivery with best UX.

---

## Implementation Design

### Data Structure

```typescript
// Loader data for calendar
interface CalendarEvent {
  id: string;
  title: string;          // Tour name + time
  start: Date;            // date + startTime
  end: Date;              // date + endTime
  status: TripStatus;
  tourId: string;
  boatId: string | null;
  booked: number;         // current bookings
  capacity: number;       // maxParticipants
  color: string;          // based on tour type
}
```

### Loader Function

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, schema } = await requireTenantAuth(request);
  const url = new URL(request.url);

  const start = url.searchParams.get('start') || startOfMonth(new Date());
  const end = url.searchParams.get('end') || endOfMonth(new Date());

  const trips = await db
    .select({
      id: schema.trips.id,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      endTime: schema.trips.endTime,
      status: schema.trips.status,
      maxParticipants: schema.trips.maxParticipants,
      tourName: schema.tours.name,
      tourColor: schema.tours.color,
      boatName: schema.boats.name,
    })
    .from(schema.trips)
    .leftJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .leftJoin(schema.boats, eq(schema.trips.boatId, schema.boats.id))
    .where(between(schema.trips.date, start, end));

  return { trips, tenant };
}
```

### Component Structure

```
calendar.tsx
├── CalendarHeader (date nav, view toggles, filters)
├── CalendarView (FullCalendar wrapper)
│   ├── MonthView
│   ├── WeekView
│   └── DayView
├── TripDetailModal (click event to view/edit)
└── QuickAddModal (click date to add trip)
```

---

## Google Calendar Integration

Listed in integrations page. Implementation:

### Sync Options
1. **One-way export** - Push DiveStreams trips to Google Calendar
2. **Two-way sync** - Full bidirectional (complex)
3. **Availability blocking** - Import Google events as blocked time

### OAuth Flow
```typescript
// routes/tenant/settings/integrations/google-calendar.tsx
export async function action({ request }) {
  // OAuth redirect to Google
  const authUrl = oauth2Client.generateAuthUrl({
    scope: ['https://www.googleapis.com/auth/calendar'],
    redirect_uri: `${SITE_URL}/integrations/google/callback`
  });
  return redirect(authUrl);
}
```

### Schema Addition
```typescript
integrations: pgTable('integrations', {
  id: uuid().primaryKey(),
  provider: varchar(50), // 'google_calendar'
  accessToken: text(),
  refreshToken: text(),
  expiresAt: timestamp(),
  syncCalendarId: varchar(255),
  lastSyncAt: timestamp(),
});
```

---

## Implementation Priority

### Phase 1 (Core Calendar)
1. Install FullCalendar
2. Month view with trips displayed
3. Click trip to view details modal
4. Date navigation (prev/next month)

### Phase 2 (Enhanced Views)
1. Week and Day views
2. Color coding by tour type
3. Capacity indicators (badges)
4. Filter by tour/boat/status

### Phase 3 (Interactions)
1. Drag-and-drop reschedule
2. Click date to quick-add trip
3. Resize events to change duration

### Phase 4 (Integration)
1. Google Calendar OAuth flow
2. One-way push to Google
3. Staff availability view

---

## Dependencies

```bash
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

## Estimated Effort

| Phase | Features | Effort |
|-------|----------|--------|
| Phase 1 | Basic month view | 2 days |
| Phase 2 | Enhanced views | 2-3 days |
| Phase 3 | Interactions | 3-4 days |
| Phase 4 | Google sync | 4-5 days |

---

## Questions to Resolve

1. Which calendar library preferred?
2. Priority of Google Calendar integration?
3. Need resource view (by boat/guide)?
4. Should staff see personal + work calendar combined?
