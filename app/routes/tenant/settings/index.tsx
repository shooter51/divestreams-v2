import type { MetaFunction } from "react-router";
import { Link } from "react-router";

export const meta: MetaFunction = () => [{ title: "Settings - DiveStreams" }];

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="grid gap-4 max-w-2xl">
        <Link to="/app/settings/billing" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow block">
          <h2 className="font-semibold mb-1">Billing & Subscription</h2>
          <p className="text-gray-500 text-sm">Manage your subscription and payment methods</p>
        </Link>
        <Link to="/app/settings/team" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow block">
          <h2 className="font-semibold mb-1">Team Members</h2>
          <p className="text-gray-500 text-sm">Invite and manage team access</p>
        </Link>
        <Link to="/app/settings/integrations" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow block">
          <h2 className="font-semibold mb-1">Integrations</h2>
          <p className="text-gray-500 text-sm">Connect third-party services</p>
        </Link>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-1">Shop Profile</h2>
          <p className="text-gray-500 text-sm">Update your dive shop information</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-1">Notifications</h2>
          <p className="text-gray-500 text-sm">Configure email and notification preferences</p>
        </div>
      </div>
    </div>
  );
}
