/**
 * Equipment Rental Page
 *
 * Displays available dive equipment for rent.
 * Currently a placeholder - will be implemented in a future update.
 */

import { Link, useRouteLoaderData } from "react-router";
import type { SiteLoaderData } from "./_layout";

export default function EquipmentPage() {
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
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="text-4xl font-bold mb-4">Equipment Rental</h1>
        <p className="text-xl opacity-75 mb-8 max-w-2xl mx-auto">
          Our equipment rental page is coming soon! We're preparing a
          comprehensive catalog of dive gear available for rent.
        </p>

        {/* Contact CTA */}
        <div
          className="bg-white rounded-xl p-8 max-w-md mx-auto"
          style={{ border: "2px solid var(--accent-color)" }}
        >
          <h2 className="text-2xl font-semibold mb-4">Need Equipment Now?</h2>
          <p className="opacity-75 mb-6">
            Contact {organization?.name || "us"} directly to inquire about
            equipment rental availability and pricing.
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
