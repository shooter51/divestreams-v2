/**
 * Dive Trips Page
 *
 * Displays available dive trips and expeditions.
 * Currently a placeholder - will be implemented in a future update.
 */

import { Link, useRouteLoaderData } from "react-router";
import type { SiteLoaderData } from "./_layout";

export default function TripsPage() {
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
              d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292M6.115 5.19A9 9 0 1017.18 4.64M6.115 5.19A8.965 8.965 0 0112 3c1.929 0 3.716.607 5.18 1.64"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="text-4xl font-bold mb-4">Dive Trips & Expeditions</h1>
        <p className="text-xl opacity-75 mb-8 max-w-2xl mx-auto">
          Our dive trips page is coming soon! We're preparing an exciting
          catalog of local dives, exotic destinations, and unforgettable
          underwater adventures.
        </p>

        {/* Contact CTA */}
        <div
          className="bg-white rounded-xl p-8 max-w-md mx-auto"
          style={{ border: "2px solid var(--accent-color)" }}
        >
          <h2 className="text-2xl font-semibold mb-4">
            Ready to Explore the Depths?
          </h2>
          <p className="opacity-75 mb-6">
            Contact {organization?.name || "us"} directly to inquire about
            upcoming dive trips, availability, and booking information.
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
