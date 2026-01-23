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
