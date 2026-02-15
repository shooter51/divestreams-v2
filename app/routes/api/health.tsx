import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Check database
  try {
    const { db } = await import("../../../lib/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch (error) {
    checks.database = "error";
    healthy = false;
  }

  // Check Redis
  try {
    const { getRedisConnection } = await import("../../../lib/redis.server");
    const redis = getRedisConnection();
    await redis.ping();
    checks.redis = "ok";
  } catch (error) {
    checks.redis = "error";
    healthy = false;
  }

  const status = healthy ? "ok" : "degraded";
  const httpStatus = healthy ? 200 : 503;

  return Response.json(
    {
      status,
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      checks,
    },
    { status: httpStatus }
  );
}

export default function Health() {
  return null;
}
