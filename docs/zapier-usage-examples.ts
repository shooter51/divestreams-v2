/**
 * Zapier Integration Usage Examples
 *
 * Examples of how to trigger Zapier webhooks from your application code.
 */

import {
  triggerBookingCreated,
  triggerBookingUpdated,
  triggerBookingCancelled,
  triggerCustomerCreated,
  triggerCustomerUpdated,
  triggerPaymentReceived,
  triggerPaymentRefunded,
  triggerTripCreated,
  triggerTripCompleted,
} from "../lib/integrations/zapier-events.server";

// ============================================================================
// EXAMPLE 1: Trigger webhook when creating a booking
// ============================================================================

export async function exampleCreateBooking(orgId: string) {
  // ... your booking creation logic ...

  const booking = {
    id: "bk_abc123",
    bookingNumber: "BK-2024-001",
    tripName: "Morning Dive Trip",
    tripDate: "2024-03-15",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    participants: 2,
    totalAmount: 150.0,
    currency: "USD",
    status: "confirmed",
  };

  // Trigger Zapier webhook (runs in background queue)
  await triggerBookingCreated(orgId, booking);

  // The webhook delivery happens asynchronously
  // No need to wait for it to complete
}

// ============================================================================
// EXAMPLE 2: Trigger webhook when customer registers
// ============================================================================

export async function exampleCustomerRegistration(orgId: string) {
  // ... customer registration logic ...

  const customer = {
    id: "cust_xyz789",
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    phone: "+1234567890",
  };

  // Trigger webhook
  await triggerCustomerCreated(orgId, customer);
}

// ============================================================================
// EXAMPLE 3: Trigger webhook on payment success
// ============================================================================

export async function examplePaymentProcessing(orgId: string) {
  // ... payment processing logic ...

  const payment = {
    id: "pay_def456",
    amount: 150.0,
    currency: "USD",
    status: "succeeded",
    bookingNumber: "BK-2024-001",
    customerEmail: "john@example.com",
    paymentMethod: "card",
  };

  // Trigger webhook
  await triggerPaymentReceived(orgId, payment);
}

// ============================================================================
// EXAMPLE 4: Trigger webhook when booking status changes
// ============================================================================

export async function exampleBookingStatusUpdate(orgId: string) {
  const previousStatus = "pending";
  const newStatus = "confirmed";

  // ... status update logic ...

  const booking = {
    id: "bk_abc123",
    bookingNumber: "BK-2024-001",
    tripName: "Morning Dive Trip",
    tripDate: "2024-03-15",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    participants: 2,
    totalAmount: 150.0,
    currency: "USD",
    status: newStatus,
    previousStatus,
  };

  // Trigger webhook
  await triggerBookingUpdated(orgId, booking);
}

// ============================================================================
// EXAMPLE 5: Integrate into Stripe webhook handler
// ============================================================================

export async function exampleStripeWebhook(orgId: string, stripeEvent: any) {
  if (stripeEvent.type === "payment_intent.succeeded") {
    const paymentIntent = stripeEvent.data.object;

    // Get booking details from metadata
    const bookingNumber = paymentIntent.metadata.bookingNumber;
    const customerEmail = paymentIntent.metadata.customerEmail;

    // Trigger Zapier webhook
    await triggerPaymentReceived(orgId, {
      id: paymentIntent.id,
      amount: paymentIntent.amount / 100, // Convert from cents
      currency: paymentIntent.currency.toUpperCase(),
      status: "succeeded",
      bookingNumber,
      customerEmail,
      paymentMethod: paymentIntent.payment_method_types[0],
    });
  }
}

// ============================================================================
// EXAMPLE 6: Background job for trip completion
// ============================================================================

export async function exampleTripCompletion(orgId: string, tripId: string) {
  // ... mark trip as completed ...

  const trip = {
    id: tripId,
    name: "Afternoon Dive",
    date: "2024-03-15",
    startTime: "14:00",
    endTime: "17:00",
    capacity: 12,
    bookedSpots: 10,
    status: "completed",
  };

  // Trigger webhook
  await triggerTripCompleted(orgId, trip);
}

// ============================================================================
// EXAMPLE 7: Form submission handler
// ============================================================================

export async function exampleContactFormSubmission(orgId: string, formData: any) {
  // Create customer from form
  const customer = {
    id: "cust_new123",
    firstName: formData.firstName,
    lastName: formData.lastName,
    email: formData.email,
    phone: formData.phone,
  };

  // Trigger webhook
  await triggerCustomerCreated(orgId, customer);

  // This could trigger a Zap that:
  // - Adds to Mailchimp list
  // - Sends welcome email
  // - Creates CRM contact
  // - Notifies team in Slack
}

// ============================================================================
// EXAMPLE 8: Refund processing
// ============================================================================

export async function exampleRefundProcessing(orgId: string, refundData: any) {
  const payment = {
    id: refundData.paymentId,
    amount: refundData.amount,
    currency: refundData.currency,
    status: "refunded",
    bookingNumber: refundData.bookingNumber,
    customerEmail: refundData.customerEmail,
    refundReason: refundData.reason,
  };

  // Trigger webhook
  await triggerPaymentRefunded(orgId, payment);
}

// ============================================================================
// BEST PRACTICES
// ============================================================================

/**
 * 1. ALWAYS trigger webhooks AFTER successful database operations
 *    ✅ Save to DB first, then trigger webhook
 *    ❌ Don't trigger webhook before saving
 *
 * 2. Use try-catch but don't fail the main operation if webhook fails
 *    The webhook is delivered via background queue with retries
 *
 * 3. Keep event data focused and relevant
 *    Only send data that's useful for automations
 *
 * 4. Use descriptive event names
 *    booking.created, not just "booking"
 *
 * 5. Include IDs and timestamps
 *    Makes it easier to debug and track events
 */

export async function bestPracticeExample(orgId: string) {
  try {
    // 1. Perform main business logic
    const booking = await createBookingInDatabase();

    // 2. Trigger webhook (non-blocking)
    await triggerBookingCreated(orgId, {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      tripName: booking.trip.name,
      tripDate: booking.trip.date.toISOString(),
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
      customerEmail: booking.customer.email,
      participants: booking.participants,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      status: booking.status,
    });

    // 3. Continue with rest of logic
    await sendConfirmationEmail(booking);

    return { success: true, booking };
  } catch (error) {
    // 4. Handle errors appropriately
    console.error("Booking creation failed:", error);
    throw error;
  }
}

// Mock function for example
async function createBookingInDatabase(): Promise<any> {
  return {
    id: "bk_123",
    bookingNumber: "BK-2024-001",
    trip: { name: "Dive Trip", date: new Date() },
    customer: { firstName: "John", lastName: "Doe", email: "john@example.com" },
    participants: 2,
    totalAmount: 150,
    currency: "USD",
    status: "confirmed",
  };
}

async function sendConfirmationEmail(booking: any): Promise<void> {
  // Email logic here
}
