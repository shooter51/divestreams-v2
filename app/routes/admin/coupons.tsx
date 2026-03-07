import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useEffect, useState } from "react";
import { requirePlatformContext } from "../../../lib/auth/platform-context.server";
import { getSubscriptionCoupons, createStripeCoupon, deactivateStripeCoupon } from "../../../lib/stripe/coupons.server";
import { useToast } from "../../../lib/toast-context";

export const meta: MetaFunction = () => [{ title: "Subscription Coupons - DiveStreams Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requirePlatformContext(request);
  const coupons = await getSubscriptionCoupons();
  return { coupons };
}

export async function action({ request }: ActionFunctionArgs) {
  await requirePlatformContext(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const code = (formData.get("code") as string)?.trim().toUpperCase();
    const name = (formData.get("name") as string)?.trim();
    const discountType = formData.get("discountType") as "percentage" | "fixed";
    const discountValue = Number(formData.get("discountValue"));
    const duration = formData.get("duration") as "once" | "repeating" | "forever";
    const durationInMonthsRaw = formData.get("durationInMonths");
    const durationInMonths = durationInMonthsRaw ? Number(durationInMonthsRaw) : undefined;
    const maxRedemptionsRaw = formData.get("maxRedemptions");
    const maxRedemptions = maxRedemptionsRaw ? Number(maxRedemptionsRaw) : undefined;
    const expiresAtRaw = formData.get("expiresAt") as string | null;
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : undefined;

    if (!code || !name || !discountType || !discountValue || !duration) {
      return { success: false, error: "All required fields must be filled in." };
    }

    try {
      await createStripeCoupon({
        code,
        name,
        discountType,
        discountValue,
        duration,
        durationInMonths,
        maxRedemptions,
        expiresAt,
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  if (intent === "deactivate") {
    const couponId = formData.get("couponId") as string;
    if (!couponId) {
      return { success: false, error: "Coupon ID is required." };
    }
    try {
      await deactivateStripeCoupon(couponId);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  return null;
}

export default function AdminCouponsPage() {
  const { coupons } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const { showToast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");

  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.error) {
        showToast(fetcher.data.error, "error");
      } else if (fetcher.data.success) {
        showToast("Operation completed successfully", "success");
        setShowCreateForm(false);
      }
    }
  }, [fetcher.data, showToast]);

  const handleDeactivate = (couponId: string, code: string) => {
    if (confirm(`Are you sure you want to deactivate coupon "${code}"? This cannot be undone.`)) {
      fetcher.submit(
        { intent: "deactivate", couponId },
        { method: "post" }
      );
    }
  };

  const formatDiscount = (type: string, value: string | number) => {
    const num = Number(value);
    if (type === "percentage") return `${num}%`;
    return `$${(num / 100).toFixed(2)}`;
  };

  const formatDuration = (dur: string, months?: number | null) => {
    if (dur === "once") return "Once";
    if (dur === "forever") return "Forever";
    if (dur === "repeating" && months) return `${months} months`;
    return dur;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Subscription Coupons</h1>
          <p className="text-foreground-muted">{coupons.length} coupon{coupons.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
        >
          {showCreateForm ? "Cancel" : "Create Coupon"}
        </button>
      </div>

      {/* Create Coupon Form */}
      {showCreateForm && (
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold mb-4">Create New Coupon</h2>
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="create" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium mb-1">
                  Code <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  required
                  placeholder="SAVE20"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand uppercase"
                  style={{ textTransform: "uppercase" }}
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  placeholder="20% off for new customers"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="discountType" className="block text-sm font-medium mb-1">
                  Discount Type <span className="text-danger">*</span>
                </label>
                <select
                  id="discountType"
                  name="discountType"
                  required
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
              <div>
                <label htmlFor="discountValue" className="block text-sm font-medium mb-1">
                  {discountType === "percentage" ? "Percentage (%)" : "Amount (cents)"} <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  id="discountValue"
                  name="discountValue"
                  required
                  min={discountType === "percentage" ? 1 : 1}
                  max={discountType === "percentage" ? 100 : undefined}
                  placeholder={discountType === "percentage" ? "20" : "1000"}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
                {discountType === "fixed" && (
                  <p className="text-xs text-foreground-muted mt-1">Enter amount in cents (e.g. 1000 = $10.00)</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="duration" className="block text-sm font-medium mb-1">
                  Duration <span className="text-danger">*</span>
                </label>
                <select
                  id="duration"
                  name="duration"
                  required
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as "once" | "repeating" | "forever")}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                >
                  <option value="once">Once</option>
                  <option value="repeating">Repeating</option>
                  <option value="forever">Forever</option>
                </select>
              </div>
              {duration === "repeating" && (
                <div>
                  <label htmlFor="durationInMonths" className="block text-sm font-medium mb-1">
                    Duration (months) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    id="durationInMonths"
                    name="durationInMonths"
                    required
                    min={1}
                    placeholder="3"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="maxRedemptions" className="block text-sm font-medium mb-1">
                  Max Redemptions
                </label>
                <input
                  type="number"
                  id="maxRedemptions"
                  name="maxRedemptions"
                  min={1}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label htmlFor="expiresAt" className="block text-sm font-medium mb-1">
                  Expires At
                </label>
                <input
                  type="date"
                  id="expiresAt"
                  name="expiresAt"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={fetcher.state === "submitting"}
                className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
              >
                {fetcher.state === "submitting" ? "Creating..." : "Create Coupon"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
              >
                Cancel
              </button>
            </div>
          </fetcher.Form>
        </div>
      )}

      {/* Coupons Table */}
      <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-inset border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-foreground-muted">Code</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-foreground-muted">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-foreground-muted">Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-foreground-muted">Value</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-foreground-muted">Duration</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-foreground-muted">Redeemed</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-foreground-muted">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-foreground-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-foreground-muted">
                  No coupons found
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon.id} className={!coupon.isActive ? "opacity-50" : ""}>
                  <td className="px-4 py-3 font-mono text-sm font-medium">{coupon.code}</td>
                  <td className="px-4 py-3 text-sm">{coupon.name}</td>
                  <td className="px-4 py-3 text-sm capitalize">{coupon.discountType}</td>
                  <td className="px-4 py-3 text-sm">{formatDiscount(coupon.discountType, coupon.discountValue)}</td>
                  <td className="px-4 py-3 text-sm">{formatDuration(coupon.duration, coupon.durationInMonths)}</td>
                  <td className="px-4 py-3 text-sm">
                    {coupon.redemptionCount ?? 0}
                    {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        coupon.isActive
                          ? "bg-success-muted text-success"
                          : "bg-surface-inset text-foreground-muted"
                      }`}
                    >
                      {coupon.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {coupon.isActive && (
                      <button
                        onClick={() => handleDeactivate(coupon.id, coupon.code)}
                        className="text-sm text-danger hover:underline"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
