import { Link } from "react-router";
import { sections } from "./guide";

const descriptions: Record<string, string> = {
  "getting-started": "Set up your dive shop and get running in minutes",
  dashboard: "Monitor bookings, revenue, and daily operations at a glance",
  tours: "Create dive experiences with pricing, inclusions, and sites",
  trips: "Schedule trips, assign boats and staff, manage capacity",
  bookings: "Track reservations, payments, and participant details",
  customers: "Manage diver profiles, certifications, and history",
  equipment: "Track rental gear inventory, condition, and pricing",
  training: "Run certification courses, sessions, and enrollments",
  reports: "Analyze revenue, bookings, and business performance",
  settings: "Configure your shop, team, integrations, and billing",
};

export default function GuideIndex() {
  return (
    <div>
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-3">
          DiveStreams Help Center
        </h1>
        <p className="text-lg text-foreground-muted">
          Everything you need to run your dive shop
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.slug}
            to={`/guide/${s.slug}`}
            className="bg-surface-raised border border-border-muted rounded-xl p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{s.icon}</span>
              <h2 className="text-lg font-semibold text-foreground group-hover:text-brand transition-colors">
                {s.title}
              </h2>
            </div>
            <p className="text-sm text-foreground-muted">
              {descriptions[s.slug]}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
