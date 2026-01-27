/**
 * Discount Codes Management
 *
 * Create and manage discount codes that can be applied to bookings.
 */

import { useState, useEffect } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { requireOrgContext } from "../../../lib/auth/org-context.server";
import { db } from "../../../lib/db";
import { discountCodes } from "../../../lib/db/schema";
import { eq, and } from "drizzle-orm";

export const meta: MetaFunction = () => [{ title: "Discount Codes - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  const discountCodesList = await db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.organizationId, ctx.org.id))
    .orderBy(discountCodes.createdAt);

  return {
    discountCodes: discountCodesList,
    isPremium: ctx.isPremium,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const code = (formData.get("code") as string).toUpperCase().trim();
    const description = formData.get("description") as string || null;
    const discountType = formData.get("discountType") as string;
    const discountValueStr = formData.get("discountValue") as string;
    const minBookingAmount = formData.get("minBookingAmount") as string || null;
    const maxUses = formData.get("maxUses") as string || null;
    const validFrom = formData.get("validFrom") as string || null;
    const validTo = formData.get("validTo") as string || null;
    const applicableTo = formData.get("applicableTo") as string || "all";

    // Validate discount value
    const discountValue = parseFloat(discountValueStr);
    if (isNaN(discountValue) || discountValue <= 0) {
      return { error: "Discount value must be a positive number" };
    }
    if (discountType === "percentage" && discountValue > 100) {
      return { error: "Percentage discount cannot exceed 100%" };
    }
    if (discountType === "fixed" && discountValue > 100000) {
      return { error: "Fixed discount amount is too large (max $100,000)" };
    }

    // Check if code already exists for this organization
    const existing = await db
      .select()
      .from(discountCodes)
      .where(
        and(
          eq(discountCodes.organizationId, ctx.org.id),
          eq(discountCodes.code, code)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { error: "A discount code with this code already exists" };
    }

    await db.insert(discountCodes).values({
      organizationId: ctx.org.id,
      code,
      description,
      discountType,
      discountValue: discountValueStr,
      minBookingAmount: minBookingAmount || null,
      maxUses: maxUses ? parseInt(maxUses) : null,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      applicableTo,
      isActive: true,
    });

    return { success: true, message: "Discount code created" };
  }

  if (intent === "update") {
    const id = formData.get("id") as string;
    const code = (formData.get("code") as string).toUpperCase().trim();
    const description = formData.get("description") as string || null;
    const discountType = formData.get("discountType") as string;
    const discountValueStr = formData.get("discountValue") as string;
    const minBookingAmount = formData.get("minBookingAmount") as string || null;
    const maxUses = formData.get("maxUses") as string || null;
    const validFrom = formData.get("validFrom") as string || null;
    const validTo = formData.get("validTo") as string || null;
    const applicableTo = formData.get("applicableTo") as string || "all";
    const isActive = formData.get("isActive") === "true";

    // Validate discount value
    const discountValue = parseFloat(discountValueStr);
    if (isNaN(discountValue) || discountValue <= 0) {
      return { error: "Discount value must be a positive number" };
    }
    if (discountType === "percentage" && discountValue > 100) {
      return { error: "Percentage discount cannot exceed 100%" };
    }
    if (discountType === "fixed" && discountValue > 100000) {
      return { error: "Fixed discount amount is too large (max $100,000)" };
    }

    // Check if code already exists for this organization (for a different discount)
    const existing = await db
      .select()
      .from(discountCodes)
      .where(
        and(
          eq(discountCodes.organizationId, ctx.org.id),
          eq(discountCodes.code, code)
        )
      )
      .limit(1);

    if (existing.length > 0 && existing[0].id !== id) {
      return { error: "A discount code with this code already exists" };
    }

    await db
      .update(discountCodes)
      .set({
        code,
        description,
        discountType,
        discountValue: discountValueStr,
        minBookingAmount: minBookingAmount || null,
        maxUses: maxUses ? parseInt(maxUses) : null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        applicableTo,
        isActive,
      })
      .where(
        and(
          eq(discountCodes.organizationId, ctx.org.id),
          eq(discountCodes.id, id)
        )
      );

    return { success: true, message: "Discount code updated" };
  }

  if (intent === "toggle-active") {
    const id = formData.get("id") as string;
    const isActive = formData.get("isActive") === "true";

    await db
      .update(discountCodes)
      .set({ isActive })
      .where(
        and(
          eq(discountCodes.organizationId, ctx.org.id),
          eq(discountCodes.id, id)
        )
      );

    return { success: true, message: isActive ? "Discount code activated" : "Discount code deactivated" };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db.delete(discountCodes).where(
      and(
        eq(discountCodes.organizationId, ctx.org.id),
        eq(discountCodes.id, id)
      )
    );
    return { success: true, message: "Discount code deleted" };
  }

  return { error: "Invalid intent" };
}

type DiscountCode = {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: string;
  minBookingAmount: string | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: Date | null;
  validTo: Date | null;
  isActive: boolean;
  applicableTo: string;
  createdAt: Date;
};

function getDiscountStatus(discount: DiscountCode): { label: string; color: string } {
  const now = new Date();

  if (!discount.isActive) {
    return { label: "Inactive", color: "bg-surface-inset text-foreground-muted" };
  }

  if (discount.maxUses && discount.usedCount >= discount.maxUses) {
    return { label: "Used Up", color: "bg-warning-muted text-warning" };
  }

  if (discount.validTo && new Date(discount.validTo) < now) {
    return { label: "Expired", color: "bg-danger-muted text-danger" };
  }

  if (discount.validFrom && new Date(discount.validFrom) > now) {
    return { label: "Scheduled", color: "bg-brand-muted text-brand" };
  }

  return { label: "Active", color: "bg-success-muted text-success" };
}

function formatDiscountValue(type: string, value: string): string {
  if (type === "percentage") {
    return `${Number(value)}%`;
  }
  return `$${Number(value).toFixed(2)}`;
}

export default function DiscountsPage() {
  const { discountCodes } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showForm, setShowForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountCode | null>(null);

  const isSubmitting = fetcher.state === "submitting";
  const fetcherData = fetcher.data as { success?: boolean; message?: string; error?: string } | undefined;

  // Close modal on successful create/update/delete
  useEffect(() => {
    if (fetcherData?.success) {
      setShowForm(false);
      setEditingDiscount(null);
    }
  }, [fetcherData?.success]);

  // Categorize discounts
  const activeDiscounts = discountCodes.filter((d) => {
    const status = getDiscountStatus(d as DiscountCode);
    return status.label === "Active" || status.label === "Scheduled";
  });
  const inactiveDiscounts = discountCodes.filter((d) => {
    const status = getDiscountStatus(d as DiscountCode);
    return status.label !== "Active" && status.label !== "Scheduled";
  });

  const formatDateForInput = (dateVal: Date | string | null): string => {
    if (!dateVal) return "";
    const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
    return date.toISOString().slice(0, 16);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Discount Codes</h1>
          <p className="text-foreground-muted">Create and manage discount codes for bookings</p>
        </div>
        <button
          onClick={() => {
            setEditingDiscount(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
        >
          + Create Discount Code
        </button>
      </div>

      {/* Success/Error Messages */}
      {fetcherData?.success && (
        <div className="bg-success-muted border border-success text-success p-3 rounded-lg mb-4">
          {fetcherData.message}
        </div>
      )}

      {fetcherData?.error && !fetcherData.error.includes("Percentage discount") && (
        <div className="bg-danger-muted border border-danger text-danger p-3 rounded-lg mb-4">
          {fetcherData.error}
        </div>
      )}

      {/* Active Discounts */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-foreground">
          Active Discount Codes ({activeDiscounts.length})
        </h2>
        {activeDiscounts.length > 0 ? (
          <div className="bg-surface-raised rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-inset">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">Discount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">Applies To</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">Valid Period</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-foreground-muted">Usage</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-foreground-muted">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-foreground-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeDiscounts.map((discount) => {
                  const status = getDiscountStatus(discount as DiscountCode);
                  return (
                    <tr key={discount.id}>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-lg">{discount.code}</div>
                        {discount.description && (
                          <div className="text-sm text-foreground-muted">{discount.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-success">
                        {formatDiscountValue(discount.discountType, discount.discountValue)}
                        {discount.minBookingAmount && (
                          <div className="text-xs text-foreground-muted">
                            Min: ${Number(discount.minBookingAmount).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-sm">{discount.applicableTo}</td>
                      <td className="px-4 py-3 text-sm text-foreground-muted">
                        {discount.validFrom ? (
                          <>
                            {new Date(discount.validFrom).toLocaleDateString()}
                            {discount.validTo && ` - ${new Date(discount.validTo).toLocaleDateString()}`}
                          </>
                        ) : discount.validTo ? (
                          `Until ${new Date(discount.validTo).toLocaleDateString()}`
                        ) : (
                          "No limit"
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {discount.usedCount}
                        {discount.maxUses && ` / ${discount.maxUses}`}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingDiscount(discount as DiscountCode);
                              setShowForm(true);
                            }}
                            className="px-2 py-1 text-sm text-brand hover:bg-brand-muted rounded"
                          >
                            Edit
                          </button>
                          <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="toggle-active" />
                            <input type="hidden" name="id" value={discount.id} />
                            <input type="hidden" name="isActive" value="false" />
                            <button
                              type="submit"
                              className="px-2 py-1 text-sm text-warning hover:bg-warning-muted rounded"
                            >
                              Deactivate
                            </button>
                          </fetcher.Form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-surface-inset rounded-lg p-8 text-center">
            <p className="text-foreground-muted mb-4">No active discount codes.</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
            >
              Create Your First Discount Code
            </button>
          </div>
        )}
      </div>

      {/* Inactive Discounts */}
      {inactiveDiscounts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-foreground-muted">
            Inactive / Expired ({inactiveDiscounts.length})
          </h2>
          <div className="bg-surface-raised rounded-lg shadow overflow-hidden opacity-75">
            <table className="w-full">
              <thead className="bg-surface-inset">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">Discount</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-foreground-muted">Usage</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-foreground-muted">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-foreground-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inactiveDiscounts.map((discount) => {
                  const status = getDiscountStatus(discount as DiscountCode);
                  return (
                    <tr key={discount.id}>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold">{discount.code}</div>
                        {discount.description && (
                          <div className="text-sm text-foreground-muted">{discount.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {formatDiscountValue(discount.discountType, discount.discountValue)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {discount.usedCount}
                        {discount.maxUses && ` / ${discount.maxUses}`}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {status.label === "Inactive" && (
                            <fetcher.Form method="post">
                              <input type="hidden" name="intent" value="toggle-active" />
                              <input type="hidden" name="id" value={discount.id} />
                              <input type="hidden" name="isActive" value="true" />
                              <button
                                type="submit"
                                className="px-2 py-1 text-sm text-success hover:bg-success-muted rounded"
                              >
                                Activate
                              </button>
                            </fetcher.Form>
                          )}
                          <button
                            onClick={() => {
                              setEditingDiscount(discount as DiscountCode);
                              setShowForm(true);
                            }}
                            className="px-2 py-1 text-sm text-brand hover:bg-brand-muted rounded"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discount Code Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingDiscount ? "Edit Discount Code" : "Create Discount Code"}
              </h2>

              <fetcher.Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value={editingDiscount ? "update" : "create"} />
                {editingDiscount && <input type="hidden" name="id" value={editingDiscount.id} />}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Code *</label>
                    <input
                      type="text"
                      name="code"
                      defaultValue={editingDiscount?.code || ""}
                      required
                      placeholder="e.g., SUMMER20"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand uppercase font-mono"
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      Customers will enter this code when booking
                    </p>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input
                      type="text"
                      name="description"
                      defaultValue={editingDiscount?.description || ""}
                      placeholder="e.g., Summer 2024 promotion"
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Discount Type *</label>
                    <select
                      name="discountType"
                      defaultValue={editingDiscount?.discountType || "percentage"}
                      required
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Discount Value *</label>
                    <input
                      type="number"
                      name="discountValue"
                      step="0.01"
                      min="0"
                      max="100"
                      defaultValue={editingDiscount?.discountValue || ""}
                      required
                      placeholder="e.g., 10"
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                      onInvalid={(e) => {
                        const target = e.target as HTMLInputElement;
                        const type = (document.querySelector('[name="discountType"]') as HTMLSelectElement)?.value;
                        if (type === "percentage" && parseFloat(target.value) > 100) {
                          target.setCustomValidity("Percentage discount cannot exceed 100%");
                        } else {
                          target.setCustomValidity("");
                        }
                      }}
                      onChange={(e) => {
                        const target = e.target;
                        const type = (document.querySelector('[name="discountType"]') as HTMLSelectElement)?.value;
                        if (type === "percentage" && parseFloat(target.value) > 100) {
                          target.setCustomValidity("Percentage discount cannot exceed 100%");
                        } else {
                          target.setCustomValidity("");
                        }
                      }}
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      Maximum 100% for percentage discounts
                    </p>
                    {fetcherData?.error && fetcherData.error.includes("Percentage discount") && (
                      <p className="text-xs text-danger mt-1">{fetcherData.error}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Min Booking Amount</label>
                    <input
                      type="number"
                      name="minBookingAmount"
                      step="0.01"
                      min="0"
                      defaultValue={editingDiscount?.minBookingAmount || ""}
                      placeholder="No minimum"
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Max Uses</label>
                    <input
                      type="number"
                      name="maxUses"
                      min="1"
                      defaultValue={editingDiscount?.maxUses || ""}
                      placeholder="Unlimited"
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Valid From</label>
                    <input
                      type="datetime-local"
                      name="validFrom"
                      defaultValue={formatDateForInput(editingDiscount?.validFrom || null)}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Valid Until</label>
                    <input
                      type="datetime-local"
                      name="validTo"
                      defaultValue={formatDateForInput(editingDiscount?.validTo || null)}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Applicable To *</label>
                    <select
                      name="applicableTo"
                      defaultValue={editingDiscount?.applicableTo || "all"}
                      required
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    >
                      <option value="all">All Bookings</option>
                      <option value="tours">Tours Only</option>
                      <option value="courses">Courses Only</option>
                    </select>
                  </div>

                  {editingDiscount && (
                    <div className="col-span-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="isActive"
                          value="true"
                          defaultChecked={editingDiscount.isActive}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">Active</span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingDiscount(null);
                    }}
                    className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
                  >
                    {isSubmitting ? "Saving..." : editingDiscount ? "Update" : "Create"}
                  </button>
                </div>

                {editingDiscount && (
                  <div className="pt-4 border-t">
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={editingDiscount.id} />
                      <button
                        type="submit"
                        onClick={(e) => {
                          if (!confirm("Delete this discount code? This cannot be undone.")) {
                            e.preventDefault();
                          }
                          // Don't close modal here - let useEffect handle it after success
                        }}
                        className="w-full py-2 text-danger hover:bg-danger-muted rounded-lg text-sm"
                      >
                        Delete Discount Code
                      </button>
                    </fetcher.Form>
                  </div>
                )}
              </fetcher.Form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
