import type { ActionFunctionArgs } from "react-router";
import { useOutletContext, useFetcher } from "react-router";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { updatePublicSiteSettings } from "../../../../lib/db/public-site.server";
import type { PublicSiteSettings } from "../../../../lib/db/schema";
import { sanitizeIframeEmbed } from "../../../../lib/security/sanitize";
import { CsrfInput } from "../../../components/CsrfInput";
import { useT } from "../../../i18n/use-t";

type OutletContextType = {
  settings: PublicSiteSettings;
  orgSlug: string;
  isPremium: boolean;
};

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-content") {
    const aboutContent = (formData.get("aboutContent") as string) || null;
    const heroImageUrl = (formData.get("heroImageUrl") as string) || null;
    const heroVideoUrl = (formData.get("heroVideoUrl") as string) || null;
    const logoUrl = (formData.get("logoUrl") as string) || null;

    const rawMapEmbed = (formData.get("mapEmbed") as string) || null;
    const contactInfo = {
      address: (formData.get("contactAddress") as string) || null,
      phone: (formData.get("contactPhone") as string) || null,
      email: (formData.get("contactEmail") as string) || null,
      hours: (formData.get("contactHours") as string) || null,
      mapEmbed: rawMapEmbed ? sanitizeIframeEmbed(rawMapEmbed) : null,
    };

    await updatePublicSiteSettings(ctx.org.id, {
      aboutContent,
      heroImageUrl,
      heroVideoUrl,
      logoUrl,
      contactInfo,
    });

    return { success: true, message: "Content settings updated successfully" };
  }

  return null;
}

export default function PublicSiteContentSettings() {
  const t = useT();
  const { settings } = useOutletContext<OutletContextType>();
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
        <input type="hidden" name="intent" value="update-content" />

        {/* Branding */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-4">{t("tenant.settings.publicSite.content.branding")}</h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium mb-1">
                {t("tenant.settings.publicSite.content.logoUrl")}
              </label>
              <input
                type="url"
                id="logoUrl"
                name="logoUrl"
                defaultValue={settings.logoUrl || ""}
                placeholder={t("tenant.settings.publicSite.content.logoUrlPlaceholder")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              <p className="text-xs text-foreground-muted mt-1">
                {t("tenant.settings.publicSite.content.logoHint")}
              </p>
            </div>

            <div>
              <label htmlFor="heroImageUrl" className="block text-sm font-medium mb-1">
                {t("tenant.settings.publicSite.appearance.heroImageUrl")}
              </label>
              <input
                type="url"
                id="heroImageUrl"
                name="heroImageUrl"
                defaultValue={settings.heroImageUrl || ""}
                placeholder={t("tenant.settings.publicSite.content.heroImagePlaceholder")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              <p className="text-xs text-foreground-muted mt-1">
                {t("tenant.settings.publicSite.content.heroImageHint")}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="heroVideoUrl" className="block text-sm font-medium mb-1">
              {t("tenant.settings.publicSite.content.heroVideoUrl")}
            </label>
            <input
              type="url"
              id="heroVideoUrl"
              name="heroVideoUrl"
              defaultValue={settings.heroVideoUrl || ""}
              placeholder={t("tenant.settings.publicSite.content.heroVideoPlaceholder")}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            />
            <p className="text-xs text-foreground-muted mt-1">
              {t("tenant.settings.publicSite.content.heroVideoHint")}
            </p>
          </div>

          {/* Image & Video Preview */}
          {(settings.logoUrl || settings.heroImageUrl || settings.heroVideoUrl) && (
            <div className="mt-4 space-y-4">
              {(settings.logoUrl || settings.heroImageUrl) && (
                <div className="grid grid-cols-2 gap-6">
                  {settings.logoUrl && (
                    <div>
                      <p className="text-sm font-medium text-foreground-muted mb-2">{t("tenant.settings.publicSite.content.logoPreview")}</p>
                      <div className="border rounded-lg p-4 bg-surface-inset">
                        <img
                          src={settings.logoUrl}
                          alt={t("tenant.settings.publicSite.content.logoPreview")}
                          className="max-h-16 object-contain"
                        />
                      </div>
                    </div>
                  )}
                  {settings.heroImageUrl && (
                    <div>
                      <p className="text-sm font-medium text-foreground-muted mb-2">{t("tenant.settings.publicSite.content.heroPreview")}</p>
                      <div className="border rounded-lg overflow-hidden">
                        <img
                          src={settings.heroImageUrl}
                          alt={t("tenant.settings.publicSite.content.heroPreview")}
                          className="w-full h-24 object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {settings.heroVideoUrl && (
                <div>
                  <p className="text-sm font-medium text-foreground-muted mb-2">{t("tenant.settings.publicSite.content.heroVideoPreview")}</p>
                  <div className="border rounded-lg overflow-hidden">
                    <video
                      src={settings.heroVideoUrl}
                      className="w-full h-48 object-cover"
                      muted
                      playsInline
                      controls
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* About Content */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-2">{t("tenant.settings.publicSite.content.aboutPageContent")}</h2>
          <p className="text-sm text-foreground-muted mb-4">
            {t("tenant.settings.publicSite.content.aboutPageDescription")}
          </p>

          <div>
            <label htmlFor="aboutContent" className="block text-sm font-medium mb-1">
              {t("tenant.settings.publicSite.content.aboutUsContent")}
            </label>
            <textarea
              id="aboutContent"
              name="aboutContent"
              rows={8}
              defaultValue={settings.aboutContent || ""}
              placeholder={t("tenant.settings.publicSite.content.aboutPlaceholder")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand resize-y"
            />
            <p className="text-xs text-foreground-muted mt-1">
              {t("tenant.settings.publicSite.content.aboutContentHint")}
            </p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-2">{t("tenant.settings.publicSite.content.contactInformation")}</h2>
          <p className="text-sm text-foreground-muted mb-4">
            {t("tenant.settings.publicSite.content.contactDescription")}
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="contactAddress" className="block text-sm font-medium mb-1">
                {t("common.address")}
              </label>
              <textarea
                id="contactAddress"
                name="contactAddress"
                rows={2}
                defaultValue={settings.contactInfo?.address || ""}
                placeholder={t("tenant.settings.publicSite.content.addressPlaceholder")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="contactPhone" className="block text-sm font-medium mb-1">
                  {t("common.phone")}
                </label>
                <input
                  type="tel"
                  id="contactPhone"
                  name="contactPhone"
                  defaultValue={settings.contactInfo?.phone || ""}
                  placeholder={t("tenant.settings.publicSite.content.phonePlaceholder")}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium mb-1">
                  {t("common.email")}
                </label>
                <input
                  type="email"
                  id="contactEmail"
                  name="contactEmail"
                  defaultValue={settings.contactInfo?.email || ""}
                  placeholder={t("tenant.settings.publicSite.content.emailPlaceholder")}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contactHours" className="block text-sm font-medium mb-1">
                {t("tenant.settings.publicSite.content.businessHours")}
              </label>
              <textarea
                id="contactHours"
                name="contactHours"
                rows={3}
                defaultValue={settings.contactInfo?.hours || ""}
                placeholder={t("tenant.settings.publicSite.content.hoursPlaceholder")}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="mapEmbed" className="block text-sm font-medium mb-1">
                {t("tenant.settings.publicSite.content.googleMapsEmbed")}
              </label>
              <textarea
                id="mapEmbed"
                name="mapEmbed"
                rows={4}
                defaultValue={settings.contactInfo?.mapEmbed || ""}
                placeholder={t("tenant.settings.publicSite.content.mapEmbedPlaceholder")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand font-mono text-sm"
              />
              <p className="text-xs text-foreground-muted mt-1">
                {t("tenant.settings.publicSite.content.googleMapsHint")}
              </p>
            </div>

            {/* Map Preview */}
            {settings.contactInfo?.mapEmbed && (
              <div>
                <p className="text-sm font-medium text-foreground-muted mb-2">{t("tenant.settings.publicSite.content.mapPreview")}</p>
                <div
                  className="border rounded-lg overflow-hidden"
                  suppressHydrationWarning
                  dangerouslySetInnerHTML={{
                    __html: sanitizeIframeEmbed(settings.contactInfo.mapEmbed || "")
                      .replace(/width="[^"]*"/, 'width="100%"')
                      .replace(/height="[^"]*"/, 'height="200"'),
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-muted"
          >
            {isSubmitting ? t("common.saving") : t("tenant.settings.publicSite.content.saveContent")}
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}
