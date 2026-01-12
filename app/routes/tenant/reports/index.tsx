import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Reports - DiveStreams" }];

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-2">Revenue Report</h2>
          <p className="text-gray-500 text-sm">Track income and revenue trends</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-2">Booking Report</h2>
          <p className="text-gray-500 text-sm">Analyze booking patterns and trends</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-2">Customer Report</h2>
          <p className="text-gray-500 text-sm">Customer acquisition and retention</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-2">Equipment Report</h2>
          <p className="text-gray-500 text-sm">Equipment utilization and maintenance</p>
        </div>
      </div>
    </div>
  );
}
