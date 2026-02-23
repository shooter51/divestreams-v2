import { SeedClient } from "./client";

export async function login(
  client: SeedClient,
  email: string,
  password: string
): Promise<void> {
  const res = await client.postJson("/api/auth/sign-in/email", {
    email,
    password,
  });

  if (!res.ok) {
    const detail =
      typeof res.body === "object" && res.body !== null
        ? JSON.stringify(res.body)
        : String(res.body);
    throw new Error(
      `Login failed for ${email} (HTTP ${res.status}): ${detail}`
    );
  }

  const body = res.body as Record<string, unknown>;
  if (body?.error) {
    throw new Error(`Login error for ${email}: ${JSON.stringify(body.error)}`);
  }

  console.log(`✓ Logged in as ${email}`);
}
