/**
 * Custom 404 Not Found Page for Public Sites
 *
 * Displays a themed 404 page when users navigate to non-existent routes
 * within a tenant's public site. Inherits the site's theme and branding.
 */

import { Link, useRouteLoaderData } from "react-router";
import type { SiteLoaderData } from "./_layout";

export default function SiteNotFound() {
  const layoutData = useRouteLoaderData("routes/site/_layout") as
    | SiteLoaderData
    | undefined;

  const organization = layoutData?.organization;
  const enabledPages = layoutData?.enabledPages;

  // Suggested pages to visit
  const suggestions: { href: string; label: string; icon: string }[] = [];

  if (enabledPages?.home) {
    suggestions.push({
      href: "/site",
      label: "Home",
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    });
  }
  if (enabledPages?.trips) {
    suggestions.push({
      href: "/site/trips",
      label: "Trips",
      icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
    });
  }
  if (enabledPages?.courses) {
    suggestions.push({
      href: "/site/courses",
      label: "Courses",
      icon: "M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z",
    });
  }
  if (enabledPages?.about) {
    suggestions.push({
      href: "/site/about",
      label: "About",
      icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    });
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div
            className="inline-flex items-center justify-center w-32 h-32 rounded-full mb-6"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            <svg
              className="w-16 h-16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
              style={{ color: "var(--primary-color)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1
            className="text-6xl font-bold mb-4"
            style={{ color: "var(--primary-color)" }}
          >
            404
          </h1>
          <h2 className="text-3xl font-bold mb-4">Page Not Found</h2>
          <p className="text-lg opacity-75 max-w-md mx-auto">
            Sorry, we couldn't find the page you're looking for. It may have
            been moved or doesn't exist.
          </p>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mb-8">
            <p className="text-sm font-semibold mb-4 opacity-75">
              Try one of these pages instead:
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {suggestions.map((suggestion) => (
                <Link
                  key={suggestion.href}
                  to={suggestion.href}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
                  style={{
                    backgroundColor: "var(--accent-color)",
                    color: "var(--primary-color)",
                  }}
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
                      d={suggestion.icon}
                    />
                  </svg>
                  {suggestion.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            to="/site"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all hover:scale-105"
            style={{ backgroundColor: "var(--primary-color)" }}
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

          {enabledPages?.contact && (
            <Link
              to="/site/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors"
              style={{ color: "var(--primary-color)" }}
            >
              Contact {organization?.name || "Us"}
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
          )}
        </div>
      </div>
    </div>
  );
}
