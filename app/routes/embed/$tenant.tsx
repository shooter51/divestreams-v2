/**
 * Booking Widget Layout
 *
 * Public embed layout for booking widget. No authentication required.
 * Loaded via iframe on tenant's external website.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "react-router";
import { getOrganizationBySlug } from "../../../lib/db/queries.public";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.organization?.name ? `Book with ${data.organization.name}` : "Book Now" },
];

// Widget settings type (matches booking-widget.tsx)
type WidgetSettings = {
  primaryColor: string;
  buttonText: string;
  showPrices: boolean;
  showAvailability: boolean;
  showDescription: boolean;
  layout: "grid" | "list";
  maxTripsShown: number;
};

const defaultWidgetSettings: WidgetSettings = {
  primaryColor: "#2563eb",
  buttonText: "Book Now",
  showPrices: true,
  showAvailability: true,
  showDescription: true,
  layout: "grid",
  maxTripsShown: 6,
};

export async function loader({ params }: LoaderFunctionArgs) {
  const subdomain = params.tenant;
  if (!subdomain) {
    throw new Response("Shop not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  // Get branding and widget settings from organization metadata
  // Widget settings page saves to: metadata.branding and metadata.widget
  const metadata = org.metadata as {
    branding?: {
      primaryColor?: string;
      secondaryColor?: string;
      logo?: string;
    };
    widget?: Partial<WidgetSettings>;
    settings?: {
      currency?: string;
      timezone?: string;
    };
  } | null;

  // Read branding from metadata.branding (where widget settings page saves it)
  const branding = metadata?.branding || {};

  // Read widget settings from metadata.widget
  const widgetSettings: WidgetSettings = {
    ...defaultWidgetSettings,
    ...metadata?.widget,
    // Branding primaryColor takes precedence if set
    primaryColor: branding.primaryColor || metadata?.widget?.primaryColor || defaultWidgetSettings.primaryColor,
  };

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      currency: metadata?.settings?.currency || "USD",
      timezone: metadata?.settings?.timezone || "UTC",
    },
    branding: {
      primaryColor: widgetSettings.primaryColor,
      secondaryColor: branding.secondaryColor || "#f0f9ff",
      logo: branding.logo,
    },
    widgetSettings,
  };
}

export default function EmbedLayout() {
  const { organization, branding, widgetSettings } = useLoaderData<typeof loader>();

  return (
    <div
      className="min-h-screen bg-surface text-foreground"
      style={{
        "--primary-color": branding.primaryColor,
        "--secondary-color": branding.secondaryColor,
      } as React.CSSProperties}
    >
      {/* Header */}
      <header className="border-b border-border px-4 py-3 bg-surface-raised">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {branding.logo ? (
            <img
              src={branding.logo}
              alt={organization.name}
              className="h-8 object-contain"
            />
          ) : (
            <h1 className="text-lg font-semibold text-foreground">{organization.name}</h1>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet context={{ organization, branding, widgetSettings }} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-3 text-center text-sm text-foreground-muted bg-surface-raised">
        <p>Powered by DiveStreams</p>
      </footer>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {error.status === 404 ? "Shop Not Found" : "Error"}
          </h1>
          <p className="text-foreground-muted">
            {error.status === 404
              ? "This booking widget is not available."
              : "Something went wrong."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">Error</h1>
        <p className="text-foreground-muted">Something went wrong loading this page.</p>
      </div>
    </div>
  );
}
