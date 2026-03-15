import type { LoaderFunctionArgs } from "react-router";
import { timingSafeEqual } from "crypto";
import { apiSuccess, apiError } from "../../../lib/api/response";

export async function loader({ request }: LoaderFunctionArgs) {
  // If HEALTH_CHECK_KEY is set, require authentication
  const healthCheckKey = process.env.HEALTH_CHECK_KEY;
  if (healthCheckKey) {
    const providedKey = request.headers.get("X-Health-Key") || "";
    const expected = Buffer.from(healthCheckKey);
    const provided = Buffer.from(providedKey);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return apiError("Unauthorized", 401);
    }
  }

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
  return apiSuccess({ status }, httpStatus);
}

export default function Health() {
  return null;
}
