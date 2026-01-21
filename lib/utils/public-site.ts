/**
 * Public Site Utilities
 *
 * Utility functions for tenant public sites including URL generation,
 * price formatting, and settings management.
 */

import type { PublicSiteSettings, Organization } from "../db/schema/auth";
import { getBaseDomain } from "./url";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Get the main DiveStreams domain for the current environment
 */
function getMainDomain(): string {
  return getBaseDomain();
}

/**
 * Supported currencies with their formatting options
 */
const CURRENCY_CONFIG: Record<
  string,
  { locale: string; symbol: string; decimals: number }
> = {
  USD: { locale: "en-US", symbol: "$", decimals: 2 },
  EUR: { locale: "de-DE", symbol: "\u20ac", decimals: 2 },
  GBP: { locale: "en-GB", symbol: "\u00a3", decimals: 2 },
  AUD: { locale: "en-AU", symbol: "A$", decimals: 2 },
  CAD: { locale: "en-CA", symbol: "C$", decimals: 2 },
  THB: { locale: "th-TH", symbol: "\u0e3f", decimals: 0 },
  MXN: { locale: "es-MX", symbol: "MX$", decimals: 2 },
  IDR: { locale: "id-ID", symbol: "Rp", decimals: 0 },
  PHP: { locale: "fil-PH", symbol: "\u20b1", decimals: 2 },
  MYR: { locale: "ms-MY", symbol: "RM", decimals: 2 },
  SGD: { locale: "en-SG", symbol: "S$", decimals: 2 },
  NZD: { locale: "en-NZ", symbol: "NZ$", decimals: 2 },
  JPY: { locale: "ja-JP", symbol: "\u00a5", decimals: 0 },
  KRW: { locale: "ko-KR", symbol: "\u20a9", decimals: 0 },
  EGP: { locale: "ar-EG", symbol: "E\u00a3", decimals: 2 },
  ZAR: { locale: "en-ZA", symbol: "R", decimals: 2 },
  BRL: { locale: "pt-BR", symbol: "R$", decimals: 2 },
  COP: { locale: "es-CO", symbol: "COL$", decimals: 0 },
  CRC: { locale: "es-CR", symbol: "\u20a1", decimals: 0 },
};

// ============================================================================
// PRICE FORMATTING
// ============================================================================

/**
 * Format a price amount with currency symbol
 *
 * @param amount - Price amount (number or string)
 * @param currency - Currency code (default: USD)
 * @returns Formatted price string (e.g., "$99.00")
 */
export function formatPrice(
  amount: number | string | null | undefined,
  currency: string = "USD"
): string {
  // Handle null/undefined
  if (amount == null) {
    return formatPrice(0, currency);
  }

  // Convert string to number if needed
  const numericAmount =
    typeof amount === "string" ? parseFloat(amount) : amount;

  // Handle NaN
  if (isNaN(numericAmount)) {
    return formatPrice(0, currency);
  }

  // Get currency config, default to USD format
  const config = CURRENCY_CONFIG[currency.toUpperCase()] ?? CURRENCY_CONFIG.USD;

  try {
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    }).format(numericAmount);
  } catch {
    // Fallback for unsupported currencies
    return `${config.symbol}${numericAmount.toFixed(config.decimals)}`;
  }
}

/**
 * Format a price range (min - max)
 *
 * @param minAmount - Minimum price
 * @param maxAmount - Maximum price
 * @param currency - Currency code
 * @returns Formatted price range (e.g., "$50.00 - $100.00")
 */
export function formatPriceRange(
  minAmount: number | string,
  maxAmount: number | string,
  currency: string = "USD"
): string {
  const min =
    typeof minAmount === "string" ? parseFloat(minAmount) : minAmount;
  const max =
    typeof maxAmount === "string" ? parseFloat(maxAmount) : maxAmount;

  if (min === max) {
    return formatPrice(min, currency);
  }

  return `${formatPrice(min, currency)} - ${formatPrice(max, currency)}`;
}

// ============================================================================
// URL GENERATION
// ============================================================================

/**
 * Get the public site URL for an organization
 *
 * @param org - Organization object with slug and customDomain
 * @returns Full URL for the organization's public site
 */
export function getPublicSiteUrl(
  org: Pick<Organization, "slug" | "customDomain">
): string {
  // Prefer custom domain if set
  if (org.customDomain) {
    return `https://${org.customDomain}`;
  }

  // Use subdomain
  return `https://${org.slug}.${getMainDomain()}`;
}

/**
 * Get a specific page URL on the public site
 *
 * @param org - Organization object
 * @param path - Page path (e.g., "/trips", "/about")
 * @returns Full URL for the page
 */
export function getPublicSitePageUrl(
  org: Pick<Organization, "slug" | "customDomain">,
  path: string
): string {
  const baseUrl = getPublicSiteUrl(org);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Get the booking widget URL for an organization
 *
 * @param org - Organization object
 * @returns URL for the embeddable booking widget
 */
export function getBookingWidgetUrl(
  org: Pick<Organization, "slug">
): string {
  return `https://${getMainDomain()}/embed/${org.slug}`;
}

// ============================================================================
// PUBLIC SITE STATUS
// ============================================================================

/**
 * Check if the public site is enabled for an organization
 *
 * @param org - Organization object with publicSiteSettings
 * @returns True if the public site is enabled
 */
export function isPublicSiteEnabled(
  org: Pick<Organization, "publicSiteSettings">
): boolean {
  return org.publicSiteSettings?.enabled === true;
}

/**
 * Check if a specific page is enabled on the public site
 *
 * @param org - Organization object with publicSiteSettings
 * @param page - Page key from publicSiteSettings.pages
 * @returns True if the page is enabled
 */
export function isPageEnabled(
  org: Pick<Organization, "publicSiteSettings">,
  page: keyof NonNullable<PublicSiteSettings>["pages"]
): boolean {
  if (!org.publicSiteSettings?.enabled) {
    return false;
  }
  return org.publicSiteSettings.pages?.[page] === true;
}

/**
 * Get list of enabled pages for navigation
 *
 * @param org - Organization object with publicSiteSettings
 * @returns Array of enabled page names
 */
export function getEnabledPages(
  org: Pick<Organization, "publicSiteSettings">
): Array<keyof NonNullable<PublicSiteSettings>["pages"]> {
  if (!org.publicSiteSettings?.enabled || !org.publicSiteSettings.pages) {
    return [];
  }

  const pages = org.publicSiteSettings.pages;
  const enabledPages: Array<keyof typeof pages> = [];

  (Object.keys(pages) as Array<keyof typeof pages>).forEach((key) => {
    if (pages[key]) {
      enabledPages.push(key);
    }
  });

  return enabledPages;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

/**
 * Get default public site settings
 *
 * @returns Default PublicSiteSettings object
 */
export function getDefaultSiteSettings(): PublicSiteSettings {
  return {
    enabled: false,
    theme: "ocean",
    primaryColor: "#0077B6",
    secondaryColor: "#00B4D8",
    logoUrl: null,
    heroImageUrl: null,
    heroVideoUrl: null,
    fontFamily: "inter",
    pages: {
      home: true,
      about: false,
      trips: true,
      courses: false,
      equipment: false,
      contact: true,
      gallery: false,
    },
    aboutContent: null,
    contactInfo: null,
  };
}

/**
 * Merge partial settings with defaults
 *
 * @param settings - Partial settings to merge
 * @returns Complete PublicSiteSettings with defaults filled in
 */
export function mergeWithDefaults(
  settings: Partial<PublicSiteSettings> | null | undefined
): PublicSiteSettings {
  const defaults = getDefaultSiteSettings();

  if (!settings) {
    return defaults;
  }

  return {
    enabled: settings.enabled ?? defaults.enabled,
    theme: settings.theme ?? defaults.theme,
    primaryColor: settings.primaryColor ?? defaults.primaryColor,
    secondaryColor: settings.secondaryColor ?? defaults.secondaryColor,
    logoUrl: settings.logoUrl ?? defaults.logoUrl,
    heroImageUrl: settings.heroImageUrl ?? defaults.heroImageUrl,
    heroVideoUrl: settings.heroVideoUrl ?? defaults.heroVideoUrl,
    fontFamily: settings.fontFamily ?? defaults.fontFamily,
    pages: {
      home: settings.pages?.home ?? defaults.pages.home,
      about: settings.pages?.about ?? defaults.pages.about,
      trips: settings.pages?.trips ?? defaults.pages.trips,
      courses: settings.pages?.courses ?? defaults.pages.courses,
      equipment: settings.pages?.equipment ?? defaults.pages.equipment,
      contact: settings.pages?.contact ?? defaults.pages.contact,
      gallery: settings.pages?.gallery ?? defaults.pages.gallery,
    },
    aboutContent: settings.aboutContent ?? defaults.aboutContent,
    contactInfo: settings.contactInfo ?? defaults.contactInfo,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a custom domain format
 *
 * @param domain - Domain to validate
 * @returns True if valid domain format
 */
export function isValidCustomDomain(domain: string): boolean {
  // Basic domain validation regex
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

  // Check format
  if (!domainRegex.test(domain)) {
    return false;
  }

  // Disallow divestreams.com domains as custom domains
  if (domain.endsWith(`.${getMainDomain()}`) || domain === getMainDomain()) {
    return false;
  }

  return true;
}

/**
 * Validate organization slug format
 *
 * @param slug - Slug to validate
 * @returns True if valid slug format
 */
export function isValidSlug(slug: string): boolean {
  // Slugs must be lowercase alphanumeric with optional hyphens
  // Must start and end with alphanumeric
  // 3-63 characters (subdomain limits)
  const slugRegex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
  return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 63;
}

// ============================================================================
// MISCELLANEOUS
// ============================================================================

/**
 * Generate a shareable booking link for a specific trip
 *
 * @param org - Organization object
 * @param tripId - Trip ID
 * @returns Full URL for booking a specific trip
 */
export function getTripBookingUrl(
  org: Pick<Organization, "slug" | "customDomain">,
  tripId: string
): string {
  return getPublicSitePageUrl(org, `/trips/${tripId}/book`);
}

/**
 * Get social sharing URLs for a public site page
 *
 * @param pageUrl - Full URL of the page to share
 * @param title - Page title for sharing
 * @returns Object with social sharing URLs
 */
export function getSocialShareUrls(
  pageUrl: string,
  title: string
): {
  facebook: string;
  twitter: string;
  whatsapp: string;
  email: string;
} {
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedTitle = encodeURIComponent(title);

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
  };
}
