import type { MetaFunction } from "react-router";
import { useParams } from "react-router";

export const meta: MetaFunction = () => [{ title: "Trip Details - DiveStreams" }];

export default function TripDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Trip Details</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">Trip details coming soon...</p>
      </div>
    </div>
  );
}
