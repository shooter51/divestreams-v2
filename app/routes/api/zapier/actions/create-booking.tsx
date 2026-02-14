/**
 * Zapier Action: Create Booking
 *
 * POST /api/zapier/actions/create-booking
 *
 * Allows Zapier to create bookings in DiveStreams.
 */

import type { ActionFunctionArgs } from "react-router";
import { validateZapierApiKey } from "../../../../../lib/integrations/zapier-enhanced.server.js";
import { db } from "../../../../../lib/db/index.js";
import { bookings, customers, trips } from "../../../../../lib/db/schema.js";
import { eq, and, count, gte } from "drizzle-orm";

interface CreateBookingInput {
  trip_id: string;
  customer_email: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
  participants: number;
  notes?: string;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // Authenticate request using API key
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json(
      { error: "Missing API key. Provide X-API-Key header." },
      { status: 401 }
    );
  }

  const orgId = await validateZapierApiKey(apiKey);
  if (!orgId) {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Check plan booking limits before creating
  try {
    const { subscription, subscriptionPlans } = await import("../../../../../lib/db/schema.js");
    const { FREE_TIER_LIMITS } = await import("../../../../../lib/auth/org-context.server.js");

    const [sub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, orgId))
      .limit(1);

    const planName = sub?.plan || "free";
    let planDetails;
    if (sub?.planId) {
      [planDetails] = await db
        .select()
        .from(subscriptionPlans)
        .where(and(eq(subscriptionPlans.id, sub.planId), eq(subscriptionPlans.isActive, true)))
        .limit(1);
    }
    if (!planDetails) {
      [planDetails] = await db
        .select()
        .from(subscriptionPlans)
        .where(and(eq(subscriptionPlans.name, planName), eq(subscriptionPlans.isActive, true)))
        .limit(1);
    }

    const isPremium = planDetails && planDetails.monthlyPrice > 0 && sub?.status === "active";

    if (!isPremium) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [bookingCount] = await db
        .select({ count: count() })
        .from(bookings)
        .where(
          and(
            eq(bookings.organizationId, orgId),
            gte(bookings.createdAt, startOfMonth)
          )
        );

      const currentCount = bookingCount?.count ?? 0;
      const limit = FREE_TIER_LIMITS.bookingsPerMonth;

      if (currentCount >= limit) {
        return Response.json(
          { error: `Booking limit reached: ${currentCount}/${limit}. Upgrade to premium for unlimited bookings.` },
          { status: 403 }
        );
      }
    }
  } catch (limitError) {
    console.error("Failed to check booking limits:", limitError);
    // Allow the booking to proceed if limit check fails to avoid blocking legitimate requests
  }

  try {
    const body = (await request.json()) as CreateBookingInput;

    // Validate required fields
    if (!body.trip_id || !body.customer_email || !body.participants) {
      return Response.json(
        {
          error: "Missing required fields: trip_id, customer_email, participants",
        },
        { status: 400 }
      );
    }

    // Verify trip exists and belongs to organization
    const [trip] = await db
      .select()
      .from(trips)
      .where(and(eq(trips.id, body.trip_id), eq(trips.organizationId, orgId)))
      .limit(1);

    if (!trip) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    // Find or create customer
    let [customer] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.email, body.customer_email),
          eq(customers.organizationId, orgId)
        )
      )
      .limit(1);

    if (!customer) {
      // Create new customer
      [customer] = await db
        .insert(customers)
        .values({
          organizationId: orgId,
          email: body.customer_email,
          firstName: body.customer_first_name || "",
          lastName: body.customer_last_name || "",
          phone: body.customer_phone || null,
        })
        .returning();
    }

    // Create booking
    const [booking] = await db
      .insert(bookings)
      .values({
        organizationId: orgId,
        tripId: trip.id,
        customerId: customer.id,
        participants: body.participants,
        status: "pending",
        bookingNumber: `BK-${Date.now()}`,
        subtotal: "0",
        total: "0",
        internalNotes: body.notes || null,
      })
      .returning();

    return Response.json({
      id: booking.id,
      booking_number: `BK-${booking.id.substring(0, 8)}`,
      trip_id: booking.tripId,
      customer_id: booking.customerId,
      status: booking.status,
      participants: booking.participants,
      created_at: booking.createdAt,
    });
  } catch (error) {
    console.error("Zapier create booking error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to create booking",
      },
      { status: 500 }
    );
  }
}

export default function ZapierCreateBooking() {
  return null;
}
