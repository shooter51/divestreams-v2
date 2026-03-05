import { Outlet, NavLink, Link } from "react-router";

const sections = [
  { slug: "getting-started", title: "Getting Started", icon: "\u{1F680}" },
  { slug: "dashboard", title: "Dashboard", icon: "\u{1F4CA}" },
  { slug: "tours", title: "Tours", icon: "\u{1F3DD}\uFE0F" },
  { slug: "trips", title: "Trips & Scheduling", icon: "\u{1F6A4}" },
  { slug: "bookings", title: "Bookings", icon: "\u{1F4C5}" },
  { slug: "customers", title: "Customers", icon: "\u{1F465}" },
  { slug: "equipment", title: "Equipment", icon: "\u{1F93F}" },
  { slug: "training", title: "Training", icon: "\u{1F393}" },
  { slug: "reports", title: "Reports", icon: "\u{1F4C8}" },
  { slug: "settings", title: "Settings", icon: "\u2699\uFE0F" },
];

export { sections };

export default function GuideLayout() {
  return (
    <div className="flex h-screen bg-surface-inset">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-surface-raised border-r border-border-muted flex flex-col">
        <div className="p-4 border-b border-border-muted">
          <Link to="/guide" className="text-lg font-bold text-brand">
            DiveStreams Help
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map((s) => (
            <NavLink
              key={s.slug}
              to={`/guide/${s.slug}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-muted text-brand font-medium"
                    : "text-foreground-muted hover:bg-surface-inset hover:text-foreground"
                }`
              }
            >
              <span className="text-base">{s.icon}</span>
              <span>{s.title}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border-muted">
          <Link
            to="/tenant"
            className="text-sm text-foreground-muted hover:text-brand transition-colors"
          >
            &larr; Back to App
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
