/**
 * Public Site Utilities Tests
 *
 * Comprehensive tests for public site utility functions including price formatting,
 * URL generation, settings management, and validation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  formatPrice,
  formatPriceRange,
  getPublicSiteUrl,
  getPublicSitePageUrl,
  getBookingWidgetUrl,
  isPublicSiteEnabled,
  isPageEnabled,
  getEnabledPages,
  getDefaultSiteSettings,
  mergeWithDefaults,
  isValidCustomDomain,
  isValidSlug,
  getTripBookingUrl,
  getSocialShareUrls,
} from "../../../../lib/utils/public-site";
import type { PublicSiteSettings, Organization } from "../../../../lib/db/schema/auth";

describe("Public Site Utilities", () => {
  beforeEach(() => {
    // Set APP_URL for consistent test expectations
    process.env.APP_URL = "https://divestreams.com";
  });
  describe("formatPrice", () => {
    it("should format USD price correctly", () => {
      expect(formatPrice(99.99, "USD")).toBe("$99.99");
    });

    it("should format EUR price correctly", () => {
      expect(formatPrice(99.99, "EUR")).toMatch(/99[.,]99/);
    });

    it("should format GBP price correctly", () => {
      expect(formatPrice(99.99, "GBP")).toMatch(/99[.,]99/);
    });

    it("should format zero-decimal currencies (JPY)", () => {
      expect(formatPrice(1000, "JPY")).toMatch(/1[,.]000/);
    });

    it("should format zero-decimal currencies (KRW)", () => {
      expect(formatPrice(50000, "KRW")).toMatch(/50[,.]000/);
    });

    it("should handle null amount", () => {
      expect(formatPrice(null, "USD")).toBe("$0.00");
    });

    it("should handle undefined amount", () => {
      expect(formatPrice(undefined, "USD")).toBe("$0.00");
    });

    it("should handle string amount", () => {
      expect(formatPrice("99.99", "USD")).toBe("$99.99");
    });

    it("should handle NaN string", () => {
      expect(formatPrice("invalid", "USD")).toBe("$0.00");
    });

    it("should default to USD for unknown currency", () => {
      const result = formatPrice(99.99, "UNKNOWN");
      expect(result).toContain("99.99");
    });

    it("should handle case-insensitive currency codes", () => {
      expect(formatPrice(99.99, "usd")).toBe("$99.99");
    });

    it("should format THB without decimals", () => {
      expect(formatPrice(1500, "THB")).toMatch(/1[,.]500/);
    });

    it("should format IDR without decimals", () => {
      expect(formatPrice(150000, "IDR")).toMatch(/150[,.]000/);
    });

    it("should handle large numbers", () => {
      const result = formatPrice(1000000, "USD");
      expect(result).toContain("1");
      expect(result).toContain("000");
    });

    it("should handle negative amounts", () => {
      const result = formatPrice(-50, "USD");
      expect(result).toContain("-");
      expect(result).toContain("50");
    });
  });

  describe("formatPriceRange", () => {
    it("should format price range with different min/max", () => {
      expect(formatPriceRange(50, 100, "USD")).toBe("$50.00 - $100.00");
    });

    it("should format single price when min equals max", () => {
      expect(formatPriceRange(75, 75, "USD")).toBe("$75.00");
    });

    it("should handle string amounts", () => {
      expect(formatPriceRange("50", "100", "USD")).toBe("$50.00 - $100.00");
    });

    it("should work with EUR", () => {
      const result = formatPriceRange(50, 100, "EUR");
      expect(result).toContain("50");
      expect(result).toContain("100");
      expect(result).toContain("-");
    });

    it("should handle zero-decimal currencies in range", () => {
      const result = formatPriceRange(1000, 5000, "JPY");
      expect(result).toContain("1");
      expect(result).toContain("5");
    });
  });

  describe("getPublicSiteUrl", () => {
    it("should use custom domain when set", () => {
      const org: Pick<Organization, "slug" | "customDomain"> = {
        slug: "dive-shop",
        customDomain: "www.myshop.com",
      };
      expect(getPublicSiteUrl(org)).toBe("https://www.myshop.com");
    });

    it("should use subdomain when custom domain not set", () => {
      const org: Pick<Organization, "slug" | "customDomain"> = {
        slug: "dive-shop",
        customDomain: null,
      };
      expect(getPublicSiteUrl(org)).toBe("https://dive-shop.divestreams.com");
    });

    it("should handle empty custom domain", () => {
      const org: Pick<Organization, "slug" | "customDomain"> = {
        slug: "dive-shop",
        customDomain: "",
      };
      expect(getPublicSiteUrl(org)).toBe("https://dive-shop.divestreams.com");
    });
  });

  describe("getPublicSitePageUrl", () => {
    it("should generate page URL with leading slash", () => {
      const org: Pick<Organization, "slug" | "customDomain"> = {
        slug: "dive-shop",
        customDomain: null,
      };
      expect(getPublicSitePageUrl(org, "/trips")).toBe("https://dive-shop.divestreams.com/trips");
    });

    it("should add leading slash if missing", () => {
      const org: Pick<Organization, "slug" | "customDomain"> = {
        slug: "dive-shop",
        customDomain: null,
      };
      expect(getPublicSitePageUrl(org, "trips")).toBe("https://dive-shop.divestreams.com/trips");
    });

    it("should work with custom domain", () => {
      const org: Pick<Organization, "slug" | "customDomain"> = {
        slug: "dive-shop",
        customDomain: "www.myshop.com",
      };
      expect(getPublicSitePageUrl(org, "/about")).toBe("https://www.myshop.com/about");
    });

    it("should handle nested paths", () => {
      const org: Pick<Organization, "slug" | "customDomain"> = {
        slug: "dive-shop",
        customDomain: null,
      };
      expect(getPublicSitePageUrl(org, "/trips/reef-diving")).toBe(
        "https://dive-shop.divestreams.com/trips/reef-diving"
      );
    });
  });

  describe("getBookingWidgetUrl", () => {
    it("should generate booking widget URL", () => {
      const org: Pick<Organization, "slug"> = { slug: "dive-shop" };
      expect(getBookingWidgetUrl(org)).toBe("https://divestreams.com/embed/dive-shop");
    });

    it("should handle different slugs", () => {
      const org: Pick<Organization, "slug"> = { slug: "ocean-divers" };
      expect(getBookingWidgetUrl(org)).toBe("https://divestreams.com/embed/ocean-divers");
    });
  });

  describe("isPublicSiteEnabled", () => {
    it("should return true when enabled", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: { enabled: true } as PublicSiteSettings,
      };
      expect(isPublicSiteEnabled(org)).toBe(true);
    });

    it("should return false when disabled", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: { enabled: false } as PublicSiteSettings,
      };
      expect(isPublicSiteEnabled(org)).toBe(false);
    });

    it("should return false when publicSiteSettings is null", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: null,
      };
      expect(isPublicSiteEnabled(org)).toBe(false);
    });

    it("should return false when publicSiteSettings is undefined", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: undefined,
      };
      expect(isPublicSiteEnabled(org)).toBe(false);
    });
  });

  describe("isPageEnabled", () => {
    it("should return true when page is enabled", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: {
          enabled: true,
          pages: { home: true, about: false },
        } as PublicSiteSettings,
      };
      expect(isPageEnabled(org, "home")).toBe(true);
    });

    it("should return false when page is disabled", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: {
          enabled: true,
          pages: { home: true, about: false },
        } as PublicSiteSettings,
      };
      expect(isPageEnabled(org, "about")).toBe(false);
    });

    it("should return false when public site is disabled", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: {
          enabled: false,
          pages: { home: true },
        } as PublicSiteSettings,
      };
      expect(isPageEnabled(org, "home")).toBe(false);
    });

    it("should return false when pages object is missing", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: { enabled: true } as PublicSiteSettings,
      };
      expect(isPageEnabled(org, "home")).toBe(false);
    });

    it("should return false when publicSiteSettings is null", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: null,
      };
      expect(isPageEnabled(org, "home")).toBe(false);
    });
  });

  describe("getEnabledPages", () => {
    it("should return enabled pages", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: {
          enabled: true,
          pages: {
            home: true,
            about: false,
            trips: true,
            courses: false,
            equipment: false,
            contact: true,
            gallery: false,
          },
        } as PublicSiteSettings,
      };
      const enabled = getEnabledPages(org);
      expect(enabled).toContain("home");
      expect(enabled).toContain("trips");
      expect(enabled).toContain("contact");
      expect(enabled).not.toContain("about");
      expect(enabled).not.toContain("courses");
    });

    it("should return empty array when public site is disabled", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: {
          enabled: false,
          pages: { home: true, trips: true },
        } as PublicSiteSettings,
      };
      expect(getEnabledPages(org)).toEqual([]);
    });

    it("should return empty array when pages object is missing", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: { enabled: true } as PublicSiteSettings,
      };
      expect(getEnabledPages(org)).toEqual([]);
    });

    it("should return empty array when publicSiteSettings is null", () => {
      const org: Pick<Organization, "publicSiteSettings"> = {
        publicSiteSettings: null,
      };
      expect(getEnabledPages(org)).toEqual([]);
    });
  });

  describe("getDefaultSiteSettings", () => {
    it("should return default settings object", () => {
      const defaults = getDefaultSiteSettings();
      expect(defaults.enabled).toBe(false);
      expect(defaults.theme).toBe("ocean");
      expect(defaults.primaryColor).toBe("#0077B6");
      expect(defaults.fontFamily).toBe("inter");
    });

    it("should include default pages", () => {
      const defaults = getDefaultSiteSettings();
      expect(defaults.pages.home).toBe(true);
      expect(defaults.pages.trips).toBe(true);
      expect(defaults.pages.contact).toBe(true);
      expect(defaults.pages.about).toBe(false);
    });

    it("should have null for optional fields", () => {
      const defaults = getDefaultSiteSettings();
      expect(defaults.logoUrl).toBeNull();
      expect(defaults.heroImageUrl).toBeNull();
      expect(defaults.aboutContent).toBeNull();
      expect(defaults.contactInfo).toBeNull();
    });
  });

  describe("mergeWithDefaults", () => {
    it("should merge partial settings with defaults", () => {
      const partial: Partial<PublicSiteSettings> = {
        enabled: true,
        primaryColor: "#FF0000",
      };
      const merged = mergeWithDefaults(partial);
      expect(merged.enabled).toBe(true);
      expect(merged.primaryColor).toBe("#FF0000");
      expect(merged.theme).toBe("ocean"); // Default
      expect(merged.fontFamily).toBe("inter"); // Default
    });

    it("should handle null settings", () => {
      const merged = mergeWithDefaults(null);
      expect(merged).toEqual(getDefaultSiteSettings());
    });

    it("should handle undefined settings", () => {
      const merged = mergeWithDefaults(undefined);
      expect(merged).toEqual(getDefaultSiteSettings());
    });

    it("should merge pages object", () => {
      const partial: Partial<PublicSiteSettings> = {
        pages: { home: true, about: true },
      };
      const merged = mergeWithDefaults(partial);
      expect(merged.pages.home).toBe(true);
      expect(merged.pages.about).toBe(true);
      expect(merged.pages.trips).toBe(true); // Default
    });

    it("should override all fields when provided", () => {
      const custom: Partial<PublicSiteSettings> = {
        enabled: true,
        theme: "tropical",
        primaryColor: "#00FF00",
        secondaryColor: "#0000FF",
        logoUrl: "https://example.com/logo.png",
        heroImageUrl: "https://example.com/hero.jpg",
        fontFamily: "roboto",
      };
      const merged = mergeWithDefaults(custom);
      expect(merged.enabled).toBe(true);
      expect(merged.theme).toBe("tropical");
      expect(merged.primaryColor).toBe("#00FF00");
      expect(merged.logoUrl).toBe("https://example.com/logo.png");
    });
  });

  describe("isValidCustomDomain", () => {
    it("should accept valid domain", () => {
      expect(isValidCustomDomain("www.example.com")).toBe(true);
    });

    it("should accept domain without www", () => {
      expect(isValidCustomDomain("example.com")).toBe(true);
    });

    it("should accept subdomain", () => {
      expect(isValidCustomDomain("shop.example.com")).toBe(true);
    });

    it("should reject divestreams.com subdomain", () => {
      expect(isValidCustomDomain("shop.divestreams.com")).toBe(false);
    });

    it("should reject divestreams.com itself", () => {
      expect(isValidCustomDomain("divestreams.com")).toBe(false);
    });

    it("should reject invalid format", () => {
      expect(isValidCustomDomain("invalid domain")).toBe(false);
    });

    it("should reject domain with spaces", () => {
      expect(isValidCustomDomain("example .com")).toBe(false);
    });

    it("should reject single word", () => {
      expect(isValidCustomDomain("localhost")).toBe(false);
    });

    it("should accept multi-level subdomain", () => {
      expect(isValidCustomDomain("shop.my.example.com")).toBe(true);
    });

    it("should reject domain with special characters", () => {
      expect(isValidCustomDomain("example$.com")).toBe(false);
    });

    it("should accept domain with hyphens", () => {
      expect(isValidCustomDomain("my-shop.example.com")).toBe(true);
    });

    it("should reject domain starting with hyphen", () => {
      expect(isValidCustomDomain("-example.com")).toBe(false);
    });

    it("should reject domain ending with hyphen", () => {
      expect(isValidCustomDomain("example-.com")).toBe(false);
    });
  });

  describe("isValidSlug", () => {
    it("should accept valid lowercase slug", () => {
      expect(isValidSlug("dive-shop")).toBe(true);
    });

    it("should accept slug with numbers", () => {
      expect(isValidSlug("shop123")).toBe(true);
    });

    it("should accept slug with hyphens", () => {
      expect(isValidSlug("my-dive-shop")).toBe(true);
    });

    it("should reject uppercase letters", () => {
      expect(isValidSlug("DiveShop")).toBe(false);
    });

    it("should reject slug with spaces", () => {
      expect(isValidSlug("dive shop")).toBe(false);
    });

    it("should reject slug with underscores", () => {
      expect(isValidSlug("dive_shop")).toBe(false);
    });

    it("should reject slug starting with hyphen", () => {
      expect(isValidSlug("-diveshop")).toBe(false);
    });

    it("should reject slug ending with hyphen", () => {
      expect(isValidSlug("diveshop-")).toBe(false);
    });

    it("should reject slug shorter than 3 characters", () => {
      expect(isValidSlug("ab")).toBe(false);
    });

    it("should accept slug with 3 characters", () => {
      expect(isValidSlug("abc")).toBe(true);
    });

    it("should accept slug with 63 characters", () => {
      const slug = "a".repeat(63);
      expect(isValidSlug(slug)).toBe(true);
    });

    it("should reject slug longer than 63 characters", () => {
      const slug = "a".repeat(64);
      expect(isValidSlug(slug)).toBe(false);
    });

    it("should reject slug with special characters", () => {
      expect(isValidSlug("shop@123")).toBe(false);
    });

    it("should reject empty slug", () => {
      expect(isValidSlug("")).toBe(false);
    });
  });

  describe("getTripBookingUrl", () => {
    it("should generate trip booking URL with subdomain", () => {
      const org: Pick<Organization, "slug" | "customDomain"> = {
        slug: "dive-shop",
        customDomain: null,
      };
      expect(getTripBookingUrl(org, "trip-123")).toBe(
        "https://dive-shop.divestreams.com/trips/trip-123/book"
      );
    });

    it("should generate trip booking URL with custom domain", () => {
      const org: Pick<Organization, "slug" | "customDomain"> = {
        slug: "dive-shop",
        customDomain: "www.myshop.com",
      };
      expect(getTripBookingUrl(org, "trip-456")).toBe(
        "https://www.myshop.com/trips/trip-456/book"
      );
    });
  });

  describe("getSocialShareUrls", () => {
    it("should generate Facebook share URL", () => {
      const urls = getSocialShareUrls("https://example.com/page", "My Page");
      expect(urls.facebook).toContain("facebook.com/sharer");
      expect(urls.facebook).toContain(encodeURIComponent("https://example.com/page"));
    });

    it("should generate Twitter share URL", () => {
      const urls = getSocialShareUrls("https://example.com/page", "My Page");
      expect(urls.twitter).toContain("twitter.com/intent/tweet");
      expect(urls.twitter).toContain(encodeURIComponent("https://example.com/page"));
      expect(urls.twitter).toContain(encodeURIComponent("My Page"));
    });

    it("should generate WhatsApp share URL", () => {
      const urls = getSocialShareUrls("https://example.com/page", "My Page");
      expect(urls.whatsapp).toContain("wa.me");
      expect(urls.whatsapp).toContain(encodeURIComponent("My Page"));
    });

    it("should generate Email share URL", () => {
      const urls = getSocialShareUrls("https://example.com/page", "My Page");
      expect(urls.email).toContain("mailto:");
      expect(urls.email).toContain("subject=");
      expect(urls.email).toContain("body=");
    });

    it("should properly encode special characters in URL", () => {
      const urls = getSocialShareUrls("https://example.com/page?param=value", "Title & More");
      expect(urls.facebook).toContain(encodeURIComponent("https://example.com/page?param=value"));
      expect(urls.twitter).toContain(encodeURIComponent("Title & More"));
    });
  });
});
