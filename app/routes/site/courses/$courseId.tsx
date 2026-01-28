/**
 * Public Site Course Detail Page
 *
 * Displays full course information including description, prerequisites,
 * what's included, available sessions, and enrollment options.
 */

import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import {
  getPublicCourseById,
  getCourseScheduledTrips,
} from "../../../../lib/db/public-site.server";
import { db } from "../../../../lib/db";
import { organization } from "../../../../lib/db/schema/auth";
import { eq } from "drizzle-orm";

// ============================================================================
// CERTIFICATION AGENCIES
// ============================================================================

const CERTIFICATION_AGENCIES: Record<string, { name: string; color: string; description: string }> = {
  padi: {
    name: "PADI",
    color: "#003087",
    description: "Professional Association of Diving Instructors - World's largest diver training organization",
  },
  ssi: {
    name: "SSI",
    color: "#00529b",
    description: "Scuba Schools International - Globally recognized dive training",
  },
  naui: {
    name: "NAUI",
    color: "#002855",
    description: "National Association of Underwater Instructors - Since 1959",
  },
  sdi: {
    name: "SDI/TDI",
    color: "#ff6600",
    description: "Scuba Diving International / Technical Diving International",
  },
  raid: {
    name: "RAID",
    color: "#e31937",
    description: "Rebreather Association of International Divers",
  },
  gue: {
    name: "GUE",
    color: "#1a1a1a",
    description: "Global Underwater Explorers - Excellence in diving education",
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface ScheduledSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string | null;
  maxParticipants: number | null;
  price: string | null;
  status: string;
}

interface CourseDetail {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  classroomHours: number | null;
  poolHours: number | null;
  openWaterDives: number | null;
  maxStudents: number;
  minStudents: number | null;
  price: string;
  currency: string;
  depositRequired: boolean | null;
  depositAmount: string | null;
  materialsIncluded: boolean | null;
  equipmentIncluded: boolean | null;
  includedItems: string[] | null;
  requiredItems: string[] | null;
  minAge: number | null;
  prerequisites: string | null;
  medicalRequirements: string | null;
  images: string[] | null;
  agencyName: string | null;
  levelName: string | null;
}

interface LoaderData {
  course: CourseDetail;
  sessions: ScheduledSession[];
  totalSessions: number;
  organizationSlug: string;
}

// ============================================================================
// HELPER FUNCTIONS
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

/**
 * Get agency color from name
 */
function getAgencyColor(agencyName: string | null): string {
  if (!agencyName) return "#6b7280";

  const nameLower = agencyName.toLowerCase();
  for (const [id, agency] of Object.entries(CERTIFICATION_AGENCIES)) {
    if (nameLower.includes(id) || nameLower.includes(agency.name.toLowerCase())) {
      return agency.color;
    }
  }
  return "#6b7280";
}

/**
 * Format duration in days to readable string
 */
function formatDuration(days: number): string {
  if (days === 1) return "1 day";
  return `${days} days`;
}

/**
 * Format price for display
 */
function formatPrice(price: string | null, currency = "USD"): string {
  if (!price) return "Price on request";

  const numericPrice = parseFloat(price);
  if (isNaN(numericPrice)) return "Price on request";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericPrice);
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format time for display
 */
function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ params, request }: LoaderFunctionArgs): Promise<LoaderData> {
  const { courseId } = params;

  if (!courseId) {
    throw new Response("Course ID is required", { status: 400 });
  }

  const url = new URL(request.url);
  const host = url.host;
  const subdomain = getSubdomainFromHost(host);

  // Get organization from subdomain or custom domain
  const [org] = subdomain
    ? await db.select().from(organization).where(eq(organization.slug, subdomain)).limit(1)
    : await db.select().from(organization).where(eq(organization.customDomain, host.split(":")[0])).limit(1);

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  // Get course details
  const course = await getPublicCourseById(org.id, courseId);

  if (!course) {
    throw new Response("Course not found", { status: 404 });
  }

  // Get scheduled sessions for this course
  const sessionsResult = await getCourseScheduledTrips(
    org.id,
    courseId,
    { limit: 10 }
  );

  return {
    course,
    sessions: sessionsResult.trips,
    totalSessions: sessionsResult.total,
    organizationSlug: subdomain || org.slug,
  };
}

// ============================================================================
// META
// ============================================================================

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.course) {
    return [{ title: "Course Not Found" }];
  }

  return [
    { title: data.course.name },
    { name: "description", content: data.course.description || `Learn more about ${data.course.name}` },
  ];
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Agency certification card
 */
function AgencyCertificationCard({
  agency,
}: {
  agency: { id: string; name: string; color: string; description: string };
}) {
  return (
    <div
      className="rounded-xl p-6 text-white"
      style={{ backgroundColor: agency.color }}
    >
      <div className="flex items-center gap-4 mb-3">
        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
          <span className="text-xl font-bold">{agency.name.charAt(0)}</span>
        </div>
        <div>
          <h3 className="text-lg font-bold">{agency.name} Certification</h3>
          <p className="text-sm opacity-90">{agency.description}</p>
        </div>
      </div>
      <p className="text-sm opacity-90">
        Upon successful completion, you will receive an internationally recognized
        {" "}{agency.name} certification card.
      </p>
    </div>
  );
}

/**
 * What's included section
 */
function WhatsIncludedSection({ course }: { course: CourseDetail }) {
  const includedItems: { icon: string; label: string }[] = [];
  const excludedItems: string[] = [];

  if (course.equipmentIncluded) {
    includedItems.push({ icon: "equipment", label: "All dive equipment" });
  } else {
    excludedItems.push("Dive equipment (available for rent)");
  }

  if (course.materialsIncluded) {
    includedItems.push({ icon: "book", label: "Course materials & manuals" });
  }

  // Add custom inclusions
  if (course.includedItems) {
    course.includedItems.forEach((item) => {
      includedItems.push({ icon: "check", label: item });
    });
  }

  // Add standard course items
  includedItems.push(
    { icon: "card", label: "Certification fee" },
    { icon: "instructor", label: "Professional instruction" }
  );

  // Add required items as exclusions (things student must bring)
  if (course.requiredItems) {
    excludedItems.push(...course.requiredItems.map(item => `Bring your own: ${item}`));
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "equipment":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case "meals":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        );
      case "transport":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      case "book":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      case "card":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
          </svg>
        );
      case "instructor":
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-color)" }}>
        What's Included
      </h2>

      <ul className="space-y-3 mb-6">
        {includedItems.map((item, index) => (
          <li key={index} className="flex items-center gap-3">
            <span
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--accent-color)", color: "var(--primary-color)" }}
            >
              {getIcon(item.icon)}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {excludedItems.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mb-2 opacity-75">Not Included:</h3>
          <ul className="space-y-2 text-sm opacity-75">
            {excludedItems.map((item, index) => (
              <li key={index} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Prerequisites section
 */
function PrerequisitesSection({ course }: { course: CourseDetail }) {
  const prerequisites: string[] = [];

  if (course.minAge) {
    prerequisites.push(`Minimum age: ${course.minAge} years`);
  }

  if (course.levelName) {
    prerequisites.push(`Required certification: ${course.levelName}`);
  }

  if (course.prerequisites) {
    prerequisites.push(course.prerequisites);
  }

  if (course.medicalRequirements) {
    prerequisites.push(`Medical: ${course.medicalRequirements}`);
  }

  // Default prerequisites if none specified
  if (prerequisites.length === 0) {
    prerequisites.push(
      "Ability to swim 200m/656ft",
      "Good physical health",
      "Basic water comfort"
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-color)" }}>
        Prerequisites
      </h2>
      <ul className="space-y-3">
        {prerequisites.map((prereq, index) => (
          <li key={index} className="flex items-start gap-3">
            <svg
              className="w-5 h-5 mt-0.5 flex-shrink-0"
              style={{ color: "var(--primary-color)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{prereq}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Session card component
 */
function SessionCard({
  session,
  courseId,
  defaultPrice,
  currency,
  organizationSlug,
}: {
  session: ScheduledSession;
  courseId: string;
  defaultPrice: string;
  currency: string;
  organizationSlug: string;
}) {
  const price = session.price || defaultPrice;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-semibold">{formatDate(session.date)}</span>
        </div>
        <div className="flex items-center gap-4 text-sm opacity-75">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(session.startTime)}
            {session.endTime && ` - ${formatTime(session.endTime)}`}
          </span>
          {session.maxParticipants && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Max {session.maxParticipants} participants
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold" style={{ color: "var(--primary-color)" }}>
          {formatPrice(price, currency)}
        </span>
        <Link
          to={`/embed/${organizationSlug}/courses/${courseId}/enroll?sessionId=${session.id}`}
          className="px-4 py-2 text-white font-semibold rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary-color)" }}
        >
          Enroll
        </Link>
      </div>
    </div>
  );
}

/**
 * Available sessions section
 */
function SessionsSection({
  sessions,
  totalSessions,
  courseId,
  defaultPrice,
  currency,
  organizationSlug,
}: {
  sessions: ScheduledSession[];
  totalSessions: number;
  courseId: string;
  defaultPrice: string;
  currency: string;
  organizationSlug: string;
}) {
  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
        <svg
          className="w-12 h-12 mx-auto mb-3 opacity-50"
          style={{ color: "var(--primary-color)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-semibold mb-2">No Scheduled Sessions</h3>
        <p className="text-sm opacity-75 mb-4">
          Contact us to arrange a private course or be notified when new sessions are available.
        </p>
        <Link
          to="/site/contact"
          className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors hover:bg-gray-50"
          style={{ borderColor: "var(--primary-color)", color: "var(--primary-color)" }}
        >
          Contact Us
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" style={{ color: "var(--text-color)" }}>
        Available Sessions ({totalSessions})
      </h2>
      <div className="space-y-3">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            courseId={courseId}
            defaultPrice={defaultPrice}
            currency={currency}
            organizationSlug={organizationSlug}
          />
        ))}
      </div>
      {totalSessions > sessions.length && (
        <p className="text-sm text-center opacity-75">
          Showing {sessions.length} of {totalSessions} available sessions
        </p>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SiteCourseDetailPage() {
  const { course, sessions, totalSessions, organizationSlug } = useLoaderData<typeof loader>();

  // Get agency info for styling
  const agencyColor = getAgencyColor(course.agencyName);
  const agencyInfo = course.agencyName ? {
    name: course.agencyName,
    color: agencyColor,
    description: CERTIFICATION_AGENCIES[course.agencyName.toLowerCase()]?.description || `${course.agencyName} certified course`,
  } : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <Link to="/site" className="opacity-75 hover:opacity-100">
              Home
            </Link>
          </li>
          <li className="opacity-50">/</li>
          <li>
            <Link to="/site/courses" className="opacity-75 hover:opacity-100">
              Courses
            </Link>
          </li>
          <li className="opacity-50">/</li>
          <li className="font-medium">{course.name}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Course Header */}
          <div>
            {/* Course Image */}
            <div
              className="h-64 md:h-80 rounded-2xl mb-6 flex items-center justify-center"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              {course.images && course.images.length > 0 ? (
                <img
                  src={course.images[0]}
                  alt={course.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <svg
                  className="w-24 h-24 opacity-50"
                  style={{ color: "var(--primary-color)" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              )}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {course.agencyName && (
                <span
                  className="inline-flex items-center px-3 py-1 text-sm font-semibold text-white rounded-full"
                  style={{ backgroundColor: agencyColor }}
                >
                  {course.agencyName}
                </span>
              )}
              {course.levelName && (
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-full">
                  {course.levelName}
                </span>
              )}
            </div>

            {/* Course Title */}
            <h1
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: "var(--text-color)" }}
            >
              {course.name}
            </h1>

            {/* Quick Info */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatDuration(course.durationDays)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Max {course.maxStudents} students</span>
              </div>
              {course.minAge && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Min age: {course.minAge}+</span>
                </div>
              )}
              {course.classroomHours && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>{course.classroomHours}h classroom</span>
                </div>
              )}
              {course.openWaterDives && (
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <span>{course.openWaterDives} open water dives</span>
                </div>
              )}
            </div>

            {/* Description */}
            {course.description && (
              <div className="prose prose-lg max-w-none">
                <p className="text-lg opacity-75 leading-relaxed">
                  {course.description}
                </p>
              </div>
            )}
          </div>

          {/* Agency Certification Info */}
          {agencyInfo && (
            <AgencyCertificationCard agency={{ id: course.agencyName?.toLowerCase() || "", ...agencyInfo }} />
          )}

          {/* What's Included */}
          <WhatsIncludedSection course={course} />

          {/* Prerequisites */}
          <PrerequisitesSection course={course} />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Price Card */}
          <div
            className="bg-white rounded-xl shadow-lg border-2 p-6 sticky top-24"
            style={{ borderColor: "var(--primary-color)" }}
          >
            <div className="text-center mb-6">
              <span className="text-sm opacity-75">Starting from</span>
              <div
                className="text-4xl font-bold"
                style={{ color: "var(--primary-color)" }}
              >
                {formatPrice(course.price, course.currency)}
              </div>
              <span className="text-sm opacity-75">per person</span>
            </div>

            {/* Enroll Button */}
            <Link
              to={`/embed/${organizationSlug}/courses/${course.id}/enroll`}
              className="w-full py-3 text-white font-semibold rounded-lg transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
              style={{ backgroundColor: "var(--primary-color)" }}
            >
              Enroll Now
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>

            {/* Quick Info */}
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatDuration(course.durationDays)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Certification included</span>
              </div>
              {course.materialsIncluded && (
                <div className="flex items-center gap-3 text-sm">
                  <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Materials included</span>
                </div>
              )}
              {course.equipmentIncluded && (
                <div className="flex items-center gap-3 text-sm">
                  <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Equipment included</span>
                </div>
              )}
            </div>

            {/* Contact Link */}
            <div className="mt-6 text-center">
              <Link
                to="/site/contact"
                className="text-sm hover:underline"
                style={{ color: "var(--primary-color)" }}
              >
                Questions? Contact us
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Available Sessions */}
      <div className="mt-12">
        <SessionsSection
          sessions={sessions}
          totalSessions={totalSessions}
          courseId={course.id}
          defaultPrice={course.price}
          currency={course.currency}
          organizationSlug={organizationSlug}
        />
      </div>

      {/* Back to Courses */}
      <div className="mt-12 text-center">
        <Link
          to="/site/courses"
          className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
          style={{ color: "var(--primary-color)" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all courses
        </Link>
      </div>
    </div>
  );
}
