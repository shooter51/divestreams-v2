/**
 * Account Layout with Auth Guard
 *
 * This layout wraps all account pages and:
 * - Checks for customer session cookie
 * - Redirects to login if not authenticated
 * - Provides customer context to child routes
 */

import { Outlet, Link, useLoaderData, useLocation, redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getCustomerBySession } from "../../../../lib/auth/customer-auth.server";
import type { Customer } from "../../../../lib/db/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface AccountLoaderData {
  customer: Customer;
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs): Promise<AccountLoaderData> {
  // Get session token from cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").filter(Boolean).map((c) => {
      const [key, ...rest] = c.split("=");
      return [key, rest.join("=")];
    })
  );

  const sessionToken = cookies["customer_session"];

  if (!sessionToken) {
    // Not logged in - redirect to login
    throw redirect("/site/login?redirect=/site/account");
  }

  // Get customer from session
  const customer = await getCustomerBySession(sessionToken);

  if (!customer) {
    // Invalid or expired session - redirect to login
    throw redirect("/site/login?redirect=/site/account");
  }

  return { customer };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountLayout() {
  const { customer } = useLoaderData<typeof loader>();
  const location = useLocation();

  // Navigation items for account section
  const navItems = [
    { href: "/site/account", label: "Dashboard", icon: HomeIcon },
    { href: "/site/account/bookings", label: "My Bookings", icon: CalendarIcon },
    { href: "/site/account/profile", label: "Profile", icon: UserIcon },
  ];

  // Check if nav item is active
  const isActive = (href: string) => {
    if (href === "/site/account") {
      return location.pathname === "/site/account" || location.pathname === "/site/account/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-[calc(100vh-12rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Account Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-color)" }}>
            My Account
          </h1>
          <p className="mt-2 opacity-75">
            Welcome back, {customer.firstName}!
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      active ? "font-medium" : ""
                    }`}
                    style={{
                      backgroundColor: active ? "var(--accent-color)" : "transparent",
                      color: active ? "var(--primary-color)" : "var(--text-color)",
                    }}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Logout Link */}
            <div className="mt-8 pt-8 border-t" style={{ borderColor: "var(--accent-color)" }}>
              <form method="post" action="/site/account/logout">
                <button
                  type="submit"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left transition-colors hover:bg-danger-muted text-danger"
                >
                  <LogoutIcon className="w-5 h-5" />
                  Log Out
                </button>
              </form>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <Outlet context={{ customer }} />
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

// ============================================================================
// CONTEXT HOOK
// ============================================================================

import { useOutletContext } from "react-router";

export function useAccountContext() {
  return useOutletContext<{ customer: Customer }>();
}
