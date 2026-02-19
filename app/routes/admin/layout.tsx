import type { LoaderFunctionArgs } from "react-router";
import { Outlet, Link, useLocation, redirect, useLoaderData, isRouteErrorResponse, useRouteError } from "react-router";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import { isAdminSubdomain } from "../../../lib/auth/org-context.server";
import { getAppUrl } from "../../../lib/utils/url";
import { ToastProvider } from "../../../lib/toast-context";

export async function loader({ request }: LoaderFunctionArgs) {
  // Only allow access on admin subdomain
  if (!isAdminSubdomain(request)) {
    throw redirect(getAppUrl());
  }

  const context = await requirePlatformContext(request);

  return {
    user: {
      name: context.user.name,
      email: context.user.email,
    },
    isOwner: context.isOwner,
    isAdmin: context.isAdmin,
  };
}

export default function AdminLayout() {
  const location = useLocation();
  const { user, isOwner } = useLoaderData<typeof loader>();

  const navItems = [
    { href: "/dashboard", label: "Organizations", icon: "🏢" },
    { href: "/plans", label: "Plans", icon: "💳" },
    { href: "/settings/team", label: "Settings", icon: "⚙️" },
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface-inset">
        {/* Top bar */}
        <header className="bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="font-bold text-lg">DiveStreams Admin</h1>
              <nav className="flex gap-4">
                {navItems.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? location.pathname === "/"
                      : location.pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "text-gray-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-gray-400">{user.email}</span>
                {isOwner && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-warning/20 text-warning rounded">
                    Owner
                  </span>
                )}
              </div>
              <form action="/logout" method="post">
                <button
                  type="submit"
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Outlet />
        </main>
      </div>
    </ToastProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isRouteError = isRouteErrorResponse(error);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          {isRouteError ? error.status : "Error"}
        </h1>
        <p className="text-foreground-muted mb-6">
          {isRouteError
            ? error.statusText || "Something went wrong."
            : "An unexpected error occurred."}
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            Go to Dashboard
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-surface-raised text-foreground rounded-lg border border-border hover:bg-surface-inset"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
