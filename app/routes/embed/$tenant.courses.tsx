/**
 * Course Listing for Booking Widget
 *
 * Displays available training courses for customers to browse and enroll.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useOutletContext } from "react-router";
import {
  getOrganizationBySlug,
  getPublicCourses,
  type PublicCourse,
} from "../../../lib/db/queries.public";

export const meta: MetaFunction = () => [{ title: "Training Courses" }];

export async function loader({ params }: LoaderFunctionArgs) {
  const subdomain = params.tenant;
  if (!subdomain) {
    throw new Response("Shop not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  const courses = await getPublicCourses(org.id);

  return { courses };
}

function formatPrice(price: string, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(parseFloat(price));
}

function CourseCard({
  course,
  tenantSlug,
}: {
  course: PublicCourse;
  tenantSlug: string;
}) {
  const totalDives = course.openWaterDives || 0;
  const totalHours = (course.classroomHours || 0) + (course.poolHours || 0);

  return (
    <Link
      to={`/embed/${tenantSlug}/courses/${course.id}`}
      className="block bg-white rounded-lg border hover:shadow-md transition-shadow overflow-hidden"
    >
      {/* Agency Badge */}
      <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          {course.agencyLogo ? (
            <img
              src={course.agencyLogo}
              alt={course.agencyName}
              className="h-6 object-contain"
            />
          ) : (
            <span className="text-sm font-semibold text-gray-700">
              {course.agencyCode}
            </span>
          )}
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
          {course.levelName}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1">{course.name}</h3>

        {course.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {course.description}
          </p>
        )}

        {/* Course info */}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
          <span className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {course.durationDays} day{course.durationDays !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Max {course.maxStudents}
          </span>
        </div>

        {/* Features */}
        <div className="flex flex-wrap gap-1 mb-3">
          {totalHours > 0 && (
            <span className="text-xs bg-info-muted text-info px-2 py-0.5 rounded">
              {totalHours} hrs training
            </span>
          )}
          {totalDives > 0 && (
            <span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded">
              {totalDives} open water dive{totalDives !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            <span
              className="text-xl font-bold"
              style={{ color: "var(--primary-color)" }}
            >
              {formatPrice(course.price, course.currency)}
            </span>
            {course.depositAmount && (
              <span className="text-sm text-gray-500 ml-2">
                ({formatPrice(course.depositAmount, course.currency)} deposit)
              </span>
            )}
          </div>
          <span
            className="text-sm font-medium px-4 py-2 rounded"
            style={{
              backgroundColor: "var(--secondary-color)",
              color: "var(--primary-color)",
            }}
          >
            Learn More
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function EmbedCoursesPage() {
  const { courses } = useLoaderData<typeof loader>();
  const { organization } = useOutletContext<{
    organization: { slug: string; name: string };
    branding: { primaryColor: string };
  }>();

  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          No Courses Available
        </h2>
        <p className="text-gray-500">Check back soon for upcoming courses!</p>
      </div>
    );
  }

  // Group courses by agency
  const coursesByAgency = courses.reduce(
    (acc, course) => {
      const key = course.agencyCode;
      if (!acc[key]) {
        acc[key] = {
          agencyName: course.agencyName,
          agencyCode: course.agencyCode,
          agencyLogo: course.agencyLogo,
          courses: [],
        };
      }
      acc[key].courses.push(course);
      return acc;
    },
    {} as Record<
      string,
      {
        agencyName: string;
        agencyCode: string;
        agencyLogo: string | null;
        courses: PublicCourse[];
      }
    >
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Certification Courses</h2>

      {Object.values(coursesByAgency).map((group) => (
        <div key={group.agencyCode} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            {group.agencyLogo ? (
              <img
                src={group.agencyLogo}
                alt={group.agencyName}
                className="h-8 object-contain"
              />
            ) : (
              <span className="text-lg font-semibold text-gray-700">
                {group.agencyName}
              </span>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {group.courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                tenantSlug={organization.slug}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
