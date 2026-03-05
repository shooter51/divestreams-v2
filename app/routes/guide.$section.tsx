import { useParams, Link } from "react-router";
import { sections } from "./guide";
import GettingStarted from "../guide/sections/getting-started";
import Dashboard from "../guide/sections/dashboard";
import Tours from "../guide/sections/tours";
import Trips from "../guide/sections/trips";
import Bookings from "../guide/sections/bookings";
import Customers from "../guide/sections/customers";
import Equipment from "../guide/sections/equipment";
import Training from "../guide/sections/training";
import Reports from "../guide/sections/reports";
import Settings from "../guide/sections/settings";

const sectionComponents: Record<string, React.ComponentType> = {
  "getting-started": GettingStarted,
  dashboard: Dashboard,
  tours: Tours,
  trips: Trips,
  bookings: Bookings,
  customers: Customers,
  equipment: Equipment,
  training: Training,
  reports: Reports,
  settings: Settings,
};

export default function GuideSection() {
  const { section } = useParams();
  const Component = section ? sectionComponents[section] : null;
  const currentIndex = sections.findIndex((s) => s.slug === section);
  const prev = currentIndex > 0 ? sections[currentIndex - 1] : null;
  const next =
    currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;

  if (!Component) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Section Not Found
        </h1>
        <p className="text-foreground-muted mb-6">
          The guide section &ldquo;{section}&rdquo; does not exist.
        </p>
        <Link to="/guide" className="text-brand hover:underline">
          Back to Help Center
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Component />

      {/* Prev / Next navigation */}
      <div className="flex justify-between items-center mt-12 pt-6 border-t border-border-muted">
        {prev ? (
          <Link
            to={`/guide/${prev.slug}`}
            className="text-sm text-brand hover:underline"
          >
            &larr; {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to={`/guide/${next.slug}`}
            className="text-sm text-brand hover:underline"
          >
            {next.title} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
