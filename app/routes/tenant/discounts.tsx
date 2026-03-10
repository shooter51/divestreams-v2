/**
 * Discount Codes Management
 *
 * Create and manage discount codes that can be applied to bookings.
 */

import { useState, useEffect, useRef } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, redirect } from "react-router";
import { requireOrgContext, requireRole} from "../../../lib/auth/org-context.server";
import { db } from "../../../lib/db";
import { discountCodes } from "../../../lib/db/schema";
import { eq, and } from "drizzle-orm";
import { useNotification } from "../../../lib/use-notification";
import { useToast } from "../../../lib/toast-context";
import { requireFeature } from "../../../lib/require-feature.server";
import { PLAN_FEATURES } from "../../../lib/plan-features";
import { CsrfInput } from "../../components/CsrfInput";
import { useT } from "../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Discount Codes - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);

  // Discount codes are used in POS - require POS feature
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_POS);

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
  requireRole(ctx, ["owner", "admin"]);

  // Discount codes are used in POS - require POS feature
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_POS);

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

    return { success: true, message: `Discount code "${code}" has been successfully created` };
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

    // Validate discount value (min 1, max 100 for percentage)
    const discountValue = parseFloat(discountValueStr);
    if (isNaN(discountValue)) {
      return { error: "Discount value must be a valid number" };
    }
    if (discountValue < 1) {
      return { error: "Discount value must be at least 1" };
    }
    if (discountType === "percentage" && discountValue > 100) {
      return { error: "Percentage discount cannot exceed 100%" };
    }
    if (discountType === "fixed" && discountValue > 100000) {
      return { error: "Fixed discount amount is too large (max $100,000)" };
    }

    // Validate min booking amount (must be >= 1 if provided)
    if (minBookingAmount) {
      const minAmount = parseFloat(minBookingAmount);
      if (isNaN(minAmount)) {
        return { error: "Minimum booking amount must be a valid number" };
      }
      if (minAmount < 1) {
        return { error: "Minimum booking amount must be at least $1" };
      }
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

    return { success: true, message: `Discount code "${code}" has been successfully updated` };
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
    return { success: true, message: "Discount code has been successfully deleted" };
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

// Takes 'now' parameter to avoid hydration mismatch (don't call new Date() during render)
// Returns a status key instead of display label - translate in component
function getDiscountStatus(discount: DiscountCode, now: Date): { statusKey: string; color: string } {
  if (!discount.isActive) {
    return { statusKey: "inactive", color: "bg-surface-inset text-foreground-muted" };
  }

  if (discount.maxUses && discount.usedCount >= discount.maxUses) {
    return { statusKey: "usedUp", color: "bg-warning-muted text-warning" };
  }

  if (discount.validTo && new Date(discount.validTo) < now) {
    return { statusKey: "expired", color: "bg-danger-muted text-danger" };
  }

  if (discount.validFrom && new Date(discount.validFrom) > now) {
    return { statusKey: "notYetActive", color: "bg-warning-muted text-warning" };
  }

  return { statusKey: "active", color: "bg-success-muted text-success" };
}

function formatDiscountValue(type: string, value: string): string {
  if (type === "percentage") {
    return `${Number(value)}%`;
  }
  return `$${Number(value).toFixed(2)}`;
}

export default function DiscountsPage() {
  useNotification();
  const t = useT();

  const { discountCodes } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountCode | null>(null);
  const [discountType, setDiscountType] = useState<string>("percentage");

  // Track discount statuses (calculated client-side to avoid hydration mismatch)
  const [discountStatuses, setDiscountStatuses] = useState<Map<string, { statusKey: string; color: string }>>(new Map());

  const isSubmitting = fetcher.state === "submitting";
  const fetcherData = fetcher.data as { error?: string; success?: boolean; message?: string } | undefined;

  // Calculate discount statuses after hydration (client-side only)
  useEffect(() => {
    const now = new Date();
    const statusMap = new Map<string, { statusKey: string; color: string }>();
    discountCodes.forEach((discount) => {
      statusMap.set(discount.id, getDiscountStatus(discount as DiscountCode, now));
    });
    setDiscountStatuses(statusMap);
  }, [discountCodes]);

  // Track last processed fetcher data to avoid re-processing stale responses
  const lastProcessedData = useRef<typeof fetcherData>(undefined);

  // Close modal and show toast on successful create/update/delete
  useEffect(() => {
    if (fetcherData && fetcherData !== lastProcessedData.current) {
      lastProcessedData.current = fetcherData;
      if (fetcherData.success && fetcherData.message) {
        setShowForm(false);
        setEditingDiscount(null);
        showToast(fetcherData.message, "success");
      } else if (fetcherData.error) {
        showToast(fetcherData.error, "error");
      }
    }
  }, [fetcherData, showToast]);


  // Status key -> translated label map
  const statusLabels: Record<string, string> = {
    inactive: t("tenant.discounts.status.inactive"),
    usedUp: t("tenant.discounts.status.usedUp"),
    expired: t("tenant.discounts.status.expired"),
    notYetActive: t("tenant.discounts.status.notYetActive"),
    active: t("tenant.discounts.status.active"),
  };

  const applicableToLabels: Record<string, string> = {
    all: t("tenant.discounts.applicableTo.all"),
    tours: t("tenant.discounts.applicableTo.tours"),
    equipment: t("tenant.discounts.applicableTo.equipment"),
    products: t("tenant.discounts.applicableTo.products"),
    courses: t("tenant.discounts.applicableTo.courses"),
  };

  // Categorize discounts
  const activeDiscounts = discountCodes.filter((d) => {
    const status = discountStatuses.get(d.id);
    return status && (status.statusKey === "active" || status.statusKey === "notYetActive");
  });
  const inactiveDiscounts = discountCodes.filter((d) => {
    const status = discountStatuses.get(d.id);
    return !status || (status.statusKey !== "active" && status.statusKey !== "notYetActive");
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
          <h1 className="text-2xl font-bold">{t("tenant.discounts.title")}</h1>
          <p className="text-foreground-muted">{t("tenant.discounts.description")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingDiscount(null);
            setDiscountType("percentage");
            setShowForm(true);
          }}
          className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
        >
          + {t("tenant.discounts.createCode")}
        </button>
      </div>

      {/* Error Messages - Removed from here, shown in modal instead */}

      {/* Active Discounts */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-foreground">
          {t("tenant.discounts.activeCount", { count: String(activeDiscounts.length) })}
        </h2>
        {activeDiscounts.length > 0 ? (
          <div className="bg-surface-raised rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-inset">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">{t("tenant.discounts.col.code")}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">{t("tenant.discounts.col.discount")}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">{t("tenant.discounts.col.appliesTo")}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">{t("tenant.discounts.col.validPeriod")}</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-foreground-muted">{t("tenant.discounts.col.usage")}</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-foreground-muted">{t("common.status")}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-foreground-muted">{t("tenant.discounts.col.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeDiscounts.map((discount) => {
                  const status = discountStatuses.get(discount.id) || { statusKey: "active", color: "bg-success-muted text-success" };
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
                      <td className="px-4 py-3 text-sm">{applicableToLabels[discount.applicableTo] || discount.applicableTo}</td>
                      <td className="px-4 py-3 text-sm text-foreground-muted">
                        {discount.validFrom ? (
                          <>
                            {new Date(discount.validFrom).toLocaleDateString()}
                            {discount.validTo && ` - ${new Date(discount.validTo).toLocaleDateString()}`}
                          </>
                        ) : discount.validTo ? (
                          `${t("tenant.discounts.until")} ${new Date(discount.validTo).toLocaleDateString()}`
                        ) : (
                          t("tenant.discounts.noLimit")
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {discount.maxUses
                          ? `${discount.usedCount} / ${discount.maxUses}`
                          : t("tenant.discounts.usesCount", { count: String(discount.usedCount) })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${status.color}`}>
                          {statusLabels[status.statusKey] || status.statusKey}
                        </span>
                        {status.statusKey === "notYetActive" && discount.validFrom && (
                          <p className="text-xs text-warning mt-1">
                            {t("tenant.discounts.activeFrom", { date: new Date(discount.validFrom).toLocaleDateString() })}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const disc = discount as DiscountCode;
                              setEditingDiscount(disc);
                              setDiscountType(disc.discountType);
                              setShowForm(true);
                            }}
                            className="px-2 py-1 text-sm text-brand hover:bg-brand-muted rounded"
                          >
                            {t("common.edit")}
                          </button>
                          <fetcher.Form method="post">
                            <CsrfInput />
                            <input type="hidden" name="intent" value="toggle-active" />
                            <input type="hidden" name="id" value={discount.id} />
                            <input type="hidden" name="isActive" value="false" />
                            <button
                              type="submit"
                              className="px-2 py-1 text-sm text-warning hover:bg-warning-muted rounded"
                            >
                              {t("tenant.discounts.deactivate")}
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
            <p className="text-foreground-muted mb-4">{t("tenant.discounts.noActive")}</p>
            <button
              type="button"
              onClick={() => {
                setDiscountType("percentage");
                setShowForm(true);
              }}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
            >
              {t("tenant.discounts.createFirst")}
            </button>
          </div>
        )}
      </div>

      {/* Inactive Discounts */}
      {inactiveDiscounts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-foreground-muted">
            {t("tenant.discounts.inactiveCount", { count: String(inactiveDiscounts.length) })}
          </h2>
          <div className="bg-surface-raised rounded-lg shadow overflow-hidden opacity-75">
            <table className="w-full">
              <thead className="bg-surface-inset">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">{t("tenant.discounts.col.code")}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">{t("tenant.discounts.col.discount")}</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-foreground-muted">{t("tenant.discounts.col.usage")}</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-foreground-muted">{t("common.status")}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-foreground-muted">{t("tenant.discounts.col.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inactiveDiscounts.map((discount) => {
                  const status = discountStatuses.get(discount.id) || { statusKey: "inactive", color: "bg-surface-inset text-foreground-muted" };
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
                        {discount.maxUses
                          ? `${discount.usedCount} / ${discount.maxUses}`
                          : t("tenant.discounts.usesCount", { count: String(discount.usedCount) })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${status.color}`}>
                          {statusLabels[status.statusKey] || status.statusKey}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {status.statusKey === "inactive" && (
                            <fetcher.Form method="post">
                              <CsrfInput />
                              <input type="hidden" name="intent" value="toggle-active" />
                              <input type="hidden" name="id" value={discount.id} />
                              <input type="hidden" name="isActive" value="true" />
                              <button
                                type="submit"
                                className="px-2 py-1 text-sm text-success hover:bg-success-muted rounded"
                              >
                                {t("tenant.discounts.activate")}
                              </button>
                            </fetcher.Form>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const disc = discount as DiscountCode;
                              setEditingDiscount(disc);
                              setDiscountType(disc.discountType);
                              setShowForm(true);
                            }}
                            className="px-2 py-1 text-sm text-brand hover:bg-brand-muted rounded"
                          >
                            {t("common.edit")}
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
                {editingDiscount ? t("tenant.discounts.editCode") : t("tenant.discounts.createCode")}
              </h2>

              <fetcher.Form method="post" className="space-y-4">
                <CsrfInput />
                <input type="hidden" name="intent" value={editingDiscount ? "update" : "create"} />
                {editingDiscount && <input type="hidden" name="id" value={editingDiscount.id} />}

                {/* Show all error messages inside the modal */}
                {fetcherData?.error && (
                  <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg max-w-full break-words">
                    {fetcherData.error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">{t("tenant.discounts.col.code")} *</label>
                    <input
                      type="text"
                      name="code"
                      defaultValue={editingDiscount?.code || ""}
                      required
                      placeholder={t("tenant.discounts.codePlaceholder")}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand uppercase font-mono"
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      {t("tenant.discounts.codeHint")}
                    </p>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">{t("common.description")}</label>
                    <input
                      type="text"
                      name="description"
                      defaultValue={editingDiscount?.description || ""}
                      placeholder={t("tenant.discounts.descriptionPlaceholder")}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">{t("tenant.discounts.discountType")} *</label>
                    <select
                      name="discountType"
                      defaultValue={editingDiscount?.discountType || "percentage"}
                      required
                      onChange={(e) => setDiscountType(e.target.value)}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    >
                      <option value="percentage">{t("tenant.discounts.type.percentage")}</option>
                      <option value="fixed">{t("tenant.discounts.type.fixedAmount")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">{t("tenant.discounts.discountValue")} *</label>
                    <input
                      type="number"
                      name="discountValue"
                      step="0.01"
                      min="1"
                      max={discountType === "percentage" ? "100" : "100000"}
                      defaultValue={editingDiscount?.discountValue || ""}
                      required
                      placeholder={discountType === "percentage" ? t("tenant.discounts.percentagePlaceholder") : t("tenant.discounts.fixedPlaceholder")}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      {discountType === "percentage"
                        ? t("tenant.discounts.percentageRange")
                        : t("tenant.discounts.fixedRange")}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">{t("tenant.discounts.minBookingAmount")}</label>
                    <input
                      type="number"
                      name="minBookingAmount"
                      step="0.01"
                      min="1"
                      max="100000"
                      defaultValue={editingDiscount?.minBookingAmount || ""}
                      placeholder={t("tenant.discounts.noMinimum")}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      {t("tenant.discounts.minAmountHint")}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">{t("tenant.discounts.maxUses")}</label>
                    <input
                      type="number"
                      name="maxUses"
                      min="1"
                      defaultValue={editingDiscount?.maxUses || ""}
                      placeholder={t("tenant.discounts.unlimited")}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">{t("tenant.discounts.validFrom")}</label>
                    <input
                      type="datetime-local"
                      name="validFrom"
                      defaultValue={formatDateForInput(editingDiscount?.validFrom || null)}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">{t("tenant.discounts.validUntil")}</label>
                    <input
                      type="datetime-local"
                      name="validTo"
                      defaultValue={formatDateForInput(editingDiscount?.validTo || null)}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">{t("tenant.discounts.col.appliesTo")} *</label>
                    <select
                      name="applicableTo"
                      defaultValue={editingDiscount?.applicableTo || "all"}
                      required
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    >
                      <option value="all">{t("tenant.discounts.applicableTo.allBookings")}</option>
                      <option value="tours">{t("tenant.discounts.applicableTo.toursOnly")}</option>
                      <option value="courses">{t("tenant.discounts.applicableTo.coursesOnly")}</option>
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
                        <span className="text-sm">{t("common.active")}</span>
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
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
                  >
                    {isSubmitting ? t("common.saving") : editingDiscount ? t("common.update") : t("common.create")}
                  </button>
                </div>
              </fetcher.Form>

              {editingDiscount && (
                <div className="pt-4 border-t">
                  <fetcher.Form method="post">
                    <CsrfInput />
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={editingDiscount.id} />
                    <button
                      type="submit"
                      onClick={(e) => {
                        if (!confirm(t("tenant.discounts.deleteConfirm"))) {
                          e.preventDefault();
                        }
                      }}
                      className="w-full py-2 text-danger hover:bg-danger-muted rounded-lg text-sm"
                    >
                      {t("tenant.discounts.deleteCode")}
                    </button>
                  </fetcher.Form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
