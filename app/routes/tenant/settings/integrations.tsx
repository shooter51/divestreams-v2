import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Integrations - DiveStreams" }];

export default function IntegrationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Integrations</h1>
      <div className="grid gap-4 max-w-2xl">
        <div className="bg-white rounded-xl p-6 shadow-sm flex justify-between items-center">
          <div>
            <h2 className="font-semibold">Stripe</h2>
            <p className="text-gray-500 text-sm">Process payments and deposits</p>
          </div>
          <button className="text-blue-600">Configure</button>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm flex justify-between items-center">
          <div>
            <h2 className="font-semibold">Google Calendar</h2>
            <p className="text-gray-500 text-sm">Sync trips with Google Calendar</p>
          </div>
          <button className="text-blue-600">Connect</button>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm flex justify-between items-center">
          <div>
            <h2 className="font-semibold">Mailchimp</h2>
            <p className="text-gray-500 text-sm">Sync customers for email marketing</p>
          </div>
          <button className="text-blue-600">Connect</button>
        </div>
      </div>
    </div>
  );
}
