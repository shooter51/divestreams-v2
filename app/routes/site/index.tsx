/**
 * Public Site Homepage
 *
 * Main landing page for tenant public sites. Displays:
 * - Hero section with image/gradient and tagline
 * - Featured trips grid (first 4 public trips)
 * - Featured courses grid (first 4 public courses)
 * - About summary section
 * - Contact info preview
 * - CTA buttons for viewing all trips/courses
 */

import { Link, useLoaderData, useRouteLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  getPublicTrips,
  getPublicCourses,
} from "../../../lib/db/public-site.server";
import type { SiteLoaderData } from "./_layout";

// ============================================================================
// Types
// ============================================================================

interface HomeLoaderData {
  featuredTrips: Array<{
    id: string;
    date: string;
    startTime: string;
    price: string | null;
    primaryImage: string | null;
    tour: {
      id: string;
      name: string;
      description: string | null;
      type: string;
      duration: number | null;
      price: string;
      currency: string;
    } | null;
  }>;
  featuredCourses: Array<{
    id: string;
    name: string;
    description: string | null;
    price: string | null;
    duration: number | null;
  }>;
}

// ============================================================================
// Loader
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs): Promise<HomeLoaderData> {
  // Get organization ID from URL (subdomain or custom domain resolution)
  // We need to re-do resolution here since we can't import from parent
  const url = new URL(request.url);
  const host = url.host;

  // Resolve organization ID
  const { db } = await import("../../../lib/db");
  const { organization } = await import("../../../lib/db/schema/auth");
  const { eq } = await import("drizzle-orm");

  let org;

  // Try subdomain first
  const subdomain = getSubdomainFromHost(host);
  if (subdomain) {
    [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);
  } else {
    // Try custom domain
    const customDomain = host.split(":")[0];
    [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.customDomain, customDomain))
      .limit(1);
  }

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  // Fetch featured trips (limit to 4)
  const tripsResult = await getPublicTrips(org.id, { limit: 4, page: 1 });

  // Fetch featured courses (limit to 4)
  const coursesResult = await getPublicCourses(org.id, { limit: 4, page: 1 });

  // Get images for featured trips
  const { images } = await import("../../../lib/db/schema");
  const { and: andOp, inArray } = await import("drizzle-orm");

  const tourIds = tripsResult.trips.map(t => t.tour?.id).filter(Boolean) as string[];
  const tourImages = tourIds.length > 0 ? await db
    .select({
      tourId: images.entityId,
      url: images.url,
    })
    .from(images)
    .where(
      andOp(
        eq(images.organizationId, org.id),
        eq(images.entityType, "tour"),
        eq(images.isPrimary, true),
        inArray(images.entityId, tourIds)
      )
    ) : [];

  const imageMap = new Map(tourImages.map(img => [img.tourId, img.url]));

  return {
    featuredTrips: tripsResult.trips.map((trip) => ({
      id: trip.id,
      date: trip.date,
      startTime: trip.startTime,
      price: trip.price,
      primaryImage: trip.tour?.id ? (imageMap.get(trip.tour.id) || null) : null,
      tour: trip.tour,
    })),
    featuredCourses: coursesResult.courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      price: course.price,
      duration: course.duration,
    })),
  };
}

/**
 * Extract subdomain from request host
 */
function getSubdomainFromHost(host: string): string | null {
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0].toLowerCase();
    }
    return null;
  }

  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    if (subdomain === "www" || subdomain === "admin") {
      return null;
    }
    return subdomain;
  }

  return null;
}

// ============================================================================
// Helper Components
// ============================================================================

function TripCard({
  trip,
}: {
  trip: HomeLoaderData["featuredTrips"][0];
}) {
  const formattedDate = new Date(trip.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const price = trip.price || trip.tour?.price || "0";
  const currency = trip.tour?.currency || "USD";
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(parseFloat(price));

  return (
    <Link
      to={`/site/trips/${trip.id}`}
      className="group block rounded-xl overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-300"
      style={{
        backgroundColor: "white",
        borderColor: "var(--accent-color)",
      }}
    >
      {/* Trip Image */}
      <div className="h-48 relative">
        {trip.primaryImage ? (
          <img
            src={trip.primaryImage}
            alt={trip.tour?.name || "Dive Trip"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, var(--primary-color), var(--secondary-color))`,
            }}
          >
            <svg
              className="w-16 h-16 text-white/30"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
        )}
        {/* Date Badge */}
        <div
          className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: "rgba(255,255,255,0.9)",
            color: "var(--primary-color)",
          }}
        >
          {formattedDate}
        </div>
      </div>

      {/* Trip Info */}
      <div className="p-4">
        <h3 className="font-semibold text-lg group-hover:opacity-80 transition-opacity line-clamp-1">
          {trip.tour?.name || "Dive Trip"}
        </h3>
        {trip.tour?.description && (
          <p className="mt-1 text-sm opacity-75 line-clamp-2">
            {trip.tour.description}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span
            className="text-lg font-bold"
            style={{ color: "var(--primary-color)" }}
          >
            {formattedPrice}
          </span>
          <span className="text-sm opacity-60">{trip.startTime}</span>
        </div>
      </div>
    </Link>
  );
}

function CourseCard({
  course,
}: {
  course: HomeLoaderData["featuredCourses"][0];
}) {
  const formattedPrice = course.price
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(parseFloat(course.price))
    : "Contact for price";

  const durationText = course.duration
    ? course.duration >= 24
      ? `${Math.round(course.duration / 24)} days`
      : `${course.duration} hours`
    : null;

  return (
    <Link
      to={`/site/courses/${course.id}`}
      className="group block rounded-xl overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-300"
      style={{
        backgroundColor: "white",
        borderColor: "var(--accent-color)",
      }}
    >
      {/* Course Image Placeholder */}
      <div
        className="h-48 relative"
        style={{
          background: `linear-gradient(135deg, var(--secondary-color), var(--primary-color))`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-16 h-16 text-white/30"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
          </svg>
        </div>
        {durationText && (
          <div
            className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: "rgba(255,255,255,0.9)",
              color: "var(--primary-color)",
            }}
          >
            {durationText}
          </div>
        )}
      </div>

      {/* Course Info */}
      <div className="p-4">
        <h3 className="font-semibold text-lg group-hover:opacity-80 transition-opacity line-clamp-1">
          {course.name}
        </h3>
        {course.description && (
          <p className="mt-1 text-sm opacity-75 line-clamp-2">
            {course.description}
          </p>
        )}
        <div className="mt-3">
          <span
            className="text-lg font-bold"
            style={{ color: "var(--primary-color)" }}
          >
            {formattedPrice}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function SiteHomePage() {
  const { featuredTrips, featuredCourses } = useLoaderData<typeof loader>();
  const layoutData = useRouteLoaderData("routes/site/_layout") as SiteLoaderData | undefined;

  const settings = layoutData?.settings;
  const organization = layoutData?.organization;
  const contactInfo = layoutData?.contactInfo;
  const enabledPages = layoutData?.enabledPages;

  return (
    <div>
      {/* Hero Section */}
      <section
        className="relative min-h-[60vh] flex items-center justify-center"
        style={{
          backgroundImage: settings?.heroImageUrl
            ? `url(${settings.heroImageUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          background: !settings?.heroImageUrl
            ? `linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)`
            : undefined,
        }}
      >
        {/* Overlay for image backgrounds */}
        {settings?.heroImageUrl && (
          <div className="absolute inset-0 bg-black/40" />
        )}

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold"
            style={{ color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
          >
            {organization?.name || "Welcome"}
          </h1>
          <p
            className="mt-4 text-lg sm:text-xl lg:text-2xl max-w-2xl mx-auto"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            Discover amazing underwater adventures and dive experiences
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            {enabledPages?.trips && (
              <Link
                to="/site/trips"
                className="px-6 py-3 rounded-lg font-semibold text-lg transition-all hover:scale-105"
                style={{
                  backgroundColor: "white",
                  color: "var(--primary-color)",
                }}
              >
                Explore Trips
              </Link>
            )}
            {enabledPages?.courses && (
              <Link
                to="/site/courses"
                className="px-6 py-3 rounded-lg font-semibold text-lg border-2 border-white transition-all hover:scale-105"
                style={{
                  backgroundColor: "transparent",
                  color: "white",
                }}
              >
                View Courses
              </Link>
            )}
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              style={{ fill: "var(--background-color)" }}
            />
          </svg>
        </div>
      </section>

      {/* Video Spotlight Section */}
      {settings?.heroVideoUrl && (
        <section className="py-12 px-4 bg-gradient-to-b from-transparent to-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="relative rounded-xl overflow-hidden shadow-2xl">
              <video
                src={settings.heroVideoUrl}
                className="w-full aspect-video object-cover"
                autoPlay
                muted
                loop
                playsInline
                controls={false}
              />
              {/* Optional gradient overlay for better aesthetics */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
          </div>
        </section>
      )}

      {/* Featured Trips Section */}
      {enabledPages?.trips && featuredTrips.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold">Upcoming Trips</h2>
                <p className="mt-2 opacity-75">
                  Book your next diving adventure
                </p>
              </div>
              <Link
                to="/site/trips"
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: "var(--accent-color)",
                  color: "var(--primary-color)",
                }}
              >
                View All Trips
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>

            {/* Mobile View All Link */}
            <div className="mt-8 text-center sm:hidden">
              <Link
                to="/site/trips"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium"
                style={{
                  backgroundColor: "var(--primary-color)",
                  color: "white",
                }}
              >
                View All Trips
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Featured Courses Section */}
      {enabledPages?.courses && featuredCourses.length > 0 && (
        <section
          className="py-16 px-4"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold">Dive Courses</h2>
                <p className="mt-2 opacity-75">
                  Learn to dive or advance your skills
                </p>
              </div>
              <Link
                to="/site/courses"
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: "white",
                  color: "var(--primary-color)",
                }}
              >
                View All Courses
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            {/* Mobile View All Link */}
            <div className="mt-8 text-center sm:hidden">
              <Link
                to="/site/courses"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium"
                style={{
                  backgroundColor: "var(--primary-color)",
                  color: "white",
                }}
              >
                View All Courses
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* About Summary Section */}
      {enabledPages?.about && settings?.aboutContent && (
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">About Us</h2>
            <p className="text-lg opacity-80 leading-relaxed line-clamp-4">
              {settings.aboutContent}
            </p>
            <Link
              to="/site/about"
              className="inline-flex items-center gap-2 mt-6 font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--primary-color)" }}
            >
              Learn more about us
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </section>
      )}

      {/* Contact Preview Section */}
      {enabledPages?.contact && contactInfo && (
        <section
          className="py-16 px-4"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold">Get in Touch</h2>
              <p className="mt-2 opacity-75">
                Ready to dive? Contact us today!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              {/* Phone */}
              {contactInfo.phone && (
                <div
                  className="p-6 rounded-xl"
                  style={{ backgroundColor: "white" }}
                >
                  <div
                    className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                      style={{ color: "var(--primary-color)" }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold mb-2">Call Us</h3>
                  <a
                    href={`tel:${contactInfo.phone}`}
                    className="opacity-75 hover:opacity-100"
                    style={{ color: "var(--primary-color)" }}
                  >
                    {contactInfo.phone}
                  </a>
                </div>
              )}

              {/* Email */}
              {contactInfo.email && (
                <div
                  className="p-6 rounded-xl"
                  style={{ backgroundColor: "white" }}
                >
                  <div
                    className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                      style={{ color: "var(--primary-color)" }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold mb-2">Email Us</h3>
                  <a
                    href={`mailto:${contactInfo.email}`}
                    className="opacity-75 hover:opacity-100 break-all"
                    style={{ color: "var(--primary-color)" }}
                  >
                    {contactInfo.email}
                  </a>
                </div>
              )}

              {/* Hours */}
              {contactInfo.hours && (
                <div
                  className="p-6 rounded-xl"
                  style={{ backgroundColor: "white" }}
                >
                  <div
                    className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                      style={{ color: "var(--primary-color)" }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="font-semibold mb-2">Hours</h3>
                  <p className="opacity-75">{contactInfo.hours}</p>
                </div>
              )}
            </div>

            {/* Full Contact CTA */}
            <div className="mt-10 text-center">
              <Link
                to="/site/contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
                style={{
                  backgroundColor: "var(--primary-color)",
                  color: "white",
                }}
              >
                Contact Us
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Empty State - No Featured Content */}
      {featuredTrips.length === 0 && featuredCourses.length === 0 && (
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              <svg
                className="w-10 h-10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                style={{ color: "var(--primary-color)" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-4">Coming Soon</h2>
            <p className="opacity-75 text-lg">
              We are preparing exciting trips and courses for you.
              Check back soon or contact us for more information!
            </p>
            {enabledPages?.contact && (
              <Link
                to="/site/contact"
                className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-lg font-semibold"
                style={{
                  backgroundColor: "var(--primary-color)",
                  color: "white",
                }}
              >
                Get in Touch
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
