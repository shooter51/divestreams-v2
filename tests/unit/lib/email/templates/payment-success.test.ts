import { describe, it, expect } from "vitest";
import {
  getPaymentSuccessEmail,
  type PaymentSuccessData,
} from "../../../../../lib/email/templates/payment-success";

describe("getPaymentSuccessEmail", () => {
  const defaultData: PaymentSuccessData = {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    amount: "99.99",
    currency: "usd",
    paymentDate: "January 23, 2026",
    organizationName: "Ocean Dive Shop",
  };

  it("should generate correct output for default data", () => {
    const result = getPaymentSuccessEmail(defaultData);
    expect(result.subject).toMatchInlineSnapshot(
      `"Payment Confirmed - 99.99 USD"`
    );
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should generate correct output with invoice number", () => {
    const result = getPaymentSuccessEmail({
      ...defaultData,
      invoiceNumber: "INV-12345",
    });
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should generate correct output with invoice URL", () => {
    const result = getPaymentSuccessEmail({
      ...defaultData,
      invoiceUrl: "https://stripe.com/invoice/123",
    });
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should not contain HTML tags in text version", () => {
    const result = getPaymentSuccessEmail(defaultData);
    expect(result.text).not.toContain("<html>");
    expect(result.text).not.toContain("<div>");
  });

  describe("HTML sanitization", () => {
    it("should escape HTML in customer name", () => {
      const result = getPaymentSuccessEmail({
        ...defaultData,
        customerName: "<script>alert('xss')</script>",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("should escape HTML in organization name", () => {
      const result = getPaymentSuccessEmail({
        ...defaultData,
        organizationName: "<img src=x onerror=alert(1)>",
      });
      expect(result.html).not.toContain("<img");
    });

    it("should escape HTML in amount", () => {
      const result = getPaymentSuccessEmail({
        ...defaultData,
        amount: "<b>99.99</b>",
      });
      expect(result.html).not.toContain("<b>99.99</b>");
      expect(result.html).toContain("&lt;b&gt;");
    });

    it("should escape HTML in invoice number", () => {
      const result = getPaymentSuccessEmail({
        ...defaultData,
        invoiceNumber: "INV<script>alert(1)</script>",
      });
      expect(result.html).not.toContain("<script>");
    });
  });
});
