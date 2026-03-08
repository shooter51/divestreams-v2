import type { ActionFunctionArgs } from "react-router";
import { useOutletContext, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { updatePublicSiteSettings } from "../../../../lib/db/public-site.server";
import type { PublicSiteSettings } from "../../../../lib/db/schema";
import { CsrfInput } from "../../../components/CsrfInput";
import { useT } from "../../../i18n/use-t";
type OutletContextType = {
  settings: PublicSiteSettings;
  orgSlug: string;
  isPremium: boolean;
  publicSiteUrl: string;
};

const themeColors: Record<string, string[]> = {
  ocean: ["#0ea5e9", "#0284c7", "#0369a1"],
  tropical: ["#14b8a6", "#0d9488", "#0f766e"],
  minimal: ["#6b7280", "#4b5563", "#374151"],
  dark: ["#1f2937", "#111827", "#0f172a"],
  classic: ["#1e3a5f", "#0c4a6e", "#b8860b"],
};

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-appearance") {
    const theme = (formData.get("theme") as PublicSiteSettings["theme"]) || "ocean";
    const primaryColor = (formData.get("primaryColor") as string) || "#0ea5e9";
    const secondaryColor = (formData.get("secondaryColor") as string) || "#06b6d4";
    const heroImageUrl = (formData.get("heroImageUrl") as string) || "";
    const fontFamily =
      (formData.get("fontFamily") as PublicSiteSettings["fontFamily"]) || "inter";

    // Validate hex colors
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexRegex.test(primaryColor) || !hexRegex.test(secondaryColor)) {
      return { success: false, error: "Invalid color format. Use hex format like #0ea5e9" };
    }

    // Validate theme
    const validThemes = ["ocean", "tropical", "minimal", "dark", "classic"];
    if (!validThemes.includes(theme)) {
      return { success: false, error: "Invalid theme selected" };
    }

    // Validate font family
    const validFonts = ["inter", "poppins", "roboto", "open-sans"];
    if (!validFonts.includes(fontFamily)) {
      return { success: false, error: "Invalid font family selected" };
    }

    await updatePublicSiteSettings(ctx.org.id, {
      theme,
      primaryColor,
      secondaryColor,
      fontFamily,
      heroImageUrl: heroImageUrl || null,
    });

    return { success: true, message: "Appearance settings updated successfully" };
  }

  return null;
}

export default function PublicSiteAppearanceSettings() {
  const t = useT();
  const themes = [
    { id: "ocean", name: "Ocean", description: t("tenant.settings.publicSite.appearance.themeOcean"), colors: themeColors.ocean },
    { id: "tropical", name: "Tropical", description: t("tenant.settings.publicSite.appearance.themeTropical"), colors: themeColors.tropical },
    { id: "minimal", name: "Minimal", description: t("tenant.settings.publicSite.appearance.themeMinimal"), colors: themeColors.minimal },
    { id: "dark", name: "Dark", description: t("tenant.settings.publicSite.appearance.themeDark"), colors: themeColors.dark },
    { id: "classic", name: "Classic", description: t("tenant.settings.publicSite.appearance.themeClassic"), colors: themeColors.classic },
  ];
  const fontFamilies = [
    { id: "inter", name: "Inter", sample: t("tenant.settings.publicSite.appearance.fontInter") },
    { id: "poppins", name: "Poppins", sample: t("tenant.settings.publicSite.appearance.fontPoppins") },
    { id: "roboto", name: "Roboto", sample: t("tenant.settings.publicSite.appearance.fontRoboto") },
    { id: "open-sans", name: "Open Sans", sample: t("tenant.settings.publicSite.appearance.fontOpenSans") },
  ];
  const { settings, publicSiteUrl } = useOutletContext<OutletContextType>();
  const fetcher = useFetcher<{ success?: boolean; message?: string; error?: string }>();
  const isSubmitting = fetcher.state === "submitting";

  // Local state for live previews
  const [theme, setTheme] = useState(settings.theme);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor);
  const [fontFamily, setFontFamily] = useState(settings.fontFamily);
  const [heroImageUrl, setHeroImageUrl] = useState(settings.heroImageUrl || "");

  // Update state when settings change (after save)
  useEffect(() => {
    setTheme(settings.theme);
    setPrimaryColor(settings.primaryColor);
    setSecondaryColor(settings.secondaryColor);
    setFontFamily(settings.fontFamily);
    setHeroImageUrl(settings.heroImageUrl || "");
  }, [settings]);

  // Update custom colors when theme changes
  const handleThemeChange = (newTheme: PublicSiteSettings["theme"]) => {
    setTheme(newTheme);

    // Find the theme and update colors to match its defaults
    const selectedTheme = themes.find(t => t.id === newTheme);
    if (selectedTheme && selectedTheme.colors.length >= 2) {
      setPrimaryColor(selectedTheme.colors[0]);
      setSecondaryColor(selectedTheme.colors[1]);
    }
  };

  return (
    <div className="space-y-6">
      {fetcher.data?.success && (
        <div className="bg-success-muted border border-success text-success px-4 py-3 rounded-lg max-w-4xl break-words">
          {fetcher.data.message}
        </div>
      )}

      {fetcher.data?.error && (
        <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg max-w-4xl break-words">
          {fetcher.data.error}
        </div>
      )}

      <fetcher.Form method="post">
        <CsrfInput />
        <input type="hidden" name="intent" value="update-appearance" />

        {/* Hero Image URL */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-2">{t("tenant.settings.publicSite.appearance.heroImage")}</h2>
          <p className="text-sm text-foreground-muted mb-4">
            {t("tenant.settings.publicSite.appearance.heroImageDescription")}
          </p>
          <div>
            <label htmlFor="heroImageUrl" className="block text-sm font-medium mb-1">
              {t("tenant.settings.publicSite.appearance.heroImageUrl")}
            </label>
            <input
              type="url"
              id="heroImageUrl"
              name="heroImageUrl"
              value={heroImageUrl}
              placeholder="https://images.unsplash.com/photo-..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              onChange={(e) => setHeroImageUrl(e.target.value)}
            />
            <p className="text-xs text-foreground-muted mt-1">
              {t("tenant.settings.publicSite.appearance.heroImageHint")}
            </p>
          </div>
          {heroImageUrl && (
            <div className="mt-4 rounded-lg overflow-hidden border border-border">
              <img
                src={heroImageUrl}
                alt={t("tenant.settings.publicSite.appearance.heroPreview")}
                className="w-full h-48 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        {/* Theme Selector */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-2">{t("tenant.settings.publicSite.appearance.theme")}</h2>
          <p className="text-sm text-foreground-muted mb-4">
            {t("tenant.settings.publicSite.appearance.themeDescription")}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {themes.map((themeOption) => (
              <label
                key={themeOption.id}
                className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:border-brand ${
                  theme === themeOption.id
                    ? "border-brand bg-brand-muted"
                    : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={themeOption.id}
                  checked={theme === themeOption.id}
                  onChange={(e) => handleThemeChange(e.target.value as PublicSiteSettings["theme"])}
                  className="sr-only"
                />
                <div className="flex gap-1 mb-3">
                  {themeOption.colors.map((color, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <p className="font-medium">{themeOption.name}</p>
                <p className="text-xs text-foreground-muted">{themeOption.description}</p>
                {theme === themeOption.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-brand rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Custom Colors */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-2">{t("tenant.settings.publicSite.appearance.customColors")}</h2>
          <p className="text-sm text-foreground-muted mb-4">
            {t("tenant.settings.publicSite.appearance.customColorsDescription")}
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="primaryColor" className="block text-sm font-medium mb-1">
                {t("tenant.settings.publicSite.appearance.primaryColor")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="primaryColorPicker"
                  value={primaryColor}
                  className="w-12 h-10 rounded cursor-pointer border-0 p-0"
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
                <input
                  type="text"
                  id="primaryColor"
                  name="primaryColor"
                  value={primaryColor}
                  placeholder="#0ea5e9"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand font-mono"
                  onChange={(e) => {
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                      setPrimaryColor(e.target.value);
                    }
                  }}
                />
              </div>
              <p className="text-xs text-foreground-muted mt-1">{t("tenant.settings.publicSite.appearance.primaryColorHint")}</p>
            </div>

            <div>
              <label htmlFor="secondaryColor" className="block text-sm font-medium mb-1">
                {t("tenant.settings.publicSite.appearance.secondaryColor")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="secondaryColorPicker"
                  value={secondaryColor}
                  className="w-12 h-10 rounded cursor-pointer border-0 p-0"
                  onChange={(e) => setSecondaryColor(e.target.value)}
                />
                <input
                  type="text"
                  id="secondaryColor"
                  name="secondaryColor"
                  value={secondaryColor}
                  placeholder="#06b6d4"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand font-mono"
                  onChange={(e) => {
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                      setSecondaryColor(e.target.value);
                    }
                  }}
                />
              </div>
              <p className="text-xs text-foreground-muted mt-1">{t("tenant.settings.publicSite.appearance.secondaryColorHint")}</p>
            </div>
          </div>

          {/* Color Preview */}
          <div className="mt-4 p-4 border rounded-lg bg-surface-inset">
            <p className="text-sm font-medium text-foreground-muted mb-3">{t("tenant.settings.publicSite.appearance.colorPreview")}</p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {t("tenant.settings.publicSite.appearance.primaryButton")}
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-white text-sm"
                style={{ backgroundColor: secondaryColor }}
              >
                {t("tenant.settings.publicSite.appearance.secondaryButton")}
              </button>
              <span className="text-sm" style={{ color: primaryColor }}>
                {t("tenant.settings.publicSite.appearance.primaryLink")}
              </span>
            </div>
          </div>
        </div>

        {/* Font Family */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-2">{t("tenant.settings.publicSite.appearance.fontFamily")}</h2>
          <p className="text-sm text-foreground-muted mb-4">{t("tenant.settings.publicSite.appearance.fontFamilyDescription")}</p>

          <div className="grid grid-cols-2 gap-4">
            {fontFamilies.map((font) => (
              <label
                key={font.id}
                className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:border-brand ${
                  fontFamily === font.id
                    ? "border-brand bg-brand-muted"
                    : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="fontFamily"
                  value={font.id}
                  checked={fontFamily === font.id}
                  onChange={(e) => setFontFamily(e.target.value as PublicSiteSettings["fontFamily"])}
                  className="sr-only"
                />
                <p
                  className="font-semibold text-lg"
                  style={{
                    fontFamily:
                      font.id === "inter"
                        ? "Inter, sans-serif"
                        : font.id === "poppins"
                        ? "Poppins, sans-serif"
                        : font.id === "roboto"
                        ? "Roboto, sans-serif"
                        : "Open Sans, sans-serif",
                  }}
                >
                  {font.name}
                </p>
                <p className="text-sm text-foreground-muted">{font.sample}</p>
                {fontFamily === font.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-brand rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Preview Button */}
        <div className="bg-surface-inset rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{t("tenant.settings.publicSite.appearance.previewYourSite")}</h2>
              <p className="text-sm text-foreground-muted">
                {t("tenant.settings.publicSite.appearance.previewDescription")}
              </p>
            </div>
            <a
              href={publicSiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-surface text-foreground rounded-lg hover:bg-surface-raised border border-border flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              {t("tenant.settings.publicSite.appearance.openPreview")}
            </a>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? t("common.saving") : t("tenant.settings.publicSite.appearance.saveAppearance")}
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}
