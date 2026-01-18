/**
 * Photo Gallery Page
 *
 * Displays photos and videos from dive trips and courses.
 * Currently a placeholder - will be implemented in a future update.
 */

import { Link, useRouteLoaderData } from "react-router";
import type { SiteLoaderData } from "./_layout";

export default function GalleryPage() {
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
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="text-4xl font-bold mb-4">Photo Gallery</h1>
        <p className="text-xl opacity-75 mb-8 max-w-2xl mx-auto">
          Our photo gallery is coming soon! We're preparing an amazing
          collection of underwater photos and videos from our dive adventures.
        </p>

        {/* Preview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-square rounded-xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, var(--primary-color), var(--secondary-color))`,
              }}
            >
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  className="w-16 h-16 text-white/20"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div
          className="bg-white rounded-xl p-8 max-w-md mx-auto"
          style={{ border: "2px solid var(--accent-color)" }}
        >
          <h2 className="text-2xl font-semibold mb-4">
            Want to See More Photos?
          </h2>
          <p className="opacity-75 mb-6">
            Contact {organization?.name || "us"} or follow us on social media
            to see photos from recent dive trips and adventures.
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
