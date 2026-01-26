import { Outlet, NavLink } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requirePlatformContext(request);
  return {};
}

export default function AdminSettings() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-6">
        <nav className="w-48 space-y-1">
          <NavLink
            to="/admin/settings/team"
            className={({ isActive }) =>
              `block px-4 py-2 rounded ${isActive ? "bg-brand-muted text-brand" : "hover:bg-surface-inset"}`
            }
          >
            Team Members
          </NavLink>
        </nav>

        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
