/**
 * Booking Widget Layout
 *
 * Public embed layout for booking widget. No authentication required.
 * Loaded via iframe on tenant's external website.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import {
  Outlet,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
  Link,
  useLocation,
} from "react-router";
import {
  getOrganizationBySlug,
  getPublicTours,
  getPublicCourses,
} from "../../../lib/db/queries.public";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.organization?.name ? `Book with ${data.organization.name}` : "Book Now" },
];

export async function loader({ params, request }: LoaderFunctionArgs) {
  const subdomain = params.tenant;
  if (!subdomain) {
    throw new Response("Shop not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  // Get branding settings from organization metadata
  const metadata = org.metadata as {
    settings?: {
      branding?: {
        primaryColor?: string;
        secondaryColor?: string;
        logo?: string;
      };
      currency?: string;
      timezone?: string;
    };
  } | null;

  const branding = metadata?.settings?.branding || {};

  // Check availability of tours and courses to show appropriate tabs
  const [tours, courses] = await Promise.all([
    getPublicTours(org.id),
    getPublicCourses(org.id),
  ]);

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      currency: metadata?.settings?.currency || "USD",
      timezone: metadata?.settings?.timezone || "UTC",
    },
    branding: {
      primaryColor: branding.primaryColor || "#0066cc",
      secondaryColor: branding.secondaryColor || "#f0f9ff",
      logo: branding.logo,
    },
    hasTours: tours.length > 0,
    hasCourses: courses.length > 0,
  };
}

export default function EmbedLayout() {
  const { organization, branding, hasTours, hasCourses } =
    useLoaderData<typeof loader>();
  const location = useLocation();

  // Determine active tab based on current path
  const isCoursesPath = location.pathname.includes("/courses");
  const showTabs = hasTours && hasCourses;

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
              alt={organization.name}
              className="h-8 object-contain"
            />
          ) : (
            <h1 className="text-lg font-semibold">{organization.name}</h1>
          )}
        </div>
      </header>

      {/* Tab Navigation - only show if both tours and courses exist */}
      {showTabs && (
        <nav className="border-b">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex gap-1">
              <Link
                to={`/embed/${organization.slug}`}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  !isCoursesPath
                    ? "border-current"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                style={!isCoursesPath ? { color: branding.primaryColor } : {}}
              >
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                    />
                  </svg>
                  Tours
                </span>
              </Link>
              <Link
                to={`/embed/${organization.slug}/courses`}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isCoursesPath
                    ? "border-current"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                style={isCoursesPath ? { color: branding.primaryColor } : {}}
              >
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  Certification Courses
                </span>
              </Link>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet context={{ organization, branding }} />
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
