/**
 * Site Disabled Message
 *
 * Displayed when a tenant's public site is disabled.
 * Shows a friendly message with the organization name and branding.
 */

import { Link, useSearchParams } from "react-router";

export default function SiteDisabled() {
  const [searchParams] = useSearchParams();
  const orgName = searchParams.get("org") || "This Organization";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
      <div className="max-w-md w-full">
        <div className="bg-surface-raised rounded-2xl shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-brand-muted flex items-center justify-center">
            <svg
              className="w-10 h-10 text-brand"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          {/* Message */}
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Public Site Unavailable
          </h1>
          <p className="text-foreground-muted mb-6 leading-relaxed">
            The public website for <strong>{orgName}</strong> is currently
            disabled. Please contact the organization directly for more
            information.
          </p>

          {/* Action */}
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors"
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
            Return to DiveStreams
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-foreground-muted mt-6">
          Powered by{" "}
          <a
            href="https://divestreams.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:text-brand-hover font-medium"
          >
            DiveStreams
          </a>
        </p>
      </div>
    </div>
  );
}
