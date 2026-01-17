/**
 * Public Site Courses List Page
 *
 * Displays a grid of public training courses with filtering by agency and level.
 * Each course card shows name, agency logo, price, and duration.
 */

import { Link, useLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getPublicCourses } from "../../../../lib/db/public-site.server";
import type { SiteLoaderData } from "../_layout";

// ============================================================================
// CERTIFICATION AGENCIES
// ============================================================================

const CERTIFICATION_AGENCIES = [
  { id: "padi", name: "PADI", color: "#003087" },
  { id: "ssi", name: "SSI", color: "#00529b" },
  { id: "naui", name: "NAUI", color: "#002855" },
  { id: "sdi", name: "SDI/TDI", color: "#ff6600" },
  { id: "raid", name: "RAID", color: "#e31937" },
  { id: "gue", name: "GUE", color: "#1a1a1a" },
  { id: "other", name: "Other", color: "#6b7280" },
];

const COURSE_LEVELS = [
  { id: "beginner", name: "Beginner", description: "No experience required" },
  { id: "open-water", name: "Open Water", description: "Entry-level certification" },
  { id: "advanced", name: "Advanced", description: "For certified divers" },
  { id: "specialty", name: "Specialty", description: "Focused skill courses" },
  { id: "professional", name: "Professional", description: "Instructor-level training" },
];

// ============================================================================
// TYPES
// ============================================================================

interface Course {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  duration: number | null;
  isPublic: boolean;
  // Extended fields derived from name/description for filtering
  agency: string | null;
  level: string | null;
}

interface LoaderData {
  courses: Course[];
  total: number;
  page: number;
  limit: number;
  filters: {
    agency: string | null;
    level: string | null;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect agency from course name or description
 */
function detectAgency(name: string, description: string | null): string | null {
  const text = `${name} ${description || ""}`.toLowerCase();

  if (text.includes("padi")) return "padi";
  if (text.includes("ssi")) return "ssi";
  if (text.includes("naui")) return "naui";
  if (text.includes("sdi") || text.includes("tdi")) return "sdi";
  if (text.includes("raid")) return "raid";
  if (text.includes("gue")) return "gue";

  return null;
}

/**
 * Detect course level from name or description
 */
function detectLevel(name: string, description: string | null): string | null {
  const text = `${name} ${description || ""}`.toLowerCase();

  if (text.includes("discover") || text.includes("intro") || text.includes("try")) {
    return "beginner";
  }
  if (text.includes("open water") || text.includes("basic")) {
    return "open-water";
  }
  if (text.includes("advanced") || text.includes("deep") || text.includes("navigation")) {
    return "advanced";
  }
  if (text.includes("specialty") || text.includes("nitrox") || text.includes("wreck") || text.includes("night")) {
    return "specialty";
  }
  if (text.includes("divemaster") || text.includes("instructor") || text.includes("professional")) {
    return "professional";
  }

  return null;
}

/**
 * Format duration in minutes to readable string
 */
function formatDuration(minutes: number | null): string {
  if (!minutes) return "Duration varies";

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (minutes >= 1440) { // 24 hours or more
    const days = Math.floor(minutes / 1440);
    return days === 1 ? "1 day" : `${days} days`;
  }

  if (remainingMinutes === 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  return `${hours}h ${remainingMinutes}m`;
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
    maximumFractionDigits: 0,
  }).format(numericPrice);
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request, context }: LoaderFunctionArgs): Promise<LoaderData> {
  // Get organization from parent layout context
  const parentData = context?.parentData as SiteLoaderData | undefined;

  if (!parentData?.organization?.id) {
    throw new Response("Organization not found", { status: 404 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = 12;
  const agency = url.searchParams.get("agency");
  const level = url.searchParams.get("level");

  // Get all public courses
  const result = await getPublicCourses(parentData.organization.id, { page, limit: 100 });

  // Enhance courses with detected agency and level
  let enhancedCourses = result.courses.map((course) => ({
    ...course,
    agency: detectAgency(course.name, course.description),
    level: detectLevel(course.name, course.description),
  }));

  // Apply filters
  if (agency) {
    enhancedCourses = enhancedCourses.filter((c) => c.agency === agency);
  }
  if (level) {
    enhancedCourses = enhancedCourses.filter((c) => c.level === level);
  }

  // Paginate
  const total = enhancedCourses.length;
  const startIndex = (page - 1) * limit;
  const paginatedCourses = enhancedCourses.slice(startIndex, startIndex + limit);

  return {
    courses: paginatedCourses,
    total,
    page,
    limit,
    filters: {
      agency,
      level,
    },
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Agency badge component
 */
function AgencyBadge({ agencyId }: { agencyId: string | undefined | null }) {
  if (!agencyId) return null;

  const agency = CERTIFICATION_AGENCIES.find((a) => a.id === agencyId);
  if (!agency) return null;

  return (
    <span
      className="inline-flex items-center px-2 py-1 text-xs font-semibold text-white rounded"
      style={{ backgroundColor: agency.color }}
    >
      {agency.name}
    </span>
  );
}

/**
 * Level badge component
 */
function LevelBadge({ levelId }: { levelId: string | undefined | null }) {
  if (!levelId) return null;

  const level = COURSE_LEVELS.find((l) => l.id === levelId);
  if (!level) return null;

  return (
    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
      {level.name}
    </span>
  );
}

/**
 * Course card component
 */
function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      to={`/site/courses/${course.id}`}
      className="group block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200"
    >
      {/* Course Image Placeholder */}
      <div
        className="h-48 flex items-center justify-center"
        style={{ backgroundColor: "var(--accent-color)" }}
      >
        <svg
          className="w-16 h-16 opacity-50"
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
      </div>

      {/* Card Content */}
      <div className="p-5">
        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <AgencyBadge agencyId={course.agency} />
          <LevelBadge levelId={course.level} />
        </div>

        {/* Course Name */}
        <h3
          className="text-lg font-semibold mb-2 group-hover:underline line-clamp-2"
          style={{ color: "var(--text-color)" }}
        >
          {course.name}
        </h3>

        {/* Description */}
        {course.description && (
          <p className="text-sm opacity-75 mb-4 line-clamp-2">
            {course.description}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          {/* Duration */}
          <div className="flex items-center gap-1.5 text-sm opacity-75">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatDuration(course.duration)}</span>
          </div>

          {/* Price */}
          <span
            className="text-lg font-bold"
            style={{ color: "var(--primary-color)" }}
          >
            {formatPrice(course.price)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Filter section component
 */
function FilterSection({
  filters,
}: {
  filters: { agency: string | null; level: string | null };
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.delete("page"); // Reset to page 1 on filter change
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const hasFilters = filters.agency || filters.level;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Agency Filter */}
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2 opacity-75">
            Certification Agency
          </label>
          <select
            value={filters.agency || ""}
            onChange={(e) => updateFilter("agency", e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
            style={{
              outline: "none",
              // @ts-expect-error CSS custom property
              "--tw-ring-color": "var(--primary-color)",
            }}
          >
            <option value="">All Agencies</option>
            {CERTIFICATION_AGENCIES.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </div>

        {/* Level Filter */}
        <div className="flex-1">
          <label className="block text-sm font-medium mb-2 opacity-75">
            Course Level
          </label>
          <select
            value={filters.level || ""}
            onChange={(e) => updateFilter("level", e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
          >
            <option value="">All Levels</option>
            {COURSE_LEVELS.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {hasFilters && (
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Pagination component
 */
function Pagination({
  page,
  total,
  limit,
}: {
  page: number;
  total: number;
  limit: number;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  const goToPage = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(newPage));
    setSearchParams(newParams);
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => goToPage(page - 1)}
        disabled={page === 1}
        className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <span className="px-4 py-2 text-sm">
        Page {page} of {totalPages}
      </span>

      <button
        onClick={() => goToPage(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-16">
      <svg
        className="w-16 h-16 mx-auto mb-4 opacity-50"
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
      <h3 className="text-xl font-semibold mb-2">
        {hasFilters ? "No courses match your filters" : "No courses available"}
      </h3>
      <p className="opacity-75 max-w-md mx-auto">
        {hasFilters
          ? "Try adjusting your filters to find more courses."
          : "Check back soon for upcoming training courses and certifications."}
      </p>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SiteCoursesPage() {
  const { courses, total, page, limit, filters } = useLoaderData<typeof loader>();

  const hasFilters = Boolean(filters.agency || filters.level);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page Header */}
      <div className="text-center mb-12">
        <h1
          className="text-4xl font-bold mb-4"
          style={{ color: "var(--text-color)" }}
        >
          Dive Courses
        </h1>
        <p className="text-lg opacity-75 max-w-2xl mx-auto">
          Start your underwater adventure with our professional training courses.
          From beginner to instructor level, we have the perfect course for you.
        </p>
      </div>

      {/* Filters */}
      <FilterSection filters={filters} />

      {/* Results Count */}
      {courses.length > 0 && (
        <p className="text-sm opacity-75 mb-6">
          Showing {courses.length} of {total} courses
        </p>
      )}

      {/* Course Grid */}
      {courses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <EmptyState hasFilters={hasFilters} />
      )}

      {/* Pagination */}
      <Pagination page={page} total={total} limit={limit} />

      {/* Call to Action */}
      <div
        className="mt-16 text-center p-8 rounded-2xl"
        style={{ backgroundColor: "var(--accent-color)" }}
      >
        <h2
          className="text-2xl font-bold mb-4"
          style={{ color: "var(--text-color)" }}
        >
          Not sure which course is right for you?
        </h2>
        <p className="opacity-75 mb-6 max-w-xl mx-auto">
          Our team of experienced instructors can help you choose the perfect course
          based on your experience level and diving goals.
        </p>
        <Link
          to="/site/contact"
          className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary-color)" }}
        >
          Contact Us
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
