import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Dive Sites - DiveStreams" }];

export default function DiveSitesPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dive Sites</h1>
        <a href="/tenant/sites/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Add Site
        </a>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">No dive sites yet. Add your first dive site to get started.</p>
      </div>
    </div>
  );
}
