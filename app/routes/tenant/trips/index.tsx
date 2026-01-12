import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Trips - DiveStreams" }];

export default function TripsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Scheduled Trips</h1>
        <a href="/app/trips/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Schedule Trip
        </a>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">No trips scheduled. Schedule your first trip to get started.</p>
      </div>
    </div>
  );
}
