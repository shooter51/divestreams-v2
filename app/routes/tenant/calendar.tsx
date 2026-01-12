import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Calendar - DiveStreams" }];

export default function CalendarPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Calendar</h1>
      <div className="bg-white rounded-xl p-6 shadow-sm min-h-[500px]">
        <p className="text-gray-500">Calendar view coming soon...</p>
      </div>
    </div>
  );
}
