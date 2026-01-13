/**
 * Booking Widget Layout
 *
 * Public embed layout for booking widget. No authentication required.
 * Loaded via iframe on tenant's external website.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "react-router";
import { getTenantBySubdomain } from "../../../lib/db/tenant.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.tenant?.name ? `Book with ${data.tenant.name}` : "Book Now" },
];

export async function loader({ params, request }: LoaderFunctionArgs) {
  const subdomain = params.tenant;
  if (!subdomain) {
    throw new Response("Shop not found", { status: 404 });
  }

  const tenant = await getTenantBySubdomain(subdomain);
  if (!tenant || !tenant.isActive) {
    throw new Response("Shop not found", { status: 404 });
  }

  // Get branding settings
  const branding = tenant.settings?.branding || {};

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      schemaName: tenant.schemaName,
      currency: tenant.currency,
      timezone: tenant.timezone,
    },
    branding: {
      primaryColor: branding.primaryColor || "#0066cc",
      secondaryColor: branding.secondaryColor || "#f0f9ff",
      logo: branding.logo,
    },
  };
}

export default function EmbedLayout() {
  const { tenant, branding } = useLoaderData<typeof loader>();

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        "--primary-color": branding.primaryColor,
        "--secondary-color": branding.secondaryColor,
      } as React.CSSProperties}
    >
      {/* Header */}
      <header className="border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {branding.logo ? (
            <img
              src={branding.logo}
              alt={tenant.name}
              className="h-8 object-contain"
            />
          ) : (
            <h1 className="text-lg font-semibold">{tenant.name}</h1>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet context={{ tenant, branding }} />
      </main>

      {/* Footer */}
      <footer className="border-t px-4 py-3 text-center text-sm text-gray-500">
        <p>Powered by DiveStreams</p>
      </footer>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error.status === 404 ? "Shop Not Found" : "Error"}
          </h1>
          <p className="text-gray-600">
            {error.status === 404
              ? "This booking widget is not available."
              : "Something went wrong."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
        <p className="text-gray-600">Something went wrong loading this page.</p>
      </div>
    </div>
  );
}
