/**
 * POS Receipt Email Template
 *
 * SECURITY: All user-provided data is escaped to prevent XSS attacks
 */

import { escapeHtml } from "../../security/sanitize";

export interface POSReceiptData {
  receiptNumber: string;
  customerName: string;
  customerEmail: string;
  businessName: string;
  transactionDate: string;
  items: Array<{
    name: string;
    quantity?: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  taxName: string;
  total: number;
  paymentMethod: string;
  currency: string;
}

export function getPOSReceiptEmail(data: POSReceiptData): {
  subject: string;
  html: string;
  text: string;
} {
  // SECURITY: Escape all user-provided data to prevent XSS
  const businessName = escapeHtml(data.businessName);
  const customerName = escapeHtml(data.customerName);
  const receiptNumber = escapeHtml(data.receiptNumber);
  const transactionDate = escapeHtml(data.transactionDate);
  const currency = escapeHtml(data.currency.toUpperCase());
  const taxName = escapeHtml(data.taxName);
  const paymentMethod = escapeHtml(data.paymentMethod);

  // Escape item names in the items array
  const escapedItems = data.items.map(item => ({
    ...item,
    name: escapeHtml(item.name),
  }));

  const subject = `Receipt from ${businessName} - ${currency} ${data.total.toFixed(2)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0066cc 0%, #0099ff 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Receipt</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">${businessName}</p>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Hi ${customerName},
    </p>

    <p style="margin-bottom: 20px;">
      Thank you for your purchase! Here's your receipt for reference.
    </p>

    <!-- Receipt Details -->
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb;">
        <div>
          <p style="margin: 0; color: #666; font-size: 12px;">RECEIPT NUMBER</p>
          <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 14px;">${receiptNumber}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; color: #666; font-size: 12px;">DATE</p>
          <p style="margin: 5px 0 0 0; font-size: 14px;">${transactionDate}</p>
        </div>
      </div>

      <!-- Items -->
      <h3 style="margin: 20px 0 10px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Items</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        ${escapedItems.map(item => `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
              <div style="font-weight: 500;">${item.name}</div>
              ${item.quantity ? `<div style="font-size: 12px; color: #666;">${item.quantity} × ${currency} ${item.unitPrice.toFixed(2)}</div>` : ''}
            </td>
            <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #f3f4f6; font-weight: 500;">
              ${currency} ${item.total.toFixed(2)}
            </td>
          </tr>
        `).join('')}
      </table>

      <!-- Totals -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Subtotal:</td>
          <td style="padding: 8px 0; text-align: right;">${currency} ${data.subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">${taxName}:</td>
          <td style="padding: 8px 0; text-align: right;">${currency} ${data.tax.toFixed(2)}</td>
        </tr>
        <tr style="border-top: 2px solid #e5e7eb;">
          <td style="padding: 12px 0; font-weight: bold; font-size: 16px;">Total:</td>
          <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 16px; color: #059669;">
            ${currency} ${data.total.toFixed(2)}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Payment Method:</td>
          <td style="padding: 8px 0; text-align: right; text-transform: capitalize;">${paymentMethod}</td>
        </tr>
      </table>
    </div>

    <p style="color: #666; font-size: 14px; margin-top: 25px; text-align: center;">
      Thank you for your business!
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
      This email was sent by ${businessName}
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
RECEIPT
${businessName}

Hi ${customerName},

Thank you for your purchase! Here's your receipt for reference.

RECEIPT NUMBER: ${receiptNumber}
DATE: ${transactionDate}

ITEMS:
${escapedItems.map(item => `- ${item.name}${item.quantity ? ` (${item.quantity} × ${currency} ${item.unitPrice.toFixed(2)})` : ''}: ${currency} ${item.total.toFixed(2)}`).join('\n')}

SUMMARY:
Subtotal: ${currency} ${data.subtotal.toFixed(2)}
${taxName}: ${currency} ${data.tax.toFixed(2)}
Total: ${currency} ${data.total.toFixed(2)}
Payment Method: ${paymentMethod}

Thank you for your business!

${businessName}
  `.trim();

  return { subject, html, text };
}
