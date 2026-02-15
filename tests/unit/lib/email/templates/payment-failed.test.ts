import { describe, it, expect } from "vitest";
import { getPaymentFailedEmail, type PaymentFailedData } from "../../../../../lib/email/templates/payment-failed";

describe("getPaymentFailedEmail", () => {
  const defaultData: PaymentFailedData = {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    amount: "99.99",
    currency: "usd",
    attemptDate: "January 23, 2026",
    organizationName: "Ocean Dive Shop",
  };

  it("should generate correct output for default data", () => {
    const result = getPaymentFailedEmail(defaultData);
    expect(result.subject).toMatchInlineSnapshot(`"Action Required: Payment Failed - 99.99 USD"`);
    expect(result.html).toMatchSnapshot();
    expect(result.text).toMatchSnapshot();
  });

  it("should not contain HTML tags in text version", () => {
    const result = getPaymentFailedEmail(defaultData);
    expect(result.text).not.toContain("<html>");
    expect(result.text).not.toContain("<div>");
  });

  describe("failure reason mapping", () => {
    it("should map card_declined to friendly message", () => {
      const data: PaymentFailedData = {
        ...defaultData,
        failureReason: "card_declined",
      };

      const { html, text } = getPaymentFailedEmail(data);

      expect(html).toContain("Your card was declined");
      expect(text).toContain("Your card was declined");
    });

    it("should map insufficient_funds to friendly message", () => {
      const data: PaymentFailedData = {
        ...defaultData,
        failureReason: "insufficient_funds",
      };

      const { html } = getPaymentFailedEmail(data);

      expect(html).toContain("Insufficient funds");
    });

    it("should handle unknown failure reason", () => {
      const data: PaymentFailedData = {
        ...defaultData,
        failureReason: "some_unknown_error",
      };

      const { html } = getPaymentFailedEmail(data);

      expect(html).toContain("some_unknown_error");
    });
  });

  describe("retry URL", () => {
    it("should include retry URL when provided", () => {
      const data: PaymentFailedData = {
        ...defaultData,
        retryUrl: "https://example.com/billing",
      };

      const { html, text } = getPaymentFailedEmail(data);

      // HTML version has escaped URLs for security (/ becomes &#x2F;)
      expect(html).toContain("https:&#x2F;&#x2F;example.com&#x2F;billing");
      expect(html).toContain("Update Payment Method");
      // Text version should have unescaped URL
      expect(text).toContain("https://example.com/billing");
    });
  });

  describe("helpful suggestions", () => {
    it("should include helpful suggestions", () => {
      const { html, text } = getPaymentFailedEmail(defaultData);

      expect(html).toContain("Check that your card details");
      expect(html).toContain("Ensure you have sufficient funds");
      expect(text).toContain("Check that your card details");
    });
  });
});
