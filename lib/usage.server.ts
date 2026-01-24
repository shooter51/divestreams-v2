import { db } from "./db";
import { customers, tours, member } from "./db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import type { PlanLimits } from "./plan-features";
import { LIMIT_WARNING_THRESHOLD } from "./plan-features";

export interface UsageStats {
  users: number;
  customers: number;
  toursPerMonth: number;
  storageGb: number;
}

export async function getUsage(organizationId: string): Promise<UsageStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [userCount, customerCount, tourCount] = await Promise.all([
    db.select({ count: count() }).from(member).where(eq(member.organizationId, organizationId)),
    db.select({ count: count() }).from(customers).where(eq(customers.organizationId, organizationId)),
    db.select({ count: count() }).from(tours).where(
      and(
        eq(tours.organizationId, organizationId),
        gte(tours.createdAt, startOfMonth)
      )
    ),
  ]);

  // TODO: Storage tracking not yet implemented
  // Storage limits are not enforced until file upload tracking is added.
  // This will require a separate table to track uploaded files per organization.
  const storageGb = 0;

  return {
    users: userCount[0]?.count ?? 0,
    customers: customerCount[0]?.count ?? 0,
    toursPerMonth: tourCount[0]?.count ?? 0,
    storageGb,
  };
}

export interface LimitCheck {
  allowed: boolean;
  warning: boolean;
  percent: number;
  current: number;
  limit: number;
  remaining: number;
}

export function checkLimit(current: number, limit: number): LimitCheck {
  if (limit === -1) {
    return { allowed: true, warning: false, percent: 0, current, limit, remaining: -1 };
  }
  const percent = Math.round((current / limit) * 100);
  return {
    allowed: current < limit,
    warning: current < limit && (current / limit) >= LIMIT_WARNING_THRESHOLD,
    percent,
    current,
    limit,
    remaining: Math.max(0, limit - current),
  };
}

export function checkAllLimits(usage: UsageStats, limits: PlanLimits): Record<keyof PlanLimits, LimitCheck> {
  return {
    users: checkLimit(usage.users, limits.users),
    customers: checkLimit(usage.customers, limits.customers),
    toursPerMonth: checkLimit(usage.toursPerMonth, limits.toursPerMonth),
    storageGb: checkLimit(usage.storageGb, limits.storageGb),
  };
}
