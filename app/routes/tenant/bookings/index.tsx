import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Bookings - DiveStreams" }];

export default function BookingsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <a href="/app/bookings/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          New Booking
        </a>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">No bookings yet. Create your first booking to get started.</p>
      </div>
    </div>
  );
}
