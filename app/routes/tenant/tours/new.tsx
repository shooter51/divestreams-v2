import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Create Tour - DiveStreams" }];

export default function NewTourPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Create Tour</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-500">Tour form coming soon...</p>
      </div>
    </div>
  );
}
