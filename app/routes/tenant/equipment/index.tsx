import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Equipment - DiveStreams" }];

export default function EquipmentPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Equipment</h1>
        <a href="/app/equipment/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Add Equipment
        </a>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">No equipment yet. Add your first equipment item to get started.</p>
      </div>
    </div>
  );
}
