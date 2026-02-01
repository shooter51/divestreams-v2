/**
 * Public Site About Page
 *
 * Displays about content, team information, certifications, and company history.
 * Content is loaded from the page_content table if available, with fallback to legacy content.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useRouteLoaderData, useLoaderData } from "react-router";
import type { SiteLoaderData } from "./_layout";
import { getPublicPageContent } from "../../../lib/db/page-content.server";
import { ContentBlockRenderer } from "../../components/ContentBlockRenderer";

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs) {
  // Get organization from parent layout
  const url = new URL(request.url);
  const host = url.hostname;

  // Extract subdomain for tenant resolution
  let subdomain: string | null = null;
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      subdomain = parts[0].toLowerCase();
    }
  } else {
    const parts = host.split(".");
    if (parts.length >= 3) {
      const sub = parts[0].toLowerCase();
      if (sub !== "www" && sub !== "admin") {
        subdomain = sub;
      }
    }
  }

  // If no subdomain, return null (will use parent loader data)
  if (!subdomain) {
    return { pageContent: null };
  }

  // Get organization from database to fetch page content
  const { db } = await import("../../../lib/db");
  const { organization } = await import("../../../lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return { pageContent: null };
  }

  // Try to get page content from CMS
  const pageContent = await getPublicPageContent(org.id, "about");

  return { pageContent };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SiteAboutPage() {
  // Get data from parent layout loader
  const loaderData = useRouteLoaderData<SiteLoaderData>("routes/site/_layout");
  const { pageContent } = useLoaderData<typeof loader>();

  if (!loaderData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold">About Us</h1>
        <p className="mt-4 text-lg opacity-75">Loading...</p>
      </div>
    );
  }

  const { organization, settings } = loaderData;

  // Priority: CMS content > settings.aboutContent > hardcoded fallback
  const useCmsContent = pageContent && pageContent.content.blocks.length > 0;
  const useSettingsContent = !useCmsContent && settings.aboutContent;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="py-16 md:py-24"
        style={{ backgroundColor: "var(--accent-color)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold">
              About {organization.name}
            </h1>
            <p className="mt-6 text-xl opacity-75">
              Discover our passion for diving and commitment to providing
              unforgettable underwater experiences.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {useCmsContent ? (
          // Render CMS content blocks
          <ContentBlockRenderer blocks={pageContent!.content.blocks} />
        ) : useSettingsContent ? (
          // Render content from Settings → Public Site → Content
          <div className="prose prose-lg max-w-none">
            <div className="whitespace-pre-line opacity-85">
              {settings.aboutContent}
            </div>
          </div>
        ) : (
          // Hardcoded fallback - shown when no content has been configured
          <div className="prose prose-lg max-w-none">
            <h2 className="text-2xl font-bold mb-6">Our Story</h2>
            <p className="opacity-75">
              Welcome to {organization.name}! We are passionate about sharing the
              wonders of the underwater world with divers of all experience levels.
            </p>
            <p className="opacity-75">
              Our team of experienced instructors and dive professionals is
              dedicated to providing safe, educational, and exciting diving
              experiences. Whether you're taking your first breath underwater or
              exploring advanced technical diving, we're here to guide you every
              step of the way.
            </p>
            <p className="mt-8 text-sm opacity-50">
              To customize this page, go to Settings → Public Site → Content
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
