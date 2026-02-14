import { useState } from "react";
import { Outlet, Link, useLoaderData, useLocation, useNavigation, useRouteError, isRouteErrorResponse } from "react-router";
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

  // Compute baseDomain on the server – getBaseDomain() accesses process.env
  // which is unavailable in the browser and would crash client-side hydration.
  const baseDomain = getBaseDomain();

  return {
    tenant: {
      name: ctx.org.name,
      subdomain: ctx.org.slug,
      subscriptionStatus,
      trialDaysLeft,
      baseDomain,
    },
    features,
    limits,
    planName,
  };
}

export default function TenantLayout() {
  const { tenant, features, limits, planName } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigation = useNavigation();
  const isNavigating = navigation.state === "loading";
  const [upgradeFeature, setUpgradeFeature] = useState<PlanFeatureKey | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <div className="min-h-screen bg-surface-inset">
        {/* Navigation Loading Bar */}
        {isNavigating && (
          <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-brand/20">
            <div className="h-full bg-brand animate-pulse" style={{ width: "90%", transition: "width 0.5s ease-out" }} />
          </div>
        )}

        {/* Trial Banner */}
        {isTrialing && trialDaysLeft > 0 && (
          <div className="bg-brand text-white text-center py-2 text-sm">
            You have {trialDaysLeft} days left in your free trial.{" "}
            <Link to="/tenant/settings/billing" className="underline font-medium">
              Upgrade now
            </Link>
          </div>
        )}

        <div className="flex">
          {/* Mobile Header */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border flex items-center h-14 px-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-surface-inset text-foreground-muted"
              aria-label="Toggle navigation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
            <h1 className="ml-3 text-lg font-bold text-brand truncate">{tenant.name}</h1>
          </div>

          {/* Sidebar Overlay (mobile) */}
          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
          )}

          {/* Sidebar */}
          <aside className={`w-64 bg-surface h-screen border-r border-border fixed flex flex-col z-50 transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
            <div className="p-4 border-b border-border flex-shrink-0">
              <h1 className="text-xl font-bold text-brand">{tenant.name}</h1>
              <p className="text-sm text-foreground-muted">{tenant.subdomain}.{tenant.baseDomain}</p>
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
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            isActive
                              ? "bg-brand-muted text-brand"
                              : "text-foreground-muted hover:bg-surface-inset"
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
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-foreground-subtle hover:bg-surface-inset"
                          aria-label={`${item.label} - locked feature, click to upgrade`}
                        >
                          <span className="opacity-50">{item.icon}</span>
                          <span className="flex-1 text-left">{item.label}</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </button>
                      </li>
                    );
                  }
                })}
              </ul>
            </nav>

            <div className="p-4 border-t border-border bg-surface flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-surface-overlay rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-foreground-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Staff User</p>
                  <p className="text-xs text-foreground-muted">Manager</p>
                </div>
                <Link
                  to="/auth/logout"
                  className="flex items-center gap-1.5 text-sm text-foreground-subtle hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded transition-colors"
                  title="Sign out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign Out</span>
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <FeaturesContext.Provider value={{ features, limits, planName }}>
            <main className="flex-1 lg:ml-64 p-4 lg:p-8 pt-18 lg:pt-8">
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

export function ErrorBoundary() {
  const error = useRouteError();
  const isResponse = isRouteErrorResponse(error);

  return (
    <div className="min-h-screen bg-surface-inset flex items-center justify-center">
      <div className="bg-surface-raised p-8 rounded-xl shadow-lg max-w-md text-center">
        <div className="w-16 h-16 bg-danger-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {isResponse ? `${error.status} - ${error.statusText}` : "Something went wrong"}
        </h1>
        <p className="text-foreground-muted mb-6">
          {isResponse
            ? "The page you're looking for could not be found."
            : "An unexpected error occurred. Please try again."}
        </p>
        <Link
          to="/tenant"
          className="inline-block bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
