import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Schedule Trip - DiveStreams" }];

export default function NewTripPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Schedule Trip</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">Trip scheduling form coming soon...</p>
      </div>
    </div>
  );
}
