import { Outlet, Link, useLoaderData, useLocation } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireOrgContext } from "../../../lib/auth/org-context.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Calculate trial days left on the server to ensure accurate countdown
  // This ensures the value is fresh on every request, not cached client-side
  let trialDaysLeft = 0;
  const trialEndsAt = ctx.subscription?.trialEndsAt;
  if (trialEndsAt) {
    const now = new Date();
    const trialEnd = new Date(trialEndsAt);
    const msLeft = trialEnd.getTime() - now.getTime();
    trialDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  }

  // Determine subscription status from subscription table
  const subscriptionStatus = ctx.subscription?.status ?? "free";

  return {
    tenant: {
      name: ctx.org.name,
      subdomain: ctx.org.slug,
      subscriptionStatus,
      trialDaysLeft,
    },
  };
}

export default function TenantLayout() {
  const { tenant } = useLoaderData<typeof loader>();
  const location = useLocation();

  const isTrialing = tenant.subscriptionStatus === "trialing";
  // Use server-calculated trialDaysLeft for accurate countdown
  const trialDaysLeft = tenant.trialDaysLeft;

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
    { href: "/app/products", label: "Products", icon: "📦" },
    { href: "/app/discounts", label: "Discounts", icon: "🏷️" },
    { href: "/app/pos", label: "POS", icon: "💳" },
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
        <aside className="w-64 bg-white h-screen border-r border-gray-200 fixed flex flex-col">
          <div className="p-4 border-b flex-shrink-0">
            <h1 className="text-xl font-bold text-blue-600">{tenant.name}</h1>
            <p className="text-sm text-gray-500">{tenant.subdomain}.divestreams.com</p>
          </div>

          <nav className="p-4 flex-1 overflow-y-auto">
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

          <div className="p-4 border-t bg-white flex-shrink-0">
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
