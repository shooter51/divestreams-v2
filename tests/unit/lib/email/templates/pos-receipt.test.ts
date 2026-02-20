import { describe, it, expect } from "vitest";
import { getPOSReceiptEmail, type POSReceiptData } from "../../../../../lib/email/templates/pos-receipt";

describe("getPOSReceiptEmail", () => {
  const mockReceiptData: POSReceiptData = {
    receiptNumber: "REC-001",
    customerName: "John Doe",
    customerEmail: "john@example.com",
    businessName: "Dive Shop Inc",
    transactionDate: "2024-01-15 10:30 AM",
    items: [
      {
        name: "Dive Mask",
        quantity: 2,
        unitPrice: 45.0,
        total: 90.0,
      },
      {
        name: "Snorkel",
        quantity: 1,
        unitPrice: 25.0,
        total: 25.0,
      },
    ],
    subtotal: 115.0,
    tax: 11.5,
    taxName: "VAT",
    total: 126.5,
    paymentMethod: "credit card",
    currency: "USD",
  };

  it("should generate correct output for default data", () => {
    const result = getPOSReceiptEmail(mockReceiptData);
    expect(result.subject).toMatchInlineSnapshot(`"Receipt from Dive Shop Inc - USD 126.50"`);
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should not contain HTML tags in text version", () => {
    const { text } = getPOSReceiptEmail(mockReceiptData);
    expect(text).not.toContain("<html>");
    expect(text).not.toContain("<body>");
  });

  it("should use plain text business name in subject (not HTML-escaped)", () => {
    const data = { ...mockReceiptData, businessName: "Bob's Dive & Bar" };
    const { subject } = getPOSReceiptEmail(data);

    // Subject is plain text — should NOT contain HTML entities
    expect(subject).toContain("Bob's Dive & Bar");
    expect(subject).not.toContain("&amp;");
  });

  describe("HTML sanitization", () => {
    it("should escape HTML in customer name to prevent XSS", () => {
      const data = { ...mockReceiptData, customerName: "John <script>alert('xss')</script>" };
      const { html } = getPOSReceiptEmail(data);

      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert");
    });

    it("should escape HTML in business name to prevent XSS", () => {
      const data = { ...mockReceiptData, businessName: "Shop <img src=x onerror=alert(1)>" };
      const { html } = getPOSReceiptEmail(data);

      expect(html).toContain("&lt;img");
      expect(html).not.toContain("<img src=x");
    });

    it("should escape HTML in item names to prevent XSS", () => {
      const data: POSReceiptData = {
        ...mockReceiptData,
        items: [
          {
            name: "Product <script>alert('xss')</script>",
            quantity: 1,
            unitPrice: 10.0,
            total: 10.0,
          },
        ],
      };

      const { html } = getPOSReceiptEmail(data);

      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>alert");
    });

    it("should escape HTML in receipt number", () => {
      const data = { ...mockReceiptData, receiptNumber: "REC-<b>001</b>" };
      const { html } = getPOSReceiptEmail(data);

      expect(html).toContain("&lt;b&gt;001&lt;&#x2F;b&gt;");
      expect(html).not.toContain("<b>001</b>");
    });

    it("should escape HTML entities in text version", () => {
      const data = { ...mockReceiptData, customerName: "John <script>" };
      const { text } = getPOSReceiptEmail(data);

      expect(text).toContain("&lt;script&gt;");
    });
  });

  describe("edge cases", () => {
    it("should handle empty items array", () => {
      const data: POSReceiptData = {
        ...mockReceiptData,
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
      };

      const { html, text } = getPOSReceiptEmail(data);

      expect(html).toContain("USD 0.00");
      expect(text).toContain("USD 0.00");
    });

    it("should handle zero values", () => {
      const data: POSReceiptData = {
        ...mockReceiptData,
        items: [
          {
            name: "Free Item",
            quantity: 1,
            unitPrice: 0,
            total: 0,
          },
        ],
        subtotal: 0,
        tax: 0,
        total: 0,
      };

      const { html, text } = getPOSReceiptEmail(data);

      expect(html).toContain("Free Item");
      expect(html).toContain("USD 0.00");
      expect(text).toContain("Free Item");
      expect(text).toContain("USD 0.00");
    });

    it("should format decimal amounts correctly", () => {
      const data = { ...mockReceiptData, total: 123.456 };
      const { html, text } = getPOSReceiptEmail(data);

      expect(html).toContain("USD 123.46");
      expect(text).toContain("USD 123.46");
    });

    it("should display items without quantity when not provided", () => {
      const data: POSReceiptData = {
        ...mockReceiptData,
        items: [
          {
            name: "Service Fee",
            unitPrice: 50.0,
            total: 50.0,
          },
        ],
      };

      const { html, text } = getPOSReceiptEmail(data);

      expect(html).not.toContain("×");
      expect(text).not.toContain("×");
    });

    it("should handle different currencies", () => {
      const data = { ...mockReceiptData, currency: "eur" };
      const { html } = getPOSReceiptEmail(data);

      expect(html).toContain("EUR");
      expect(html).not.toContain("USD");
    });

    it("should handle different tax names", () => {
      const data = { ...mockReceiptData, taxName: "GST" };
      const { text } = getPOSReceiptEmail(data);

      expect(text).toContain("GST: USD 11.50");
    });
  });
});
