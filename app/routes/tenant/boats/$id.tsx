import type { MetaFunction } from "react-router";
import { useParams } from "react-router";

export const meta: MetaFunction = () => [{ title: "Boat Details - DiveStreams" }];

export default function BoatDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Boat Details</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">Boat details coming soon...</p>
      </div>
    </div>
  );
}
