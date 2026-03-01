import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, Outlet, useLocation } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { getPublicSiteSettings } from "../../../../lib/db/public-site.server";
import { getBaseDomain, getTenantUrl } from "../../../../lib/utils/url";

export const meta: MetaFunction = () => [{ title: "Public Site Settings - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const settings = await getPublicSiteSettings(ctx.org.id);

  return {
    orgSlug: ctx.org.slug,
    baseDomain: getBaseDomain(),
    publicSiteUrl: getTenantUrl(ctx.org.slug, "/site"),
    customDomain: ctx.org.customDomain ?? null,
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
  { id: "general", label: "General", href: "/tenant/settings/public-site" },
  { id: "content", label: "Content", href: "/tenant/settings/public-site/content" },
  { id: "appearance", label: "Appearance", href: "/tenant/settings/public-site/appearance" },
];

export default function PublicSiteSettingsLayout() {
  const { orgSlug, baseDomain, publicSiteUrl, customDomain, settings, isPremium } = useLoaderData<typeof loader>();
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
        <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Public Site Settings</h1>
        <p className="text-foreground-muted">
          Configure your public-facing website at{" "}
          <a
            href={publicSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            {publicSiteUrl}
          </a>
        </p>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-3 mb-6">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            settings.enabled
              ? "bg-success-muted text-success"
              : "bg-surface-overlay text-foreground-muted"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full mr-2 ${
              settings.enabled ? "bg-success" : "bg-surface-overlay"
            }`}
          />
          {settings.enabled ? "Site Enabled" : "Site Disabled"}
        </span>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              to={tab.href}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-brand text-brand"
                  : "border-transparent text-foreground-muted hover:text-foreground-muted hover:border-border"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <Outlet context={{ settings, orgSlug, baseDomain, publicSiteUrl, customDomain, isPremium }} />
    </div>
  );
}
