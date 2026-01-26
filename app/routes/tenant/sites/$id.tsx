import type { MetaFunction } from "react-router";
import { useParams } from "react-router";

export const meta: MetaFunction = () => [{ title: "Dive Site Details - DiveStreams" }];

export default function DiveSiteDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dive Site Details</h1>
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
        <p className="text-foreground-muted">Dive site details coming soon...</p>
      </div>
    </div>
  );
}
