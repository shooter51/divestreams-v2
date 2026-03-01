/**
 * Stripe Email Notifications
 *
 * Handles sending payment-related emails from Stripe webhook events.
 */

import type Stripe from 'stripe';
import { sendEmail } from '../email/email.server';
import { getPaymentSuccessEmail, getPaymentFailedEmail } from '../email/templates';
import { stripeLogger } from '../logger';

/**
 * Send payment success email from invoice
 */
export async function sendPaymentSuccessEmail(
  invoice: Stripe.Invoice,
  organizationName: string = 'DiveStreams',
  organizationEmail?: string
): Promise<void> {
  // Extract customer info
  const customerEmail = invoice.customer_email;
  const customerName = invoice.customer_name ||
    (invoice.customer && typeof invoice.customer === 'object' && 'name' in invoice.customer ? (invoice.customer as { name?: string }).name : null) ||
    'Valued Customer';

  if (!customerEmail) {
    stripeLogger.warn({ invoiceId: invoice.id }, "No customer email on invoice for payment success email");
    return;
  }

  // Format amount
  const amount = formatAmount(invoice.amount_paid, invoice.currency);

  // Get the email content
  const emailContent = getPaymentSuccessEmail({
    customerName,
    customerEmail,
    amount,
    currency: invoice.currency,
    invoiceNumber: invoice.number || undefined,
    invoiceUrl: invoice.hosted_invoice_url || undefined,
    description: invoice.description || getInvoiceDescription(invoice),
    paymentDate: formatDate(new Date((invoice.status_transitions?.paid_at || Date.now() / 1000) * 1000)),
    organizationName,
    organizationEmail,
  });

  // Send the email
  const result = await sendEmail({
    to: customerEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    replyTo: organizationEmail,
  });

  if (!result.success) {
    stripeLogger.error({ error: result.error, invoiceId: invoice.id }, "Failed to send payment success email");
  }
}

/**
 * Send payment failed email from invoice
 */
export async function sendPaymentFailedEmail(
  invoice: Stripe.Invoice,
  organizationName: string = 'DiveStreams',
  organizationEmail?: string,
  billingPortalUrl?: string
): Promise<void> {
  // Extract customer info
  const customerEmail = invoice.customer_email;
  const customerName = invoice.customer_name ||
    (invoice.customer && typeof invoice.customer === 'object' && 'name' in invoice.customer ? (invoice.customer as { name?: string }).name : null) ||
    'Valued Customer';

  if (!customerEmail) {
    stripeLogger.warn({ invoiceId: invoice.id }, "No customer email on invoice for payment failed email");
    return;
  }

  // Format amount
  const amount = formatAmount(invoice.amount_due, invoice.currency);

  // Get failure reason from charge
  let failureReason: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const charge = (invoice as any).charge;
  if (charge && typeof charge === 'object') {
    failureReason = charge.failure_code || charge.failure_message || undefined;
  }

  // Get the email content
  const emailContent = getPaymentFailedEmail({
    customerName,
    customerEmail,
    amount,
    currency: invoice.currency,
    failureReason,
    invoiceNumber: invoice.number || undefined,
    retryUrl: billingPortalUrl || invoice.hosted_invoice_url || undefined,
    attemptDate: formatDate(new Date()),
    organizationName,
    organizationEmail,
  });

  // Send the email
  const result = await sendEmail({
    to: customerEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    replyTo: organizationEmail,
  });

  if (!result.success) {
    stripeLogger.error({ error: result.error, invoiceId: invoice.id }, "Failed to send payment failed email");
  }
}

// Helper functions

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatAmount(amountInCents: number, _currency: string): string {
  const amount = amountInCents / 100;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getInvoiceDescription(invoice: Stripe.Invoice): string | undefined {
  if (invoice.lines?.data?.[0]?.description) {
    return invoice.lines.data[0].description;
  }
  return undefined;
}
