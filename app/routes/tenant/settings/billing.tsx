import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Billing - DiveStreams" }];

export default function BillingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Billing & Subscription</h1>
      <div className="grid gap-6 max-w-2xl">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Current Plan</h2>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-lg font-medium">Starter</p>
              <p className="text-gray-500">$49/month</p>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Upgrade Plan
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Payment Method</h2>
          <p className="text-gray-500">No payment method on file.</p>
          <button className="mt-4 text-blue-600">Add payment method</button>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Billing History</h2>
          <p className="text-gray-500">No billing history yet.</p>
        </div>
      </div>
    </div>
  );
}
