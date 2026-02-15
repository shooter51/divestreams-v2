/**
 * Equipment Rental Management
 *
 * View and manage active equipment rentals.
 */

import { useState } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams, redirect } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../lib/require-feature.server";
import { PLAN_FEATURES } from "../../../../lib/plan-features";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { eq, and, or, gte, lte, desc } from "drizzle-orm";
import { useNotification } from "../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "Manage Rentals - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_EQUIPMENT_BOATS);

  const organizationId = ctx.org.id;
  const { db, schema } = getTenantDb(organizationId);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "active";

  // Build status condition
  let statusCondition;
  if (status === "active") {
    statusCondition = eq(schema.rentals.status, "active");
  } else if (status === "overdue") {
    statusCondition = eq(schema.rentals.status, "overdue");
  } else if (status === "returned") {
    statusCondition = eq(schema.rentals.status, "returned");
  } else {
    // All rentals
    statusCondition = undefined;
  }

  // Fetch rentals with joins
  const rentalsQuery = statusCondition
    ? db
        .select({
          rental: schema.rentals,
          equipment: schema.equipment,
          customer: schema.customers,
        })
        .from(schema.rentals)
        .leftJoin(schema.equipment, eq(schema.rentals.equipmentId, schema.equipment.id))
        .leftJoin(schema.customers, eq(schema.rentals.customerId, schema.customers.id))
        .where(
          and(
            eq(schema.rentals.organizationId, ctx.org.id),
            statusCondition
          )
        )
        .orderBy(desc(schema.rentals.rentedAt))
    : db
        .select({
          rental: schema.rentals,
          equipment: schema.equipment,
          customer: schema.customers,
        })
        .from(schema.rentals)
        .leftJoin(schema.equipment, eq(schema.rentals.equipmentId, schema.equipment.id))
        .leftJoin(schema.customers, eq(schema.rentals.customerId, schema.customers.id))
        .where(eq(schema.rentals.organizationId, ctx.org.id))
        .orderBy(desc(schema.rentals.rentedAt));

  const rentals = await rentalsQuery;

  // Calculate stats
  const allRentals = await db
    .select()
    .from(schema.rentals)
    .where(eq(schema.rentals.organizationId, ctx.org.id));

  const stats = {
    total: allRentals.length,
    active: allRentals.filter((r) => r.status === "active").length,
    overdue: allRentals.filter((r) => r.status === "overdue").length,
    returned: allRentals.filter((r) => r.status === "returned").length,
  };

  return {
    rentals,
    stats,
    status,
    isPremium: ctx.isPremium,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_EQUIPMENT_BOATS);

  const organizationId = ctx.org.id;
  const { db, schema } = getTenantDb(organizationId);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "mark-returned") {
    const rentalId = formData.get("rentalId") as string;
    if (!rentalId) {
      return { error: "Rental ID is required" };
    }

    // Mark rental as returned
    await db
      .update(schema.rentals)
      .set({
        status: "returned",
        returnedAt: new Date(),
      })
      .where(
        and(
          eq(schema.rentals.id, rentalId),
          eq(schema.rentals.organizationId, ctx.org.id)
        )
      );

    // Update equipment status to available
    const [rental] = await db
      .select()
      .from(schema.rentals)
      .where(eq(schema.rentals.id, rentalId))
      .limit(1);

    if (rental) {
      await db
        .update(schema.equipment)
        .set({ status: "available" })
        .where(
          and(
            eq(schema.equipment.id, rental.equipmentId),
            eq(schema.equipment.organizationId, ctx.org.id)
          )
        );
    }

    return redirect("/tenant/equipment/rentals?message=Rental marked as returned");
  }

  if (intent === "mark-overdue") {
    const rentalId = formData.get("rentalId") as string;
    if (!rentalId) {
      return { error: "Rental ID is required" };
    }

    await db
      .update(schema.rentals)
      .set({ status: "overdue" })
      .where(
        and(
          eq(schema.rentals.id, rentalId),
          eq(schema.rentals.organizationId, ctx.org.id)
        )
      );

    return redirect("/tenant/equipment/rentals?message=Rental marked as overdue");
  }

  return null;
}

export default function RentalsPage() {
  useNotification();

  const { rentals, stats, status: activeStatus, isPremium } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const setFilter = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("status", value);
    else params.delete("status");
    setSearchParams(params);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysRented = (rentedAt: Date | string, returnedAt: Date | string | null) => {
    const start = new Date(rentedAt);
    const end = returnedAt ? new Date(returnedAt) : new Date();
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const isOverdue = (dueAt: Date | string, status: string) => {
    if (status === "returned") return false;
    return new Date(dueAt) < new Date();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Rental Management</h1>
          <p className="text-foreground-muted">{stats.total} total rentals</p>
        </div>
        <Link
          to="/tenant/equipment"
          className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
        >
          Back to Equipment
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div
          className={`bg-surface-raised rounded-xl p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-brand ${
            !activeStatus || activeStatus === "all" ? "ring-2 ring-brand" : ""
          }`}
          onClick={() => setFilter("")}
        >
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-foreground-muted text-sm">All Rentals</p>
        </div>
        <div
          className={`bg-surface-raised rounded-xl p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-success ${
            activeStatus === "active" ? "ring-2 ring-success" : ""
          }`}
          onClick={() => setFilter("active")}
        >
          <p className="text-2xl font-bold text-success">{stats.active}</p>
          <p className="text-foreground-muted text-sm">Active</p>
        </div>
        <div
          className={`bg-surface-raised rounded-xl p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-danger ${
            activeStatus === "overdue" ? "ring-2 ring-danger" : ""
          }`}
          onClick={() => setFilter("overdue")}
        >
          <p className="text-2xl font-bold text-danger">{stats.overdue}</p>
          <p className="text-foreground-muted text-sm">Overdue</p>
        </div>
        <div
          className={`bg-surface-raised rounded-xl p-4 shadow-sm cursor-pointer hover:ring-2 hover:ring-foreground-subtle ${
            activeStatus === "returned" ? "ring-2 ring-foreground-subtle" : ""
          }`}
          onClick={() => setFilter("returned")}
        >
          <p className="text-2xl font-bold text-foreground-muted">{stats.returned}</p>
          <p className="text-foreground-muted text-sm">Returned</p>
        </div>
      </div>

      {/* Rentals List */}
      {rentals.length === 0 ? (
        <div className="bg-surface-raised rounded-xl p-12 shadow-sm text-center">
          <p className="text-foreground-muted">
            {activeStatus === "active"
              ? "No active rentals"
              : activeStatus === "overdue"
              ? "No overdue rentals"
              : activeStatus === "returned"
              ? "No rental history"
              : "No rentals found"}
          </p>
          <Link
            to="/tenant/pos"
            className="inline-block mt-4 text-brand hover:underline"
          >
            Create rental via POS
          </Link>
        </div>
      ) : (
        <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-inset border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-sm">Equipment</th>
                <th className="text-left py-3 px-4 font-medium text-sm">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-sm">Rented</th>
                <th className="text-left py-3 px-4 font-medium text-sm">Due</th>
                <th className="text-left py-3 px-4 font-medium text-sm">Duration</th>
                <th className="text-right py-3 px-4 font-medium text-sm">Charge</th>
                <th className="text-left py-3 px-4 font-medium text-sm">Status</th>
                <th className="text-right py-3 px-4 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rentals.map(({ rental, equipment, customer }) => (
                <tr key={rental.id} className="hover:bg-surface-inset">
                  <td className="py-3 px-4">
                    {equipment ? (
                      <Link
                        to={`/tenant/equipment/${equipment.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {equipment.name}
                      </Link>
                    ) : (
                      <span className="text-foreground-subtle">Unknown Equipment</span>
                    )}
                    {equipment && (
                      <p className="text-sm text-foreground-muted">
                        {equipment.brand} {equipment.model}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {customer ? (
                      <div>
                        <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                        <p className="text-sm text-foreground-muted">{customer.email}</p>
                      </div>
                    ) : (
                      <span className="text-foreground-subtle">Unknown Customer</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm">{formatDate(rental.rentedAt)}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-sm ${
                        isOverdue(rental.dueAt, rental.status) ? "text-danger font-medium" : ""
                      }`}
                    >
                      {formatDate(rental.dueAt)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {getDaysRented(rental.rentedAt, rental.returnedAt)} days
                  </td>
                  <td className="py-3 px-4 text-right">
                    <p className="font-medium">${Number(rental.totalCharge).toFixed(2)}</p>
                    <p className="text-xs text-foreground-muted">
                      ${Number(rental.dailyRate).toFixed(2)}/day
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        rental.status === "active"
                          ? "bg-success-muted text-success"
                          : rental.status === "overdue"
                          ? "bg-danger-muted text-danger"
                          : "bg-surface-inset text-foreground-muted"
                      }`}
                    >
                      {rental.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {rental.status !== "returned" && (
                      <form method="post" className="inline">
                        <input type="hidden" name="rentalId" value={rental.id} />
                        <button
                          type="submit"
                          name="intent"
                          value="mark-returned"
                          className="text-sm text-brand hover:underline"
                        >
                          Mark Returned
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
