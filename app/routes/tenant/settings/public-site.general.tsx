import type { ActionFunctionArgs } from "react-router";
import { useOutletContext, useFetcher } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { updatePublicSiteSettings } from "../../../../lib/db/public-site.server";
import { db } from "../../../../lib/db";
import { organization } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";
import type { PublicSiteSettings } from "../../../../lib/db/schema";

type OutletContextType = {
  settings: PublicSiteSettings;
  orgSlug: string;
  baseDomain: string;
  publicSiteUrl: string;
  customDomain: string | null;
  isPremium: boolean;
};

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-general") {
    const enabled = formData.get("enabled") === "true";
    const customDomain = (formData.get("customDomain") as string) || null;

    // Update pages toggles
    const pages = {
      home: formData.get("page-home") === "true",
      about: formData.get("page-about") === "true",
      trips: formData.get("page-trips") === "true",
      courses: formData.get("page-courses") === "true",
      equipment: formData.get("page-equipment") === "true",
      contact: formData.get("page-contact") === "true",
      gallery: formData.get("page-gallery") === "true",
    };

    // Update public site settings
    await updatePublicSiteSettings(ctx.org.id, {
      enabled,
      pages,
    });

    // Update custom domain on organization
    if (customDomain !== ctx.org.customDomain) {
      await db
        .update(organization)
        .set({ customDomain, updatedAt: new Date() })
        .where(eq(organization.id, ctx.org.id));
    }

    return { success: true, message: "General settings updated successfully" };
  }

  return null;
}

export default function PublicSiteGeneralSettings() {
  const { settings, orgSlug, baseDomain, publicSiteUrl, customDomain, isPremium } = useOutletContext<OutletContextType>();
  const fetcher = useFetcher<{ success?: boolean; message?: string }>();
  const isSubmitting = fetcher.state === "submitting";

  return (
    <div className="space-y-6">
      {fetcher.data?.success && (
        <div className="bg-success-muted border border-success-muted text-success px-4 py-3 rounded-lg max-w-4xl break-words">
          {fetcher.data.message}
        </div>
      )}

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="update-general" />

        {/* Enable/Disable Toggle */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Public Site Status</h2>
              <p className="text-sm text-foreground-muted">
                Enable or disable your public-facing website
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="enabled"
                value="true"
                defaultChecked={settings.enabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-overlay peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-surface-raised after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
            </label>
          </div>
        </div>

        {/* Custom Domain */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-2">Custom Domain</h2>
          <p className="text-sm text-foreground-muted mb-4">
            Use your own domain for your public site (optional)
          </p>

          <div className="mb-4">
            <label htmlFor="customDomain" className="block text-sm font-medium mb-1">
              Custom Domain
            </label>
            <input
              type="text"
              id="customDomain"
              name="customDomain"
              defaultValue={customDomain || ""}
              placeholder="www.yourdiveshop.com"
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              disabled={!isPremium}
            />
            {!isPremium && (
              <p className="text-xs text-warning mt-1">
                Custom domains are available on paid plans.{" "}
                <a href="/tenant/settings/billing" className="underline">
                  Upgrade now
                </a>
              </p>
            )}
          </div>

          <div className="bg-brand-muted border border-brand-muted rounded-lg p-4">
            <h3 className="font-medium text-brand mb-2">DNS Setup Instructions</h3>
            <p className="text-sm text-brand mb-3">
              To use a custom domain, add a CNAME record pointing to your subdomain:
            </p>
            <div className="bg-surface-raised rounded p-3 font-mono text-sm">
              <div className="grid grid-cols-3 gap-4 text-foreground-muted">
                <div>
                  <span className="text-foreground-subtle">Type:</span> CNAME
                </div>
                <div>
                  <span className="text-foreground-subtle">Name:</span> www
                </div>
                <div>
                  <span className="text-foreground-subtle">Value:</span> {orgSlug}.{baseDomain}
                </div>
              </div>
            </div>
            <p className="text-xs text-brand mt-2">
              DNS changes may take up to 48 hours to propagate.
            </p>
          </div>
        </div>

        {/* Page Toggles */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-2">Enabled Pages</h2>
          <p className="text-sm text-foreground-muted mb-4">
            Choose which pages are visible on your public site
          </p>

          <div className="space-y-3">
            {[
              { id: "home", label: "Home", description: "Landing page with hero and overview" },
              { id: "about", label: "About", description: "About your dive shop" },
              { id: "trips", label: "Trips", description: "Available dive trips and expeditions" },
              { id: "courses", label: "Courses", description: "Training and certification courses" },
              {
                id: "equipment",
                label: "Equipment",
                description: "Rental equipment catalog",
                premium: true,
              },
              { id: "contact", label: "Contact", description: "Contact form and information" },
              {
                id: "gallery",
                label: "Gallery",
                description: "Photo gallery",
                premium: true,
              },
            ].map((page) => (
              <label
                key={page.id}
                className={`flex items-center justify-between p-3 border rounded-lg hover:bg-surface-inset cursor-pointer ${
                  page.premium && !isPremium ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name={`page-${page.id}`}
                    value="true"
                    defaultChecked={settings?.pages?.[page.id as keyof typeof settings.pages] ?? false}
                    disabled={page.premium && !isPremium}
                    className="w-4 h-4 text-brand rounded focus:ring-brand"
                  />
                  <div>
                    <span className="font-medium">{page.label}</span>
                    {page.premium && (
                      <span className="ml-2 text-xs bg-warning-muted text-warning px-2 py-0.5 rounded-full">
                        Premium
                      </span>
                    )}
                    <p className="text-sm text-foreground-muted">{page.description}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Default Site URL */}
        <div className="bg-surface-inset rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-2">Default Site URL</h2>
          <p className="text-sm text-foreground-muted mb-3">
            Your public site is always available at this URL:
          </p>
          <div className="flex items-center gap-3">
            <code className="bg-surface-raised px-4 py-2 rounded border text-sm flex-1">
              {publicSiteUrl}
            </code>
            <a
              href={publicSiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover text-sm"
            >
              Visit Site
            </a>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-muted"
          >
            {isSubmitting ? "Saving..." : "Save General Settings"}
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}
