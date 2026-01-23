# Stripe Payment Email Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement email notifications for successful and failed Stripe payments to keep customers informed about their payment status.

**Architecture:**
- Create a reusable email service using Nodemailer with SMTP
- Add email templates for payment success and failure
- Wire up webhook handlers to send emails

**Tech Stack:** TypeScript, Nodemailer, React Router v7, Stripe Webhooks

**Beads Issues:** DIVE-iru (confirmation), DIVE-8e4 (failure)

---

## Task 1: Create Email Service Infrastructure

**Files:**
- Create: `lib/email/email.server.ts`
- Create: `lib/email/templates/payment-success.ts`
- Create: `lib/email/templates/payment-failed.ts`
- Create: `lib/email/templates/index.ts`

**Step 1: Create the email directory structure**

```bash
mkdir -p lib/email/templates
```

**Step 2: Create the base email service**

Create file `lib/email/email.server.ts`:

```typescript
/**
 * Email Service
 *
 * Handles sending transactional emails via SMTP.
 * Uses Nodemailer for email delivery.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Email configuration from environment
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@divestreams.com';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'DiveStreams';

// Check if email is configured
export function isEmailConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

// Create transporter lazily
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) {
    console.warn('[Email] SMTP not configured - emails will be logged only');
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const transport = getTransporter();

  // Log email in development or when SMTP not configured
  if (!transport) {
    console.log('[Email] Would send email:', {
      to: options.to,
      subject: options.subject,
      preview: options.text?.substring(0, 100) + '...',
    });
    return { success: true, messageId: 'dev-' + Date.now() };
  }

  try {
    const info = await transport.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    console.log('[Email] Sent:', {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify SMTP connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;

  try {
    await transport.verify();
    return true;
  } catch (error) {
    console.error('[Email] Connection verification failed:', error);
    return false;
  }
}
```

**Step 3: Create payment success email template**

Create file `lib/email/templates/payment-success.ts`:

```typescript
/**
 * Payment Success Email Template
 */

export interface PaymentSuccessData {
  customerName: string;
  customerEmail: string;
  amount: string;
  currency: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  description?: string;
  paymentDate: string;
  organizationName: string;
  organizationEmail?: string;
}

export function getPaymentSuccessEmail(data: PaymentSuccessData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Payment Confirmed - ${data.amount} ${data.currency.toUpperCase()}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0066cc 0%, #0099ff 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Payment Successful</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Hi ${data.customerName},
    </p>

    <p style="margin-bottom: 20px;">
      Thank you for your payment! We've successfully processed your transaction.
    </p>

    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111;">Payment Details</h2>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Amount:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #059669;">
            ${data.amount} ${data.currency.toUpperCase()}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Date:</td>
          <td style="padding: 8px 0; text-align: right;">${data.paymentDate}</td>
        </tr>
        ${data.invoiceNumber ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">Invoice:</td>
          <td style="padding: 8px 0; text-align: right;">${data.invoiceNumber}</td>
        </tr>
        ` : ''}
        ${data.description ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">Description:</td>
          <td style="padding: 8px 0; text-align: right;">${data.description}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${data.invoiceUrl ? `
    <div style="text-align: center; margin: 25px 0;">
      <a href="${data.invoiceUrl}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Receipt
      </a>
    </div>
    ` : ''}

    <p style="color: #666; font-size: 14px; margin-top: 25px;">
      If you have any questions about this payment, please contact us at
      ${data.organizationEmail ? `<a href="mailto:${data.organizationEmail}" style="color: #0066cc;">${data.organizationEmail}</a>` : 'our support team'}.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
      This email was sent by ${data.organizationName}
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Payment Confirmed

Hi ${data.customerName},

Thank you for your payment! We've successfully processed your transaction.

Payment Details:
- Amount: ${data.amount} ${data.currency.toUpperCase()}
- Date: ${data.paymentDate}
${data.invoiceNumber ? `- Invoice: ${data.invoiceNumber}` : ''}
${data.description ? `- Description: ${data.description}` : ''}

${data.invoiceUrl ? `View your receipt: ${data.invoiceUrl}` : ''}

If you have any questions about this payment, please contact us.

${data.organizationName}
  `.trim();

  return { subject, html, text };
}
```

**Step 4: Create payment failed email template**

Create file `lib/email/templates/payment-failed.ts`:

```typescript
/**
 * Payment Failed Email Template
 */

export interface PaymentFailedData {
  customerName: string;
  customerEmail: string;
  amount: string;
  currency: string;
  failureReason?: string;
  invoiceNumber?: string;
  retryUrl?: string;
  attemptDate: string;
  organizationName: string;
  organizationEmail?: string;
}

export function getPaymentFailedEmail(data: PaymentFailedData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Action Required: Payment Failed - ${data.amount} ${data.currency.toUpperCase()}`;

  // Map common Stripe decline codes to friendly messages
  const friendlyReason = getFriendlyFailureReason(data.failureReason);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Payment Failed</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Hi ${data.customerName},
    </p>

    <p style="margin-bottom: 20px;">
      We were unable to process your payment. Don't worry - your service is still active, but please update your payment method to avoid any interruption.
    </p>

    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #991b1b;">Payment Details</h2>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Amount:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">
            ${data.amount} ${data.currency.toUpperCase()}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Date:</td>
          <td style="padding: 8px 0; text-align: right;">${data.attemptDate}</td>
        </tr>
        ${data.invoiceNumber ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">Invoice:</td>
          <td style="padding: 8px 0; text-align: right;">${data.invoiceNumber}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #666;">Reason:</td>
          <td style="padding: 8px 0; text-align: right; color: #dc2626;">${friendlyReason}</td>
        </tr>
      </table>
    </div>

    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px 0; font-size: 16px;">What you can do:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #666;">
        <li style="margin-bottom: 8px;">Check that your card details are correct and up to date</li>
        <li style="margin-bottom: 8px;">Ensure you have sufficient funds available</li>
        <li style="margin-bottom: 8px;">Contact your bank if the issue persists</li>
        <li style="margin-bottom: 8px;">Try a different payment method</li>
      </ul>
    </div>

    ${data.retryUrl ? `
    <div style="text-align: center; margin: 25px 0;">
      <a href="${data.retryUrl}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Update Payment Method
      </a>
    </div>
    ` : ''}

    <p style="color: #666; font-size: 14px; margin-top: 25px;">
      Need help? Contact us at
      ${data.organizationEmail ? `<a href="mailto:${data.organizationEmail}" style="color: #0066cc;">${data.organizationEmail}</a>` : 'our support team'}
      and we'll be happy to assist.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
      This email was sent by ${data.organizationName}
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Payment Failed - Action Required

Hi ${data.customerName},

We were unable to process your payment. Don't worry - your service is still active, but please update your payment method to avoid any interruption.

Payment Details:
- Amount: ${data.amount} ${data.currency.toUpperCase()}
- Date: ${data.attemptDate}
${data.invoiceNumber ? `- Invoice: ${data.invoiceNumber}` : ''}
- Reason: ${friendlyReason}

What you can do:
- Check that your card details are correct and up to date
- Ensure you have sufficient funds available
- Contact your bank if the issue persists
- Try a different payment method

${data.retryUrl ? `Update your payment method: ${data.retryUrl}` : ''}

Need help? Contact us and we'll be happy to assist.

${data.organizationName}
  `.trim();

  return { subject, html, text };
}

function getFriendlyFailureReason(reason?: string): string {
  if (!reason) return 'Payment could not be processed';

  const reasonMap: Record<string, string> = {
    'card_declined': 'Your card was declined',
    'insufficient_funds': 'Insufficient funds',
    'expired_card': 'Your card has expired',
    'incorrect_cvc': 'Incorrect security code (CVC)',
    'processing_error': 'Processing error - please try again',
    'incorrect_number': 'Incorrect card number',
    'invalid_expiry_month': 'Invalid expiration month',
    'invalid_expiry_year': 'Invalid expiration year',
    'authentication_required': 'Additional authentication required',
    'generic_decline': 'Card declined - contact your bank',
    'do_not_honor': 'Card declined - contact your bank',
    'lost_card': 'Card reported as lost',
    'stolen_card': 'Card reported as stolen',
    'fraudulent': 'Transaction blocked for security',
  };

  return reasonMap[reason.toLowerCase()] || reason;
}
```

**Step 5: Create templates index file**

Create file `lib/email/templates/index.ts`:

```typescript
/**
 * Email Templates Index
 */

export { getPaymentSuccessEmail, type PaymentSuccessData } from './payment-success';
export { getPaymentFailedEmail, type PaymentFailedData } from './payment-failed';
```

**Step 6: Verify files compile**

```bash
npx tsc --noEmit lib/email/email.server.ts lib/email/templates/index.ts
```

Expected: No errors

**Step 7: Commit**

```bash
git add lib/email/
git commit -m "feat(email): add email service and payment email templates

- Create reusable email service with Nodemailer
- Add payment success email template with receipt details
- Add payment failed email template with retry instructions
- Support graceful fallback when SMTP not configured

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Write Tests for Email Service

**Files:**
- Create: `tests/unit/lib/email/email.server.test.ts`
- Create: `tests/unit/lib/email/templates/payment-success.test.ts`
- Create: `tests/unit/lib/email/templates/payment-failed.test.ts`

**Step 1: Create test directory**

```bash
mkdir -p tests/unit/lib/email/templates
```

**Step 2: Write email service tests**

Create file `tests/unit/lib/email/email.server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-123' }),
      verify: vi.fn().mockResolvedValue(true),
    })),
  },
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    vi.stubEnv('SMTP_HOST', '');
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASS', '');
  });

  describe('isEmailConfigured', () => {
    it('should return false when SMTP not configured', async () => {
      const { isEmailConfigured } = await import('../../../../lib/email/email.server');
      expect(isEmailConfigured()).toBe(false);
    });

    it('should return true when SMTP configured', async () => {
      vi.stubEnv('SMTP_HOST', 'smtp.test.com');
      vi.stubEnv('SMTP_USER', 'user@test.com');
      vi.stubEnv('SMTP_PASS', 'password');

      // Re-import to pick up new env vars
      vi.resetModules();
      const { isEmailConfigured } = await import('../../../../lib/email/email.server');

      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe('sendEmail', () => {
    it('should log email when SMTP not configured', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { sendEmail } = await import('../../../../lib/email/email.server');

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-/);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
```

**Step 3: Write payment success template tests**

Create file `tests/unit/lib/email/templates/payment-success.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getPaymentSuccessEmail, type PaymentSuccessData } from '../../../../../lib/email/templates/payment-success';

describe('Payment Success Email Template', () => {
  const baseData: PaymentSuccessData = {
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    amount: '99.99',
    currency: 'usd',
    paymentDate: 'January 23, 2026',
    organizationName: 'Ocean Dive Shop',
  };

  it('should generate email with correct subject', () => {
    const { subject } = getPaymentSuccessEmail(baseData);

    expect(subject).toBe('Payment Confirmed - 99.99 USD');
  });

  it('should include customer name in HTML', () => {
    const { html } = getPaymentSuccessEmail(baseData);

    expect(html).toContain('Hi John Doe');
  });

  it('should include amount and currency in HTML', () => {
    const { html } = getPaymentSuccessEmail(baseData);

    expect(html).toContain('99.99 USD');
  });

  it('should include invoice number when provided', () => {
    const data: PaymentSuccessData = {
      ...baseData,
      invoiceNumber: 'INV-12345',
    };

    const { html, text } = getPaymentSuccessEmail(data);

    expect(html).toContain('INV-12345');
    expect(text).toContain('INV-12345');
  });

  it('should include invoice URL when provided', () => {
    const data: PaymentSuccessData = {
      ...baseData,
      invoiceUrl: 'https://stripe.com/invoice/123',
    };

    const { html } = getPaymentSuccessEmail(data);

    expect(html).toContain('https://stripe.com/invoice/123');
    expect(html).toContain('View Receipt');
  });

  it('should include organization name', () => {
    const { html, text } = getPaymentSuccessEmail(baseData);

    expect(html).toContain('Ocean Dive Shop');
    expect(text).toContain('Ocean Dive Shop');
  });

  it('should generate valid text version', () => {
    const { text } = getPaymentSuccessEmail(baseData);

    expect(text).toContain('Payment Confirmed');
    expect(text).toContain('John Doe');
    expect(text).toContain('99.99 USD');
  });
});
```

**Step 4: Write payment failed template tests**

Create file `tests/unit/lib/email/templates/payment-failed.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getPaymentFailedEmail, type PaymentFailedData } from '../../../../../lib/email/templates/payment-failed';

describe('Payment Failed Email Template', () => {
  const baseData: PaymentFailedData = {
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    amount: '99.99',
    currency: 'usd',
    attemptDate: 'January 23, 2026',
    organizationName: 'Ocean Dive Shop',
  };

  it('should generate email with correct subject', () => {
    const { subject } = getPaymentFailedEmail(baseData);

    expect(subject).toBe('Action Required: Payment Failed - 99.99 USD');
  });

  it('should include customer name in HTML', () => {
    const { html } = getPaymentFailedEmail(baseData);

    expect(html).toContain('Hi John Doe');
  });

  it('should map card_declined to friendly message', () => {
    const data: PaymentFailedData = {
      ...baseData,
      failureReason: 'card_declined',
    };

    const { html, text } = getPaymentFailedEmail(data);

    expect(html).toContain('Your card was declined');
    expect(text).toContain('Your card was declined');
  });

  it('should map insufficient_funds to friendly message', () => {
    const data: PaymentFailedData = {
      ...baseData,
      failureReason: 'insufficient_funds',
    };

    const { html } = getPaymentFailedEmail(data);

    expect(html).toContain('Insufficient funds');
  });

  it('should include retry URL when provided', () => {
    const data: PaymentFailedData = {
      ...baseData,
      retryUrl: 'https://example.com/billing',
    };

    const { html, text } = getPaymentFailedEmail(data);

    expect(html).toContain('https://example.com/billing');
    expect(html).toContain('Update Payment Method');
    expect(text).toContain('https://example.com/billing');
  });

  it('should include helpful suggestions', () => {
    const { html, text } = getPaymentFailedEmail(baseData);

    expect(html).toContain('Check that your card details');
    expect(html).toContain('Ensure you have sufficient funds');
    expect(text).toContain('Check that your card details');
  });

  it('should handle unknown failure reason', () => {
    const data: PaymentFailedData = {
      ...baseData,
      failureReason: 'some_unknown_error',
    };

    const { html } = getPaymentFailedEmail(data);

    expect(html).toContain('some_unknown_error');
  });
});
```

**Step 5: Run tests**

```bash
npm test -- tests/unit/lib/email/
```

Expected: All tests pass

**Step 6: Commit**

```bash
git add tests/unit/lib/email/
git commit -m "test(email): add unit tests for email service and templates

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Wire Up Stripe Webhook Handlers

**Files:**
- Create: `lib/stripe/email-notifications.server.ts`
- Modify: `lib/stripe/webhook.server.ts`

**Step 1: Create email notification helpers for Stripe**

Create file `lib/stripe/email-notifications.server.ts`:

```typescript
/**
 * Stripe Email Notifications
 *
 * Handles sending payment-related emails from Stripe webhook events.
 */

import type Stripe from 'stripe';
import { sendEmail } from '../email/email.server';
import { getPaymentSuccessEmail, getPaymentFailedEmail } from '../email/templates';

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
    (typeof invoice.customer === 'object' ? invoice.customer?.name : null) ||
    'Valued Customer';

  if (!customerEmail) {
    console.warn('[Stripe Email] No customer email on invoice:', invoice.id);
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
    console.error('[Stripe Email] Failed to send payment success email:', result.error);
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
    (typeof invoice.customer === 'object' ? invoice.customer?.name : null) ||
    'Valued Customer';

  if (!customerEmail) {
    console.warn('[Stripe Email] No customer email on invoice:', invoice.id);
    return;
  }

  // Format amount
  const amount = formatAmount(invoice.amount_due, invoice.currency);

  // Get failure reason from charge
  let failureReason: string | undefined;
  if (invoice.charge && typeof invoice.charge === 'object') {
    failureReason = invoice.charge.failure_code || invoice.charge.failure_message || undefined;
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
    console.error('[Stripe Email] Failed to send payment failed email:', result.error);
  }
}

// Helper functions

function formatAmount(amountInCents: number, currency: string): string {
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
```

**Step 2: Update webhook handler to send emails**

Modify `lib/stripe/webhook.server.ts`. Find the `invoice.payment_succeeded` and `invoice.payment_failed` cases and update them:

Find this code block (around line 63-77):
```typescript
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceToDatabase(invoice);
        console.log("Payment succeeded for invoice:", invoice.id);
        // TODO: Send confirmation email
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceToDatabase(invoice);
        console.log("Payment failed for invoice:", invoice.id);
        // TODO: Send failed payment notification email
        break;
      }
```

Replace with:
```typescript
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceToDatabase(invoice);
        console.log("Payment succeeded for invoice:", invoice.id);

        // Send confirmation email
        try {
          const { sendPaymentSuccessEmail } = await import('./email-notifications.server');
          await sendPaymentSuccessEmail(invoice);
        } catch (emailError) {
          console.error("Failed to send payment success email:", emailError);
          // Don't fail the webhook - email is best-effort
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceToDatabase(invoice);
        console.log("Payment failed for invoice:", invoice.id);

        // Send failed payment notification email
        try {
          const { sendPaymentFailedEmail } = await import('./email-notifications.server');
          await sendPaymentFailedEmail(invoice);
        } catch (emailError) {
          console.error("Failed to send payment failed email:", emailError);
          // Don't fail the webhook - email is best-effort
        }
        break;
      }
```

**Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors

**Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add lib/stripe/email-notifications.server.ts lib/stripe/webhook.server.ts
git commit -m "feat(stripe): add email notifications for payment success/failure

- Create email notification helpers for Stripe events
- Wire up payment_succeeded webhook to send confirmation email
- Wire up payment_failed webhook to send failure notification
- Use dynamic import to keep webhook handler fast
- Email sending is best-effort - won't fail webhook on email error

Closes DIVE-iru, DIVE-8e4

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Update Beads and Final Verification

**Step 1: Mark beads issues as complete**

```bash
bd close DIVE-iru DIVE-8e4 --reason "Implemented email notifications using Nodemailer with HTML templates"
```

**Step 2: Run full test suite**

```bash
npm test
```

**Step 3: Run build**

```bash
npm run build
```

**Step 4: Sync beads**

```bash
bd sync
```

---

## Environment Variables Required

Add these to your `.env` file for email to work:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=Your Company Name
```

Without these variables, emails will be logged to console instead of sent (useful for development).

---

## Summary

This implementation:
1. Creates a reusable email service with Nodemailer
2. Provides professional HTML email templates for payment success and failure
3. Includes plain text fallbacks for email clients that don't support HTML
4. Maps Stripe error codes to user-friendly messages
5. Uses dynamic imports to keep webhook handlers fast
6. Fails gracefully - email errors don't break webhooks
