import type { MetaFunction } from "react-router";
import { useSearchParams } from "react-router";
import { useEffect, useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Setting Up Your Shop - DiveStreams" },
    { name: "robots", content: "noindex" },
  ];
};

const REDIRECT_DELAY_MS = 30000;

export default function TenantSetupPage() {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("url") ?? "/";

  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(REDIRECT_DELAY_MS / 1000));
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          setRedirecting(true);
          window.location.href = redirectUrl;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [redirectUrl]);

  return (
    <div className="min-h-screen bg-surface-inset flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <a href="/" className="text-2xl font-bold text-brand">
            DiveStreams
          </a>
        </div>

        <div className="bg-surface-raised rounded-xl p-8 shadow-sm border">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-3">Your shop is being set up!</h1>
          <p className="text-foreground-muted mb-6">
            We are provisioning your secure subdomain. This takes about 30 seconds on the first visit.
            You will be redirected automatically.
          </p>

          <div className="bg-surface-inset rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-foreground-muted">
              Redirecting in{" "}
              <span className="font-bold text-brand text-lg">{secondsLeft}</span>{" "}
              second{secondsLeft !== 1 ? "s" : ""}…
            </p>
          </div>

          <a
            href={redirectUrl}
            className="inline-block w-full bg-brand text-white py-3 rounded-lg hover:bg-brand-hover text-center"
            onClick={() => setRedirecting(true)}
          >
            {redirecting ? "Redirecting…" : "Go to my shop now"}
          </a>

          <p className="text-xs text-foreground-subtle mt-4">
            If you see a security warning on the next page, wait a moment and refresh — your SSL certificate is still being issued.
          </p>
        </div>
      </div>
    </div>
  );
}
