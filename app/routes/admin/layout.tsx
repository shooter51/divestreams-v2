import type { LoaderFunctionArgs } from "react-router";
import { Outlet, Link, useLocation, redirect, useLoaderData } from "react-router";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import { isAdminSubdomain } from "../../../lib/auth/org-context.server";
import { getAppUrl } from "../../../lib/utils/url";

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
  ];

  return (
    <div className="min-h-screen bg-gray-100">
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
                        ? "bg-gray-700 text-white"
                        : "text-gray-300 hover:text-white hover:bg-gray-800"
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
                <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-300 rounded">
                  Owner
                </span>
              )}
            </div>
            <form action="/logout" method="post">
              <button
                type="submit"
                className="text-gray-300 hover:text-white text-sm"
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
  );
}
