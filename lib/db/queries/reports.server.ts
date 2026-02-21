/**
 * Report / Stats / Dashboard Queries
 *
 * Aggregate queries for dashboard stats, revenue reports, team members,
 * billing, and staff management. Also contains the organization lookup
 * used by other modules for Google Calendar timezone resolution.
 */

import { eq, gte, lte, and, sql } from "drizzle-orm";
import { db } from "../index";
import * as schema from "../schema";

// ============================================================================
// Organization Queries
// ============================================================================

/**
 * Get organization by ID
 * Note: Organization table doesn't have timezone field yet, so this returns UTC by default
 */
export async function getOrganizationById(organizationId: string) {
  const result = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  return result[0] ?? null;
}

// ============================================================================
// Dashboard Stats
// ============================================================================

export async function getDashboardStats(organizationId: string) {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Run all 4 independent count queries in parallel
  const [todayBookingsResult, weekRevenueResult, activeTripsResult, totalCustomersResult] = await Promise.all([
    // Today's bookings count
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.organizationId, organizationId),
        sql`DATE(${schema.bookings.createdAt}) = ${today}`
      )),
    // This week's revenue (sum of paid transactions)
    db
      .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
      .from(schema.transactions)
      .where(and(
        eq(schema.transactions.organizationId, organizationId),
        eq(schema.transactions.type, "sale"),
        gte(schema.transactions.createdAt, new Date(weekAgo))
      )),
    // Active trips (scheduled trips today or tomorrow)
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.trips)
      .where(and(
        eq(schema.trips.organizationId, organizationId),
        sql`${schema.trips.status} IN ('scheduled', 'in_progress')`,
        lte(schema.trips.date, tomorrow)
      )),
    // Total customers
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.customers)
      .where(eq(schema.customers.organizationId, organizationId)),
  ]);

  return {
    todayBookings: Number(todayBookingsResult[0]?.count || 0),
    weekRevenue: Number(weekRevenueResult[0]?.total || 0),
    activeTrips: Number(activeTripsResult[0]?.count || 0),
    totalCustomers: Number(totalCustomersResult[0]?.count || 0),
  };
}

// ============================================================================
// Revenue Reports
// ============================================================================

export async function getRevenueOverview(organizationId: string) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // This month's revenue
  const thisMonthResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.organizationId, organizationId),
      eq(schema.transactions.type, "sale"),
      gte(schema.transactions.createdAt, startOfMonth)
    ));

  // Last month's revenue
  const lastMonthResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)` })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.organizationId, organizationId),
      eq(schema.transactions.type, "sale"),
      gte(schema.transactions.createdAt, startOfLastMonth),
      lte(schema.transactions.createdAt, endOfLastMonth)
    ));

  return {
    thisMonth: Number(thisMonthResult[0]?.total || 0),
    lastMonth: Number(lastMonthResult[0]?.total || 0),
  };
}

// ============================================================================
// Team Member Queries
// ============================================================================

export async function getTeamMembers(organizationId: string) {
  const members = await db
    .select({
      id: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      createdAt: schema.member.createdAt,
      userName: schema.user.name,
      userEmail: schema.user.email,
      userImage: schema.user.image,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, organizationId))
    .orderBy(schema.user.name);

  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.userName,
    email: m.userEmail,
    role: m.role,
    avatarUrl: m.userImage,
    createdAt: m.createdAt,
  }));
}

export async function getTeamMemberCount(organizationId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.member)
    .where(eq(schema.member.organizationId, organizationId));

  return Number(result[0]?.count || 0);
}

// ============================================================================
// Billing Queries
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getBillingHistory(_organizationId: string, _limit = 10) {
  // For now return empty - billing is handled by Stripe
  return [];
}

// ============================================================================
// Staff Queries
// ============================================================================

/**
 * Get staff members for an organization
 * Staff are organization members with roles: owner, admin, manager, staff
 */
export async function getStaff(
  organizationId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: { activeOnly?: boolean } = {}
) {
  const members = await db
    .select({
      id: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      name: schema.user.name,
      email: schema.user.email,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(
      and(
        eq(schema.member.organizationId, organizationId),
        sql`${schema.member.role} IN ('owner', 'admin', 'manager', 'staff')`
      )
    );

  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.name || m.email,
    role: m.role,
    email: m.email,
  }));
}
