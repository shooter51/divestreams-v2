import type { MetaFunction } from "react-router";
import { useParams } from "react-router";

export const meta: MetaFunction = () => [{ title: "Tour Details - DiveStreams" }];

export default function TourDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tour Details</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">Tour details coming soon...</p>
      </div>
    </div>
  );
}
