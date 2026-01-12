import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useParams } from "react-router";

export const meta: MetaFunction = () => [{ title: "Booking Details - DiveStreams" }];

export default function BookingDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Booking #{id}</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">Booking details coming soon...</p>
      </div>
    </div>
  );
}
