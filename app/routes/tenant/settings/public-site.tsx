import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, Outlet, useLocation } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { getPublicSiteSettings } from "../../../../lib/db/public-site.server";

export const meta: MetaFunction = () => [{ title: "Public Site Settings - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const settings = await getPublicSiteSettings(ctx.org.id);

  return {
    orgSlug: ctx.org.slug,
    settings: settings ?? {
      enabled: false,
      theme: "ocean" as const,
      primaryColor: "#0ea5e9",
      secondaryColor: "#06b6d4",
      logoUrl: null,
      heroImageUrl: null,
      fontFamily: "inter" as const,
      pages: {
        home: true,
        about: true,
        trips: true,
        courses: true,
        equipment: false,
        contact: true,
        gallery: false,
      },
      aboutContent: null,
      contactInfo: null,
    },
    isPremium: ctx.isPremium,
  };
}

const tabs = [
  { id: "general", label: "General", href: "/app/settings/public-site" },
  { id: "content", label: "Content", href: "/app/settings/public-site/content" },
  { id: "appearance", label: "Appearance", href: "/app/settings/public-site/appearance" },
];

export default function PublicSiteSettingsLayout() {
  const { orgSlug, settings, isPremium } = useLoaderData<typeof loader>();
  const location = useLocation();

  // Determine active tab
  const currentPath = location.pathname;
  const activeTab = currentPath.endsWith("/content")
    ? "content"
    : currentPath.endsWith("/appearance")
    ? "appearance"
    : "general";

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link to="/app/settings" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Public Site Settings</h1>
        <p className="text-gray-500">
          Configure your public-facing website at{" "}
          <a
            href={`https://${orgSlug}.divestreams.com/site`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {orgSlug}.divestreams.com/site
          </a>
        </p>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-3 mb-6">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            settings.enabled
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full mr-2 ${
              settings.enabled ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          {settings.enabled ? "Site Enabled" : "Site Disabled"}
        </span>
        {!isPremium && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
            Free Plan - Limited Features
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              to={tab.href}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <Outlet context={{ settings, orgSlug, isPremium }} />
    </div>
  );
}
