import { stripe } from "./index";
import { db } from "../db";
import { subscriptionCoupons, subscription } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function createStripeCoupon(data: {
  code: string;
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number;
  maxRedemptions?: number;
  expiresAt?: Date;
  createdBy?: string;
}) {
  if (!stripe) throw new Error("Stripe not configured");

  // Create Stripe coupon
  const couponParams: Record<string, unknown> = {
    name: data.name,
    duration: data.duration,
  };

  if (data.discountType === "percentage") {
    couponParams.percent_off = data.discountValue;
  } else {
    couponParams.amount_off = Math.round(data.discountValue * 100); // cents
    couponParams.currency = "usd";
  }

  if (data.duration === "repeating" && data.durationInMonths) {
    couponParams.duration_in_months = data.durationInMonths;
  }

  if (data.maxRedemptions) {
    couponParams.max_redemptions = data.maxRedemptions;
  }

  if (data.expiresAt) {
    couponParams.redeem_by = Math.floor(data.expiresAt.getTime() / 1000);
  }

  const stripeCoupon = await stripe.coupons.create(couponParams as Parameters<typeof stripe.coupons.create>[0]);

  // Create Stripe promotion code (the user-facing code)
  const promoCode = await stripe.promotionCodes.create({
    promotion: {
      type: "coupon",
      coupon: stripeCoupon.id,
    },
    code: data.code.toUpperCase(),
    max_redemptions: data.maxRedemptions || undefined,
    expires_at: data.expiresAt ? Math.floor(data.expiresAt.getTime() / 1000) : undefined,
  });

  // Store in database
  const [coupon] = await db
    .insert(subscriptionCoupons)
    .values({
      code: data.code.toUpperCase(),
      stripeCouponId: stripeCoupon.id,
      stripePromotionCodeId: promoCode.id,
      name: data.name,
      discountType: data.discountType,
      discountValue: String(data.discountValue),
      duration: data.duration,
      durationInMonths: data.durationInMonths,
      maxRedemptions: data.maxRedemptions,
      expiresAt: data.expiresAt,
      createdBy: data.createdBy,
    })
    .returning();

  return coupon;
}

export async function getSubscriptionCoupons() {
  return db
    .select()
    .from(subscriptionCoupons)
    .orderBy(sql`${subscriptionCoupons.createdAt} DESC`);
}

export async function deactivateStripeCoupon(couponId: string) {
  const [coupon] = await db
    .select()
    .from(subscriptionCoupons)
    .where(eq(subscriptionCoupons.id, couponId));

  if (!coupon) throw new Error("Coupon not found");

  // Deactivate in Stripe
  if (stripe && coupon.stripePromotionCodeId) {
    await stripe.promotionCodes.update(coupon.stripePromotionCodeId, {
      active: false,
    });
  }

  // Deactivate in DB
  const [updated] = await db
    .update(subscriptionCoupons)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(subscriptionCoupons.id, couponId))
    .returning();

  return updated;
}

export async function applySubscriptionCoupon(orgId: string, code: string) {
  if (!stripe) throw new Error("Stripe not configured");

  // Look up coupon by code
  const [coupon] = await db
    .select()
    .from(subscriptionCoupons)
    .where(
      and(
        eq(subscriptionCoupons.code, code.toUpperCase()),
        eq(subscriptionCoupons.isActive, true)
      )
    );

  if (!coupon) throw new Error("Invalid coupon code");

  // Check expiry
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new Error("This coupon has expired");
  }

  // Check max redemptions
  if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
    throw new Error("This coupon has reached its maximum redemptions");
  }

  // Get org subscription
  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, orgId));

  if (!sub?.stripeSubscriptionId) {
    throw new Error("No active Stripe subscription found");
  }

  // Apply coupon to Stripe subscription
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    discounts: [{ coupon: coupon.stripeCouponId! }],
  });

  // Increment redemption count
  await db
    .update(subscriptionCoupons)
    .set({
      redemptionCount: sql`${subscriptionCoupons.redemptionCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionCoupons.id, coupon.id));

  return coupon;
}
