import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Boats - DiveStreams" }];

export default function BoatsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Boats</h1>
        <a href="/app/boats/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Add Boat
        </a>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">No boats yet. Add your first boat to get started.</p>
      </div>
    </div>
  );
}
