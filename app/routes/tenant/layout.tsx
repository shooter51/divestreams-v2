import { useState } from "react";
import { Outlet, Link, useLoaderData, useLocation } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireOrgContext } from "../../../lib/auth/org-context.server";
import { getBaseDomain } from "../../../lib/utils/url";
import { FeaturesContext } from "../../../lib/features-context";
import { UpgradeModal } from "../../components/upgrade-modal";
import type { PlanFeatureKey, PlanFeaturesObject, PlanLimits } from "../../../lib/plan-features";
import { DEFAULT_PLAN_FEATURES, DEFAULT_PLAN_LIMITS } from "../../../lib/plan-features";

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

  // Get plan features and limits
  // Features can be PlanFeaturesObject or legacy string[] format
  const rawFeatures = ctx.subscription?.planDetails?.features;
  const features: PlanFeaturesObject =
    rawFeatures && typeof rawFeatures === "object" && !Array.isArray(rawFeatures)
      ? (rawFeatures as PlanFeaturesObject)
      : DEFAULT_PLAN_FEATURES.free;
  const limits: PlanLimits = ctx.subscription?.planDetails?.limits ?? DEFAULT_PLAN_LIMITS.free;
  const planName = ctx.subscription?.planDetails?.displayName ?? "Free";

  return {
    tenant: {
      name: ctx.org.name,
      subdomain: ctx.org.slug,
      subscriptionStatus,
      trialDaysLeft,
    },
    features,
    limits,
    planName,
  };
}

export default function TenantLayout() {
  const { tenant, features, limits, planName } = useLoaderData<typeof loader>();
  const location = useLocation();
  const [upgradeFeature, setUpgradeFeature] = useState<PlanFeatureKey | null>(null);

  const isTrialing = tenant.subscriptionStatus === "trialing";
  // Use server-calculated trialDaysLeft for accurate countdown
  const trialDaysLeft = tenant.trialDaysLeft;

  const navItems: Array<{
    href: string;
    label: string;
    icon: string;
    feature?: PlanFeatureKey;
  }> = [
    { href: "/tenant", label: "Dashboard", icon: "📊" },
    { href: "/tenant/bookings", label: "Bookings", icon: "📅", feature: "has_tours_bookings" },
    { href: "/tenant/calendar", label: "Calendar", icon: "🗓️" },
    { href: "/tenant/customers", label: "Customers", icon: "👥" },
    { href: "/tenant/tours", label: "Tours", icon: "🏝️", feature: "has_tours_bookings" },
    { href: "/tenant/trips", label: "Trips", icon: "🚤", feature: "has_tours_bookings" },
    { href: "/tenant/dive-sites", label: "Dive Sites", icon: "🌊" },
    { href: "/tenant/boats", label: "Boats", icon: "⛵", feature: "has_equipment_boats" },
    { href: "/tenant/equipment", label: "Equipment", icon: "🤿", feature: "has_equipment_boats" },
    { href: "/tenant/products", label: "Products", icon: "📦" },
    { href: "/tenant/discounts", label: "Discounts", icon: "🏷️" },
    { href: "/tenant/training", label: "Training", icon: "🎓", feature: "has_training" },
    { href: "/tenant/gallery", label: "Gallery", icon: "📸" },
    { href: "/tenant/pos", label: "POS", icon: "💳", feature: "has_pos" },
    { href: "/tenant/reports", label: "Reports", icon: "📈" },
    { href: "/tenant/settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Trial Banner */}
      {isTrialing && trialDaysLeft > 0 && (
        <div className="bg-blue-600 text-white text-center py-2 text-sm">
          You have {trialDaysLeft} days left in your free trial.{" "}
          <Link to="/tenant/settings/billing" className="underline font-medium">
            Upgrade now
          </Link>
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white h-screen border-r border-gray-200 fixed flex flex-col">
          <div className="p-4 border-b flex-shrink-0">
            <h1 className="text-xl font-bold text-blue-600">{tenant.name}</h1>
            <p className="text-sm text-gray-500">{tenant.subdomain}.{getBaseDomain()}</p>
          </div>

          <nav className="p-4 flex-1 overflow-y-auto">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/tenant"
                    ? location.pathname === "/tenant"
                    : location.pathname.startsWith(item.href);

                // Check if feature is available
                const hasAccess = !item.feature || features[item.feature];

                if (hasAccess) {
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
                } else {
                  // Locked feature - show with lock icon
                  return (
                    <li key={item.href}>
                      <button
                        onClick={() => setUpgradeFeature(item.feature!)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-50 cursor-pointer"
                      >
                        <span className="opacity-50">{item.icon}</span>
                        <span className="flex-1 text-left">{item.label}</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </button>
                    </li>
                  );
                }
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
        <FeaturesContext.Provider value={{ features, limits, planName }}>
          <main className="flex-1 ml-64 p-8">
            <Outlet />
          </main>
        </FeaturesContext.Provider>
      </div>

      {upgradeFeature && (
        <UpgradeModal
          feature={upgradeFeature}
          onClose={() => setUpgradeFeature(null)}
        />
      )}
    </div>
  );
}
