/**
 * Dive Courses Page
 *
 * Displays available dive courses and certifications.
 * Currently a placeholder - will be implemented in a future update.
 */

import { Link, useRouteLoaderData } from "react-router";
import type { SiteLoaderData } from "./_layout";

export default function CoursesPage() {
  const layoutData = useRouteLoaderData("routes/site/_layout") as
    | SiteLoaderData
    | undefined;

  const organization = layoutData?.organization;

  return (
    <div className="min-h-[70vh] py-16 px-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* Coming Soon Icon */}
        <div
          className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-8"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          <svg
            className="w-12 h-12"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
            style={{ color: "var(--primary-color)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="text-4xl font-bold mb-4">Dive Courses & Certifications</h1>
        <p className="text-xl opacity-75 mb-8 max-w-2xl mx-auto">
          Our dive courses page is coming soon! We're preparing a comprehensive
          catalog of certification courses, from beginner to advanced levels.
        </p>

        {/* Contact CTA */}
        <div
          className="bg-white rounded-xl p-8 max-w-md mx-auto"
          style={{ border: "2px solid var(--accent-color)" }}
        >
          <h2 className="text-2xl font-semibold mb-4">
            Ready to Start Your Dive Journey?
          </h2>
          <p className="opacity-75 mb-6">
            Contact {organization?.name || "us"} directly to learn about
            available courses, certification programs, and class schedules.
          </p>
          <Link
            to="/site/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all hover:scale-105"
            style={{ backgroundColor: "var(--primary-color)" }}
          >
            Contact Us
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </Link>
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <Link
            to="/site"
            className="inline-flex items-center gap-2 font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--primary-color)" }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
