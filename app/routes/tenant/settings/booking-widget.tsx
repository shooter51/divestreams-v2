import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { organization } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { getAppUrl } from "../../../../lib/utils/url";

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
  primaryColor: "#2563eb",
  buttonText: "Book Now",
  showPrices: true,
  showAvailability: true,
  showDescription: true,
  layout: "grid",
  maxTripsShown: 6,
};

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

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
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Booking Widget</h1>
        <p className="text-foreground-muted">Customize and embed your booking widget on any website</p>
      </div>

      {fetcher.data?.success && (
        <div className="bg-success-muted border border-success-muted text-success px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          Settings saved successfully!
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Settings Form */}
        <div>
          <fetcher.Form method="post" className="space-y-6">
            {/* Appearance */}
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Appearance</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Primary Color
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
                    Button Text
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
                    Layout
                  </label>
                  <select
                    name="layout"
                    defaultValue={settings.layout}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="grid">Grid View</option>
                    <option value="list">List View</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Max Trips Shown
                  </label>
                  <select
                    name="maxTripsShown"
                    defaultValue={settings.maxTripsShown}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="3">3 trips</option>
                    <option value="6">6 trips</option>
                    <option value="9">9 trips</option>
                    <option value="12">12 trips</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Display Options */}
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Display Options</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="showPrices"
                    value="true"
                    defaultChecked={settings.showPrices}
                    className="rounded"
                  />
                  <span>Show prices</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="showAvailability"
                    value="true"
                    defaultChecked={settings.showAvailability}
                    className="rounded"
                  />
                  <span>Show availability</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="showDescription"
                    value="true"
                    defaultChecked={settings.showDescription}
                    className="rounded"
                  />
                  <span>Show trip descriptions</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </fetcher.Form>
        </div>

        {/* Embed Code & Preview */}
        <div className="space-y-6">
          {/* Embed URL */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Direct Link</h2>
            <p className="text-sm text-foreground-muted mb-3">
              Share this link directly with customers:
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
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-brand hover:underline"
            >
              Preview in new tab &rarr;
            </a>
          </div>

          {/* Embed Code */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Embed Code</h2>
            <p className="text-sm text-foreground-muted mb-3">
              Copy this code to embed the booking widget on your website:
            </p>
            <div className="relative">
              <pre className="bg-surface text-foreground p-4 rounded-lg text-sm overflow-x-auto border border-border">
                <code>{iframeCode}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(iframeCode)}
                className="absolute top-2 right-2 px-3 py-1 bg-surface-raised text-foreground rounded text-xs hover:bg-surface-overlay border border-border"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Preview</h2>
            <div className="border rounded-lg overflow-hidden" style={{ height: "400px" }}>
              <iframe
                src={embedUrl}
                width="100%"
                height="100%"
                style={{ border: "none" }}
                title="Widget Preview"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
