/**
 * Payment Failed Email Template
 *
 * SECURITY: All user-provided data is escaped to prevent XSS attacks
 */

import { escapeHtml } from "../../security/sanitize";

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
  // SECURITY: Escape all user-provided data to prevent XSS
  const customerName = escapeHtml(data.customerName);
  const amount = escapeHtml(data.amount);
  const currency = escapeHtml(data.currency.toUpperCase());
  const attemptDate = escapeHtml(data.attemptDate);
  const invoiceNumber = data.invoiceNumber ? escapeHtml(data.invoiceNumber) : null;
  const organizationName = escapeHtml(data.organizationName);
  const organizationEmail = data.organizationEmail ? escapeHtml(data.organizationEmail) : null;
  const retryUrl = data.retryUrl ? escapeHtml(data.retryUrl) : null;

  const subject = `Action Required: Payment Failed - ${amount} ${currency}`;

  // Map common Stripe decline codes to friendly messages
  const friendlyReason = escapeHtml(getFriendlyFailureReason(data.failureReason));

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
      Hi ${customerName},
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
            ${amount} ${currency}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Date:</td>
          <td style="padding: 8px 0; text-align: right;">${attemptDate}</td>
        </tr>
        ${invoiceNumber ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">Invoice:</td>
          <td style="padding: 8px 0; text-align: right;">${invoiceNumber}</td>
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

    ${retryUrl ? `
    <div style="text-align: center; margin: 25px 0;">
      <a href="${retryUrl}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Update Payment Method
      </a>
    </div>
    ` : ''}

    <p style="color: #666; font-size: 14px; margin-top: 25px;">
      Need help? Contact us at
      ${organizationEmail ? `<a href="mailto:${organizationEmail}" style="color: #0066cc;">${organizationEmail}</a>` : 'our support team'}
      and we'll be happy to assist.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
      This email was sent by ${organizationName}
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Payment Failed - Action Required

Hi ${customerName},

We were unable to process your payment. Don't worry - your service is still active, but please update your payment method to avoid any interruption.

Payment Details:
- Amount: ${amount} ${currency}
- Date: ${attemptDate}
${invoiceNumber ? `- Invoice: ${invoiceNumber}` : ''}
- Reason: ${friendlyReason}

What you can do:
- Check that your card details are correct and up to date
- Ensure you have sufficient funds available
- Contact your bank if the issue persists
- Try a different payment method

${retryUrl ? `Update your payment method: ${retryUrl}` : ''}

Need help? Contact us and we'll be happy to assist.

${organizationName}
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
