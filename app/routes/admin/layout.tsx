import type { LoaderFunctionArgs } from "react-router";
import { Outlet, Link, useLocation, redirect } from "react-router";
import { requireAdmin, isAdminSubdomain } from "../../../lib/auth/admin-auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Only allow access on admin subdomain
  if (!isAdminSubdomain(request)) {
    throw redirect("https://divestreams.com");
  }

  requireAdmin(request);
  return null;
}

export default function AdminLayout() {
  const location = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Tenants", icon: "🏢" },
    { href: "/plans", label: "Plans", icon: "💳" },
    { href: "/migrations", label: "Migrations", icon: "🔧" },
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
          <form action="/logout" method="post">
            <button
              type="submit"
              className="text-gray-300 hover:text-white text-sm"
            >
              Logout
            </button>
          </form>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
