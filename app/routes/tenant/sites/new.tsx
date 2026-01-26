import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [{ title: "Add Dive Site - DiveStreams" }];

export default function NewDiveSitePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add Dive Site</h1>
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
        <p className="text-foreground-muted">Dive site form coming soon...</p>
      </div>
    </div>
  );
}
