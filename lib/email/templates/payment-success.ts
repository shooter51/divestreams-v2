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
