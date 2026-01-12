import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "New Booking - DiveStreams" }];

export default function NewBookingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Booking</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">Booking form coming soon...</p>
      </div>
    </div>
  );
}
