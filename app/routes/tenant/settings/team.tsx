import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Team - DiveStreams" }];

export default function TeamPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Team Members</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Invite Member
        </button>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">👤</div>
            <div>
              <p className="font-medium">You (Owner)</p>
              <p className="text-sm text-gray-500">owner@example.com</p>
            </div>
          </div>
          <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">Owner</span>
        </div>
        <p className="text-gray-500 text-center py-8">Invite team members to collaborate</p>
      </div>
    </div>
  );
}
