import type { ActionFunctionArgs } from "react-router";
import { useOutletContext, useFetcher } from "react-router";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { updatePublicSiteSettings } from "../../../../lib/db/public-site.server";
import { db } from "../../../../lib/db";
import { organization } from "../../../../lib/db/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import type { PublicSiteSettings } from "../../../../lib/db/schema";
import { CsrfInput } from "../../../components/CsrfInput";
import { useT } from "../../../i18n/use-t";

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
  requireRole(ctx, ["owner", "admin"]);
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
      // Check uniqueness of custom domain
      if (customDomain) {
        const normalizedDomain = customDomain.toLowerCase().trim();
        const existing = await db
          .select({ id: organization.id })
          .from(organization)
          .where(
            and(
              sql`LOWER(${organization.customDomain}) = ${normalizedDomain}`,
              ne(organization.id, ctx.org.id)
            )
          )
          .limit(1);
        if (existing.length > 0) {
          return { error: "This custom domain is already in use by another organization" };
        }
      }
      await db
        .update(organization)
        .set({ customDomain: customDomain?.toLowerCase().trim() ?? null, updatedAt: new Date() })
        .where(eq(organization.id, ctx.org.id));
    }

    return { success: true, message: "General settings updated successfully" };
  }

  return null;
}

export default function PublicSiteGeneralSettings() {
  const t = useT();
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
        <CsrfInput />
        <input type="hidden" name="intent" value="update-general" />

        {/* Enable/Disable Toggle */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{t("tenant.settings.publicSite.general.siteStatus")}</h2>
              <p className="text-sm text-foreground-muted">
                {t("tenant.settings.publicSite.general.siteStatusDescription")}
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
          <h2 className="font-semibold mb-2">{t("tenant.settings.publicSite.general.customDomain")}</h2>
          <p className="text-sm text-foreground-muted mb-4">
            {t("tenant.settings.publicSite.general.customDomainDescription")}
          </p>

          <div className="mb-4">
            <label htmlFor="customDomain" className="block text-sm font-medium mb-1">
              {t("tenant.settings.publicSite.general.customDomain")}
            </label>
            <input
              type="text"
              id="customDomain"
              name="customDomain"
              defaultValue={customDomain || ""}
              placeholder={t("tenant.settings.publicSite.general.customDomainPlaceholder")}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </div>

          <div className="bg-brand-muted border border-brand-muted rounded-lg p-4">
            <h3 className="font-medium text-brand mb-2">{t("tenant.settings.publicSite.general.dnsSetupInstructions")}</h3>
            <p className="text-sm text-brand mb-3">
              {t("tenant.settings.publicSite.general.dnsSetupDescription")}
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
              {t("tenant.settings.publicSite.general.dnsPropagation")}
            </p>
          </div>
        </div>

        {/* Page Toggles */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-2">{t("tenant.settings.publicSite.general.enabledPages")}</h2>
          <p className="text-sm text-foreground-muted mb-4">
            {t("tenant.settings.publicSite.general.enabledPagesDescription")}
          </p>

          <div className="space-y-3">
            {[
              { id: "home", label: t("tenant.settings.publicSite.general.pageHome"), description: t("tenant.settings.publicSite.general.pageHomeDesc") },
              { id: "about", label: t("tenant.settings.publicSite.general.pageAbout"), description: t("tenant.settings.publicSite.general.pageAboutDesc") },
              { id: "trips", label: t("tenant.settings.publicSite.general.pageTrips"), description: t("tenant.settings.publicSite.general.pageTripsDesc") },
              { id: "courses", label: t("tenant.settings.publicSite.general.pageCourses"), description: t("tenant.settings.publicSite.general.pageCoursesDesc") },
              {
                id: "equipment",
                label: t("tenant.settings.publicSite.general.pageEquipment"),
                description: t("tenant.settings.publicSite.general.pageEquipmentDesc"),
                premium: true,
              },
              { id: "contact", label: t("tenant.settings.publicSite.general.pageContact"), description: t("tenant.settings.publicSite.general.pageContactDesc") },
              {
                id: "gallery",
                label: t("tenant.settings.publicSite.general.pageGallery"),
                description: t("tenant.settings.publicSite.general.pageGalleryDesc"),
                premium: true,
              },
            ].map((page) => (
              <label
                key={page.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-surface-inset cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name={`page-${page.id}`}
                    value="true"
                    defaultChecked={settings?.pages?.[page.id as keyof typeof settings.pages] ?? false}
                    className="w-4 h-4 text-brand rounded focus:ring-brand"
                  />
                  <div>
                    <span className="font-medium">{page.label}</span>
                    <p className="text-sm text-foreground-muted">{page.description}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Default Site URL */}
        <div className="bg-surface-inset rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-2">{t("tenant.settings.publicSite.general.defaultSiteUrl")}</h2>
          <p className="text-sm text-foreground-muted mb-3">
            {t("tenant.settings.publicSite.general.defaultSiteUrlDescription")}
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
              {t("tenant.settings.publicSite.general.visitSite")}
            </a>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-muted"
          >
            {isSubmitting ? t("common.saving") : t("tenant.settings.publicSite.general.saveGeneralSettings")}
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}
