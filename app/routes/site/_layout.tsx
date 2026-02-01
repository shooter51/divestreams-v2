/**
 * Public Site Layout
 *
 * Layout component for tenant public sites accessed via subdomain or custom domain.
 * Handles tenant resolution, theme application, and site navigation.
 */

import { Outlet, Link, useLoaderData, useLocation, Form } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { eq, or } from "drizzle-orm";
import { db } from "../../../lib/db";
import { organization, type PublicSiteSettings } from "../../../lib/db/schema/auth";
import type { Customer } from "../../../lib/db/schema";
import { getTheme, getThemeStyleBlock, type ThemeName } from "../../../lib/themes/public-site-themes";
import { getCustomerBySession } from "../../../lib/auth/customer-auth.server";

// ============================================================================
// THEME CSS VARIABLES
// ============================================================================

/**
 * Theme presets with CSS variable values
 * NOTE: This is now derived from the main theme system in lib/themes/public-site-themes.ts
 * which includes proper dark mode support via @media (prefers-color-scheme: dark)
 */
const themePresets: Record<
  PublicSiteSettings["theme"],
  { primary: string; secondary: string; background: string; text: string; accent: string }
> = {
  ocean: {
    primary: "#0077B6",      // Deep ocean blue
    secondary: "#00B4D8",    // Bright cyan
    background: "#F0F9FF",   // Very light blue tint
    text: "#1E3A5F",         // Dark navy text
    accent: "#90E0EF",       // Light seafoam
  },
  tropical: {
    primary: "#20B2AA",      // Light sea green
    secondary: "#3CB371",    // Medium sea green
    background: "#F0FFF4",   // Mint cream background
    text: "#1A4D2E",         // Dark forest text
    accent: "#FFD700",       // Golden yellow (sun)
  },
  minimal: {
    primary: "#374151",      // Gray-700
    secondary: "#6B7280",    // Gray-500
    background: "#FFFFFF",   // Pure white
    text: "#1F2937",         // Gray-800 text
    accent: "#3B82F6",       // Blue-500 accent
  },
  dark: {
    primary: "#60A5FA",      // Blue-400
    secondary: "#818CF8",    // Indigo-400
    background: "#0F172A",   // Slate-900
    text: "#F1F5F9",         // Slate-100 text
    accent: "#34D399",       // Emerald-400
  },
  classic: {
    primary: "#1E3A5F",      // Navy blue
    secondary: "#2C5282",    // Lighter navy
    background: "#FFFBF0",   // Warm white background
    text: "#1A202C",         // Near black text
    accent: "#D4A942",       // Gold accent
  },
};

/**
 * Font family CSS values
 */
const fontFamilies: Record<PublicSiteSettings["fontFamily"], string> = {
  inter: "'Inter', system-ui, sans-serif",
  poppins: "'Poppins', system-ui, sans-serif",
  roboto: "'Roboto', system-ui, sans-serif",
  "open-sans": "'Open Sans', system-ui, sans-serif",
};

// ============================================================================
// SUBDOMAIN RESOLUTION
// ============================================================================

/**
 * Extract subdomain from request host
 */
function getSubdomainFromHost(host: string): string | null {
  // Handle localhost development: subdomain.localhost:5173
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0].toLowerCase();
    }
    return null;
  }

  // Handle production: subdomain.divestreams.com
  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    // Ignore www and admin as they're not tenant subdomains
    if (subdomain === "www" || subdomain === "admin") {
      return null;
    }
    return subdomain;
  }

  return null;
}

// ============================================================================
// LOADER
// ============================================================================

export interface SiteLoaderData {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  };
  settings: PublicSiteSettings;
  themeVars: {
    fontFamily: string;
  };
  darkCSS: string;
  enabledPages: {
    home: boolean;
    about: boolean;
    trips: boolean;
    courses: boolean;
    equipment: boolean;
    contact: boolean;
    gallery: boolean;
  };
  contactInfo: PublicSiteSettings["contactInfo"];
  customer: Customer | null;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<SiteLoaderData> {
  const url = new URL(request.url);
  const host = url.host;

  // Try subdomain first
  const subdomain = getSubdomainFromHost(host);

  // Find organization by subdomain or custom domain
  let org;

  if (subdomain) {
    // Look up by subdomain (slug)
    [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);
  } else {
    // Try custom domain lookup (full host without port)
    const customDomain = host.split(":")[0];
    [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.customDomain, customDomain))
      .limit(1);
  }

  // No organization found - show 404
  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  // Get public site settings with defaults
  const defaultSettings: PublicSiteSettings = {
    enabled: false,
    theme: "ocean",
    primaryColor: "",
    secondaryColor: "",
    logoUrl: null,
    heroImageUrl: null,
    heroVideoUrl: null,
    fontFamily: "inter",
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
  };

  const settings: PublicSiteSettings = org.publicSiteSettings
    ? { ...defaultSettings, ...org.publicSiteSettings }
    : defaultSettings;

  // Check if public site is enabled
  if (!settings.enabled) {
    // Redirect to disabled site message with organization name
    throw redirect(`/site-disabled?org=${encodeURIComponent(org.name)}`);
  }

  // Font family setting (only non-color variable needed in themeVars)
  const themeVars = {
    fontFamily: fontFamilies[settings.fontFamily],
  };

  // Generate light + dark mode CSS from the full theme system
  // This includes @media (prefers-color-scheme: dark) overrides
  // All color variables are set here and automatically adapt to system dark mode
  const fullTheme = getTheme(settings.theme as ThemeName);
  const darkCSS = getThemeStyleBlock(fullTheme, {
    primaryColor: settings.primaryColor || undefined,
    secondaryColor: settings.secondaryColor || undefined,
  });

  // Check for customer session
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").filter(Boolean).map((c) => {
      const [key, ...rest] = c.split("=");
      return [key, rest.join("=")];
    })
  );

  const sessionToken = cookies["customer_session"];
  let customer: Customer | null = null;

  if (sessionToken) {
    customer = await getCustomerBySession(sessionToken);
  }

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: settings.logoUrl || org.logo,
    },
    settings,
    themeVars,
    darkCSS,
    enabledPages: settings.pages,
    contactInfo: settings.contactInfo,
    customer,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SiteLayout() {
  const { organization, themeVars, enabledPages, contactInfo, darkCSS, customer } =
    useLoaderData<typeof loader>();
  const location = useLocation();

  // Build navigation items based on enabled pages
  const navItems: { href: string; label: string }[] = [];

  if (enabledPages.home) {
    navItems.push({ href: "/site", label: "Home" });
  }
  if (enabledPages.about) {
    navItems.push({ href: "/site/about", label: "About" });
  }
  if (enabledPages.trips) {
    navItems.push({ href: "/site/trips", label: "Trips" });
  }
  if (enabledPages.courses) {
    navItems.push({ href: "/site/courses", label: "Courses" });
  }
  if (enabledPages.equipment) {
    navItems.push({ href: "/site/equipment", label: "Equipment" });
  }
  if (enabledPages.gallery) {
    navItems.push({ href: "/site/gallery", label: "Gallery" });
  }
  if (enabledPages.contact) {
    navItems.push({ href: "/site/contact", label: "Contact" });
  }

  // Check if a nav item is active
  const isActive = (href: string) => {
    if (href === "/site") {
      return location.pathname === "/site" || location.pathname === "/site/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div
      className="site-theme min-h-screen flex flex-col"
      style={{
        backgroundColor: "var(--background-color)",
        color: "var(--text-color)",
        fontFamily: themeVars.fontFamily,
      }}
    >
      {/* Theme CSS variables (light + dark mode via prefers-color-scheme) */}
      <style dangerouslySetInnerHTML={{ __html: darkCSS }} />
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b shadow-sm"
        style={{
          backgroundColor: "var(--color-card-bg)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Brand */}
            <Link to="/site" className="flex items-center gap-3">
              {organization.logo ? (
                <img
                  src={organization.logo}
                  alt={organization.name}
                  className="h-10 w-auto"
                />
              ) : (
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: "var(--primary-color)" }}
                >
                  {organization.name.charAt(0)}
                </div>
              )}
              <span
                className="text-xl font-semibold hidden sm:block"
                style={{ color: "var(--text-color)" }}
              >
                {organization.name}
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: isActive(item.href)
                      ? "var(--accent-color)"
                      : "transparent",
                    color: isActive(item.href)
                      ? "var(--primary-color)"
                      : "var(--text-color)",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Auth Actions */}
            <div className="flex items-center gap-3">
              {customer ? (
                <>
                  <Link
                    to="/site/account"
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{
                      color: "var(--primary-color)",
                    }}
                  >
                    My Account
                  </Link>
                  <Form method="post" action="/site/account/logout">
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-80"
                      style={{
                        color: "var(--text-color)",
                      }}
                    >
                      Log Out
                    </button>
                  </Form>
                </>
              ) : (
                <>
                  <Link
                    to="/site/login"
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{
                      color: "var(--primary-color)",
                    }}
                  >
                    Log In
                  </Link>
                  <Link
                    to="/site/register"
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{
                      backgroundColor: "var(--primary-color)",
                    }}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Navigation */}
          <nav className="md:hidden pb-4 flex overflow-x-auto gap-1 -mx-4 px-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: isActive(item.href)
                    ? "var(--accent-color)"
                    : "transparent",
                  color: isActive(item.href)
                    ? "var(--primary-color)"
                    : "var(--text-color)",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer
        className="border-t mt-auto"
        style={{
          backgroundColor: "var(--color-card-bg)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand Column */}
            <div className="md:col-span-2">
              <Link to="/site" className="flex items-center gap-3">
                {organization.logo ? (
                  <img
                    src={organization.logo}
                    alt={organization.name}
                    className="h-10 w-auto"
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: "var(--primary-color)" }}
                  >
                    {organization.name.charAt(0)}
                  </div>
                )}
                <span
                  className="text-xl font-semibold"
                  style={{ color: "var(--text-color)" }}
                >
                  {organization.name}
                </span>
              </Link>
              {contactInfo?.address && (
                <p className="mt-4 text-sm opacity-75 whitespace-pre-line">{contactInfo.address}</p>
              )}
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                {navItems.slice(0, 5).map((item) => (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className="opacity-75 hover:opacity-100 transition-opacity"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                {contactInfo?.phone && (
                  <li className="opacity-75">
                    <a href={`tel:${contactInfo.phone}`}>{contactInfo.phone}</a>
                  </li>
                )}
                {contactInfo?.email && (
                  <li className="opacity-75">
                    <a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a>
                  </li>
                )}
                {contactInfo?.hours && (
                  <li className="opacity-75 whitespace-pre-line">{contactInfo.hours}</li>
                )}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-8 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-sm opacity-75"
            style={{ borderColor: "var(--color-border)" }}
          >
            <p suppressHydrationWarning>
              &copy; {new Date().getFullYear()} {organization.name}. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link to="/site/account" className="hover:opacity-100">
                My Account
              </Link>
              <a
                href="https://divestreams.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-100"
              >
                Powered by DiveStreams
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
