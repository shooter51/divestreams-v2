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

    // HTML version has escaped URLs for security (/ becomes &#x2F;)
    expect(html).toContain('https:&#x2F;&#x2F;stripe.com&#x2F;invoice&#x2F;123');
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
