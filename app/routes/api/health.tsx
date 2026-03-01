export async function loader() {
  let healthy = true;

  // Check database
  try {
    const { db } = await import("../../../lib/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
  } catch {
    healthy = false;
  }

  // Check Redis
  try {
    const { getRedisConnection } = await import("../../../lib/redis.server");
    const redis = getRedisConnection();
    await redis.ping();
  } catch {
    healthy = false;
  }

  const status = healthy ? "ok" : "degraded";
  const httpStatus = healthy ? 200 : 503;

  // Only expose status — no internal infrastructure details
  return Response.json(
    { status },
    { status: httpStatus }
  );
}

export default function Health() {
  return null;
}
