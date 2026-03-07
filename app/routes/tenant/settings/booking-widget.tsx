import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { organization } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { getAppUrl } from "../../../../lib/utils/url";
import { CsrfInput } from "../../../components/CsrfInput";
import { useT } from "../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Booking Widget - DiveStreams" }];

type WidgetSettings = {
  primaryColor: string;
  buttonText: string;
  showPrices: boolean;
  showAvailability: boolean;
  showDescription: boolean;
  layout: "grid" | "list";
  maxTripsShown: number;
};

const defaultSettings: WidgetSettings = {
  primaryColor: "var(--info)",
  buttonText: "Book Now",
  showPrices: true,
  showAvailability: true,
  showDescription: true,
  layout: "grid",
  maxTripsShown: 6,
};

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);

  // Parse widget settings from org metadata
  let metadata: { widget?: Partial<WidgetSettings>; branding?: { primaryColor?: string } } = {};
  if (ctx.org.metadata) {
    try {
      metadata = JSON.parse(ctx.org.metadata);
    } catch {
      metadata = {};
    }
  }

  const settings: WidgetSettings = {
    ...defaultSettings,
    primaryColor: metadata.branding?.primaryColor || defaultSettings.primaryColor,
    ...metadata.widget,
  };

  // Build embed URL
  const baseUrl = getAppUrl();
  const embedUrl = `${baseUrl}/embed/${ctx.org.slug}`;

  return {
    settings,
    embedUrl,
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const formData = await request.formData();

  // Parse existing metadata
  let metadata: Record<string, unknown> = {};
  if (ctx.org.metadata) {
    try {
      metadata = JSON.parse(ctx.org.metadata);
    } catch {
      metadata = {};
    }
  }

  // Update widget settings
  const widget: WidgetSettings = {
    primaryColor: formData.get("primaryColor") as string || defaultSettings.primaryColor,
    buttonText: formData.get("buttonText") as string || defaultSettings.buttonText,
    showPrices: formData.get("showPrices") === "true",
    showAvailability: formData.get("showAvailability") === "true",
    showDescription: formData.get("showDescription") === "true",
    layout: (formData.get("layout") as "grid" | "list") || "grid",
    maxTripsShown: parseInt(formData.get("maxTripsShown") as string) || 6,
  };

  metadata.widget = widget;
  // Also update branding color
  metadata.branding = {
    ...(metadata.branding as Record<string, unknown> || {}),
    primaryColor: widget.primaryColor,
  };

  await db
    .update(organization)
    .set({
      metadata: JSON.stringify(metadata),
      updatedAt: new Date(),
    })
    .where(eq(organization.id, ctx.org.id));

  return { success: true };
}

export default function BookingWidgetPage() {
  const t = useT();
  const { settings, embedUrl, orgName } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success?: boolean }>();
  const isSubmitting = fetcher.state === "submitting";
  const [copied, setCopied] = useState(false);

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  title="${orgName} Booking Widget"
></iframe>`;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
          &larr; {t("common.backToSettings")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.settings.bookingWidget.title")}</h1>
        <p className="text-foreground-muted">{t("tenant.settings.bookingWidget.subtitle")}</p>
      </div>

      {fetcher.data?.success && (
        <div className="bg-success-muted border border-success-muted text-success px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {t("tenant.settings.bookingWidget.settingsSaved")}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Settings Form */}
        <div>
          <fetcher.Form method="post" className="space-y-6">
            <CsrfInput />
            {/* Appearance */}
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">{t("tenant.settings.bookingWidget.appearance")}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("tenant.settings.bookingWidget.primaryColor")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="primaryColor"
                      defaultValue={settings.primaryColor}
                      className="w-12 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      defaultValue={settings.primaryColor}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono"
                      readOnly
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("tenant.settings.bookingWidget.buttonText")}
                  </label>
                  <input
                    type="text"
                    name="buttonText"
                    defaultValue={settings.buttonText}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("tenant.settings.bookingWidget.layout")}
                  </label>
                  <select
                    name="layout"
                    defaultValue={settings.layout}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="grid">{t("tenant.settings.bookingWidget.gridView")}</option>
                    <option value="list">{t("tenant.settings.bookingWidget.listView")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("tenant.settings.bookingWidget.maxTripsShown")}
                  </label>
                  <select
                    name="maxTripsShown"
                    defaultValue={settings.maxTripsShown}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="3">{t("tenant.settings.bookingWidget.nTrips", { count: "3" })}</option>
                    <option value="6">{t("tenant.settings.bookingWidget.nTrips", { count: "6" })}</option>
                    <option value="9">{t("tenant.settings.bookingWidget.nTrips", { count: "9" })}</option>
                    <option value="12">{t("tenant.settings.bookingWidget.nTrips", { count: "12" })}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Display Options */}
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">{t("tenant.settings.bookingWidget.displayOptions")}</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="showPrices"
                    value="true"
                    defaultChecked={settings.showPrices}
                    className="rounded"
                  />
                  <span>{t("tenant.settings.bookingWidget.showPrices")}</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="showAvailability"
                    value="true"
                    defaultChecked={settings.showAvailability}
                    className="rounded"
                  />
                  <span>{t("tenant.settings.bookingWidget.showAvailability")}</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="showDescription"
                    value="true"
                    defaultChecked={settings.showDescription}
                    className="rounded"
                  />
                  <span>{t("tenant.settings.bookingWidget.showDescriptions")}</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50"
              >
                {isSubmitting ? t("common.saving") : t("tenant.settings.bookingWidget.saveSettings")}
              </button>
            </div>
          </fetcher.Form>
        </div>

        {/* Embed Code & Preview */}
        <div className="space-y-6">
          {/* Embed URL */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.settings.bookingWidget.directLink")}</h2>
            <p className="text-sm text-foreground-muted mb-3">
              {t("tenant.settings.bookingWidget.shareLink")}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={embedUrl}
                readOnly
                className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono bg-surface-inset"
              />
              <button
                onClick={() => copyToClipboard(embedUrl)}
                className="px-4 py-2 border rounded-lg hover:bg-surface-inset text-sm"
              >
                {copied ? t("tenant.settings.bookingWidget.copied") : t("tenant.settings.bookingWidget.copy")}
              </button>
            </div>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-brand hover:underline"
            >
              {t("tenant.settings.bookingWidget.previewInNewTab")} &rarr;
            </a>
          </div>

          {/* Embed Code */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.settings.bookingWidget.embedCode")}</h2>
            <p className="text-sm text-foreground-muted mb-3">
              {t("tenant.settings.bookingWidget.embedCodeDescription")}
            </p>
            <div className="relative">
              <pre className="bg-surface text-foreground p-4 rounded-lg text-sm overflow-x-auto border border-border">
                <code>{iframeCode}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(iframeCode)}
                className="absolute top-2 right-2 px-3 py-1 bg-surface-raised text-foreground rounded text-xs hover:bg-surface-overlay border border-border"
              >
                {copied ? t("tenant.settings.bookingWidget.copied") : t("tenant.settings.bookingWidget.copy")}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("tenant.settings.bookingWidget.preview")}</h2>
            <p className="text-sm text-foreground-muted mb-3">
              {t("tenant.settings.bookingWidget.previewDescription")}
            </p>
            <div className="border rounded-lg p-4 bg-surface text-center text-foreground-muted text-sm">
              <p className="mb-2">{t("tenant.settings.bookingWidget.widgetAvailableAt")}:</p>
              <a href={embedUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline break-all">
                {embedUrl}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
