import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Add Boat - DiveStreams" }];

export default function NewBoatPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add Boat</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">Boat form coming soon...</p>
      </div>
    </div>
  );
}
