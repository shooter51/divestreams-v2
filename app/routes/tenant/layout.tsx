import { Outlet, Link, useLoaderData, useLocation } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireTenant, type TenantContext } from "../../../lib/auth/tenant-auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);

  return {
    tenant: {
      name: tenant.name,
      subdomain: tenant.subdomain,
      subscriptionStatus: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt?.toISOString(),
    },
  };
}

export default function TenantLayout() {
  const { tenant } = useLoaderData<typeof loader>();
  const location = useLocation();

  const isTrialing = tenant.subscriptionStatus === "trialing";
  const trialDaysLeft = tenant.trialEndsAt
    ? Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const navItems = [
    { href: "/app", label: "Dashboard", icon: "📊" },
    { href: "/app/bookings", label: "Bookings", icon: "📅" },
    { href: "/app/calendar", label: "Calendar", icon: "🗓️" },
    { href: "/app/customers", label: "Customers", icon: "👥" },
    { href: "/app/tours", label: "Tours", icon: "🏝️" },
    { href: "/app/trips", label: "Trips", icon: "🚤" },
    { href: "/app/dive-sites", label: "Dive Sites", icon: "🌊" },
    { href: "/app/boats", label: "Boats", icon: "⛵" },
    { href: "/app/equipment", label: "Equipment", icon: "🤿" },
    { href: "/app/reports", label: "Reports", icon: "📈" },
    { href: "/app/settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Trial Banner */}
      {isTrialing && trialDaysLeft > 0 && (
        <div className="bg-blue-600 text-white text-center py-2 text-sm">
          You have {trialDaysLeft} days left in your free trial.{" "}
          <Link to="/app/settings/billing" className="underline font-medium">
            Upgrade now
          </Link>
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white min-h-screen border-r border-gray-200 fixed">
          <div className="p-4 border-b">
            <h1 className="text-xl font-bold text-blue-600">{tenant.name}</h1>
            <p className="text-sm text-gray-500">{tenant.subdomain}.divestreams.com</p>
          </div>

          <nav className="p-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/app"
                    ? location.pathname === "/app"
                    : location.pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                👤
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Staff User</p>
                <p className="text-xs text-gray-500">Manager</p>
              </div>
              <Link to="/auth/logout" className="text-gray-400 hover:text-gray-600">
                ↪️
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
