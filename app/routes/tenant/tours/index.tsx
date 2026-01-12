import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Tours - DiveStreams" }];

export default function ToursPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tours</h1>
        <a href="/app/tours/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Create Tour
        </a>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">No tours yet. Create your first tour template to get started.</p>
      </div>
    </div>
  );
}
