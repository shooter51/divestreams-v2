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

  describe("subject line", () => {
    it("should generate correct subject line", () => {
      const { subject } = getPOSReceiptEmail(mockReceiptData);

      expect(subject).toBe("Receipt from Dive Shop Inc - USD 126.50");
    });

    it("should uppercase currency code in subject", () => {
      const data = { ...mockReceiptData, currency: "eur" };
      const { subject } = getPOSReceiptEmail(data);

      expect(subject).toContain("EUR");
    });

    it("should format total to 2 decimal places in subject", () => {
      const data = { ...mockReceiptData, total: 100 };
      const { subject } = getPOSReceiptEmail(data);

      expect(subject).toContain("100.00");
    });

    it("should escape HTML in business name for subject", () => {
      const data = { ...mockReceiptData, businessName: "Dive <script>alert('xss')</script> Shop" };
      const { subject } = getPOSReceiptEmail(data);

      expect(subject).toContain("&lt;script&gt;");
      expect(subject).not.toContain("<script>");
    });
  });

  describe("HTML email", () => {
    it("should generate valid HTML structure", () => {
      const { html } = getPOSReceiptEmail(mockReceiptData);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html>");
      expect(html).toContain("</html>");
      expect(html).toContain("<body");
      expect(html).toContain("</body>");
    });

    it("should include receipt header with business name", () => {
      const { html } = getPOSReceiptEmail(mockReceiptData);

      expect(html).toContain("Receipt");
      expect(html).toContain("Dive Shop Inc");
    });

    it("should greet customer by name", () => {
      const { html } = getPOSReceiptEmail(mockReceiptData);

      expect(html).toContain("Hi John Doe");
    });

    it("should display receipt number and date", () => {
      const { html } = getPOSReceiptEmail(mockReceiptData);

      expect(html).toContain("REC-001");
      expect(html).toContain("2024-01-15 10:30 AM");
    });

    it("should list all items with details", () => {
      const { html } = getPOSReceiptEmail(mockReceiptData);

      expect(html).toContain("Dive Mask");
      expect(html).toContain("Snorkel");
      expect(html).toContain("2 × USD 45.00");
      expect(html).toContain("USD 90.00");
      expect(html).toContain("USD 25.00");
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

      const { html } = getPOSReceiptEmail(data);

      expect(html).toContain("Service Fee");
      expect(html).toContain("USD 50.00");
      expect(html).not.toContain("×");
    });

    it("should display totals section", () => {
      const { html } = getPOSReceiptEmail(mockReceiptData);

      expect(html).toContain("Subtotal");
      expect(html).toContain("USD 115.00");
      expect(html).toContain("VAT");
      expect(html).toContain("USD 11.50");
      expect(html).toContain("Total");
      expect(html).toContain("USD 126.50");
    });

    it("should display payment method", () => {
      const { html } = getPOSReceiptEmail(mockReceiptData);

      expect(html).toContain("Payment Method");
      expect(html).toContain("credit card");
    });

    it("should include footer message", () => {
      const { html } = getPOSReceiptEmail(mockReceiptData);

      expect(html).toContain("Thank you for your business!");
      expect(html).toContain("This email was sent by Dive Shop Inc");
    });

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

    it("should handle different currencies", () => {
      const data = { ...mockReceiptData, currency: "eur" };
      const { html } = getPOSReceiptEmail(data);

      expect(html).toContain("EUR");
      expect(html).not.toContain("USD");
    });

    it("should uppercase currency code", () => {
      const data = { ...mockReceiptData, currency: "gbp" };
      const { html } = getPOSReceiptEmail(data);

      expect(html).toContain("GBP");
    });
  });

  describe("text email", () => {
    it("should generate plain text version", () => {
      const { text } = getPOSReceiptEmail(mockReceiptData);

      expect(text).toContain("RECEIPT");
      expect(text).toContain("Dive Shop Inc");
      expect(text).not.toContain("<html>");
      expect(text).not.toContain("<body>");
    });

    it("should greet customer by name", () => {
      const { text } = getPOSReceiptEmail(mockReceiptData);

      expect(text).toContain("Hi John Doe");
    });

    it("should include receipt number and date", () => {
      const { text } = getPOSReceiptEmail(mockReceiptData);

      expect(text).toContain("RECEIPT NUMBER: REC-001");
      expect(text).toContain("DATE: 2024-01-15 10:30 AM");
    });

    it("should list all items", () => {
      const { text } = getPOSReceiptEmail(mockReceiptData);

      expect(text).toContain("ITEMS:");
      expect(text).toContain("- Dive Mask (2 × USD 45.00): USD 90.00");
      expect(text).toContain("- Snorkel (1 × USD 25.00): USD 25.00");
    });

    it("should list items without quantity when not provided", () => {
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

      const { text } = getPOSReceiptEmail(data);

      expect(text).toContain("- Service Fee: USD 50.00");
      expect(text).not.toContain("×");
    });

    it("should include summary section", () => {
      const { text } = getPOSReceiptEmail(mockReceiptData);

      expect(text).toContain("SUMMARY:");
      expect(text).toContain("Subtotal: USD 115.00");
      expect(text).toContain("VAT: USD 11.50");
      expect(text).toContain("Total: USD 126.50");
      expect(text).toContain("Payment Method: credit card");
    });

    it("should include footer", () => {
      const { text } = getPOSReceiptEmail(mockReceiptData);

      expect(text).toContain("Thank you for your business!");
      expect(text).toMatch(/Dive Shop Inc\s*$/);
    });

    it("should escape HTML entities in text version", () => {
      const data = { ...mockReceiptData, customerName: "John <script>" };
      const { text } = getPOSReceiptEmail(data);

      expect(text).toContain("&lt;script&gt;");
    });

    it("should handle different tax names", () => {
      const data = { ...mockReceiptData, taxName: "GST" };
      const { text } = getPOSReceiptEmail(data);

      expect(text).toContain("GST: USD 11.50");
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

    it("should handle very long item names", () => {
      const longName = "A".repeat(200);
      const data: POSReceiptData = {
        ...mockReceiptData,
        items: [
          {
            name: longName,
            quantity: 1,
            unitPrice: 10.0,
            total: 10.0,
          },
        ],
      };

      const { html, text } = getPOSReceiptEmail(data);

      expect(html).toContain(longName);
      expect(text).toContain(longName);
    });

    it("should handle special characters in payment method", () => {
      const data = { ...mockReceiptData, paymentMethod: "Visa **** 1234" };
      const { html, text } = getPOSReceiptEmail(data);

      expect(html).toContain("Visa **** 1234");
      expect(text).toContain("Visa **** 1234");
    });
  });
});
