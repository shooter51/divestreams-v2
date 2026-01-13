/**
 * Email Trigger Functions
 *
 * Helper functions for triggering transactional emails via the job queue.
 * These functions format data and queue emails for background processing.
 */

import { sendEmail } from "../jobs/index";

/**
 * Format cents to USD currency string
 */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

/**
 * Trigger a booking confirmation email
 */
export async function triggerBookingConfirmation(params: {
  customerEmail: string;
  customerName: string;
  tripName: string;
  tripDate: string;
  tripTime: string;
  participants: number;
  totalCents: number;
  bookingNumber: string;
  shopName: string;
  tenantId: string;
}): Promise<void> {
  const total = formatCurrency(params.totalCents);

  await sendEmail("booking-confirmation", {
    to: params.customerEmail,
    tenantId: params.tenantId,
    customerName: params.customerName,
    tripName: params.tripName,
    tripDate: params.tripDate,
    tripTime: params.tripTime,
    participants: params.participants,
    total,
    bookingNumber: params.bookingNumber,
    shopName: params.shopName,
  });
}

/**
 * Trigger a welcome email for new users
 */
export async function triggerWelcomeEmail(params: {
  userEmail: string;
  userName: string;
  shopName: string;
  subdomain: string;
  tenantId: string;
}): Promise<void> {
  const loginUrl = `https://${params.subdomain}.divestreams.com/login`;

  await sendEmail("welcome", {
    to: params.userEmail,
    tenantId: params.tenantId,
    userName: params.userName,
    shopName: params.shopName,
    loginUrl,
  });
}

/**
 * Trigger a password reset email
 */
export async function triggerPasswordReset(params: {
  userEmail: string;
  userName: string;
  resetToken: string;
  tenantId: string;
}): Promise<void> {
  const resetUrl = `https://divestreams.com/reset-password?token=${params.resetToken}`;

  await sendEmail("password-reset", {
    to: params.userEmail,
    tenantId: params.tenantId,
    userName: params.userName,
    resetUrl,
  });
}
