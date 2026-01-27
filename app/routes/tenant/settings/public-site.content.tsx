import type { ActionFunctionArgs } from "react-router";
import { useOutletContext, useFetcher } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { updatePublicSiteSettings } from "../../../../lib/db/public-site.server";
import type { PublicSiteSettings } from "../../../../lib/db/schema";

type OutletContextType = {
  settings: PublicSiteSettings;
  orgSlug: string;
  isPremium: boolean;
};

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-content") {
    const aboutContent = (formData.get("aboutContent") as string) || null;
    const heroImageUrl = (formData.get("heroImageUrl") as string) || null;
    const heroVideoUrl = (formData.get("heroVideoUrl") as string) || null;
    const logoUrl = (formData.get("logoUrl") as string) || null;

    const contactInfo = {
      address: (formData.get("contactAddress") as string) || null,
      phone: (formData.get("contactPhone") as string) || null,
      email: (formData.get("contactEmail") as string) || null,
      hours: (formData.get("contactHours") as string) || null,
      mapEmbed: (formData.get("mapEmbed") as string) || null,
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
  const { settings } = useOutletContext<OutletContextType>();
  const fetcher = useFetcher<{ success?: boolean; message?: string }>();
  const isSubmitting = fetcher.state === "submitting";

  return (
    <div className="space-y-6">
      {fetcher.data?.success && (
        <div className="bg-success-muted border border-success-muted text-success px-4 py-3 rounded-lg">
          {fetcher.data.message}
        </div>
      )}

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="update-content" />

        {/* Branding */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-4">Branding</h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium mb-1">
                Logo URL
              </label>
              <input
                type="url"
                id="logoUrl"
                name="logoUrl"
                defaultValue={settings.logoUrl || ""}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Recommended size: 200x60px, PNG or SVG
              </p>
            </div>

            <div>
              <label htmlFor="heroImageUrl" className="block text-sm font-medium mb-1">
                Hero Image URL
              </label>
              <input
                type="url"
                id="heroImageUrl"
                name="heroImageUrl"
                defaultValue={settings.heroImageUrl || ""}
                placeholder="https://example.com/hero.jpg"
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Recommended size: 1920x600px, JPG
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="heroVideoUrl" className="block text-sm font-medium mb-1">
              Hero Video URL (Optional)
            </label>
            <input
              type="url"
              id="heroVideoUrl"
              name="heroVideoUrl"
              defaultValue={settings.heroVideoUrl || ""}
              placeholder="https://example.com/video.mp4"
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Video displayed below hero section. Formats: MP4 (H.264) or WebM. Max 50MB. 16:9 aspect ratio recommended. Will autoplay muted and loop.
            </p>
          </div>

          {/* Image & Video Preview */}
          {(settings.logoUrl || settings.heroImageUrl || settings.heroVideoUrl) && (
            <div className="mt-4 space-y-4">
              {(settings.logoUrl || settings.heroImageUrl) && (
                <div className="grid grid-cols-2 gap-6">
                  {settings.logoUrl && (
                    <div>
                      <p className="text-sm font-medium text-foreground-muted mb-2">Logo Preview</p>
                      <div className="border rounded-lg p-4 bg-surface-inset">
                        <img
                          src={settings.logoUrl}
                          alt="Logo preview"
                          className="max-h-16 object-contain"
                        />
                      </div>
                    </div>
                  )}
                  {settings.heroImageUrl && (
                    <div>
                      <p className="text-sm font-medium text-foreground-muted mb-2">Hero Preview</p>
                      <div className="border rounded-lg overflow-hidden">
                        <img
                          src={settings.heroImageUrl}
                          alt="Hero preview"
                          className="w-full h-24 object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {settings.heroVideoUrl && (
                <div>
                  <p className="text-sm font-medium text-foreground-muted mb-2">Hero Video Preview</p>
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
          <h2 className="font-semibold mb-2">About Page Content</h2>
          <p className="text-sm text-foreground-muted mb-4">
            Write about your dive shop, history, and team
          </p>

          <div>
            <label htmlFor="aboutContent" className="block text-sm font-medium mb-1">
              About Us Content
            </label>
            <textarea
              id="aboutContent"
              name="aboutContent"
              rows={8}
              defaultValue={settings.aboutContent || ""}
              placeholder="Tell visitors about your dive shop, your history, your team, and what makes you unique..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand resize-y"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Plain text for now. Rich text editor coming soon.
            </p>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-2">Contact Information</h2>
          <p className="text-sm text-foreground-muted mb-4">
            Information displayed on your contact page
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="contactAddress" className="block text-sm font-medium mb-1">
                Address
              </label>
              <textarea
                id="contactAddress"
                name="contactAddress"
                rows={2}
                defaultValue={settings.contactInfo?.address || ""}
                placeholder="123 Ocean Drive, Key Largo, FL 33037"
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="contactPhone" className="block text-sm font-medium mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="contactPhone"
                  name="contactPhone"
                  defaultValue={settings.contactInfo?.phone || ""}
                  placeholder="+1 (305) 555-0123"
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="contactEmail"
                  name="contactEmail"
                  defaultValue={settings.contactInfo?.email || ""}
                  placeholder="info@yourdiveshop.com"
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contactHours" className="block text-sm font-medium mb-1">
                Business Hours
              </label>
              <textarea
                id="contactHours"
                name="contactHours"
                rows={3}
                defaultValue={settings.contactInfo?.hours || ""}
                placeholder="Mon-Fri: 8am-6pm, Sat-Sun: 7am-7pm"
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="mapEmbed" className="block text-sm font-medium mb-1">
                Google Maps Embed Code
              </label>
              <textarea
                id="mapEmbed"
                name="mapEmbed"
                rows={4}
                defaultValue={settings.contactInfo?.mapEmbed || ""}
                placeholder='<iframe src="https://www.google.com/maps/embed?..." width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>'
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand font-mono text-sm"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Get embed code from{" "}
                <a
                  href="https://www.google.com/maps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  Google Maps
                </a>{" "}
                &rarr; Share &rarr; Embed a map
              </p>
            </div>

            {/* Map Preview */}
            {settings.contactInfo?.mapEmbed && (
              <div>
                <p className="text-sm font-medium text-foreground-muted mb-2">Map Preview</p>
                <div
                  className="border rounded-lg overflow-hidden"
                  suppressHydrationWarning
                  dangerouslySetInnerHTML={{
                    __html: settings.contactInfo.mapEmbed.replace(
                      /width="[^"]*"/,
                      'width="100%"'
                    ).replace(
                      /height="[^"]*"/,
                      'height="200"'
                    ),
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
            {isSubmitting ? "Saving..." : "Save Content Settings"}
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}
