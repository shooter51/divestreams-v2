import type { SeedClient } from "./client";

export async function resetDemoData(
  client: SeedClient,
  seedKey: string
): Promise<void> {
  console.log("🗑️  Resetting demo data...");

  const url = `${client.baseUrl}/api/seed/reset`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: seedKey, tenant: "demo" }),
  });

  if (response.status === 404) {
    console.log("⚠️  Reset endpoint not deployed yet — skipping (data will be additive)");
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    throw new Error(
      `Reset failed: HTTP ${response.status} — ${text}`
    );
  }

  const data = (await response.json()) as {
    deleted: Record<string, number>;
  };

  const counts = Object.entries(data.deleted)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  console.log(`✓ Deleted ${counts}`);
}
