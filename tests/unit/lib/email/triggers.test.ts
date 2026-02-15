/**
 * Email Triggers Tests
 *
 * Tests for email trigger functions that queue emails via the job system.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the jobs module
const mockSendEmail = vi.fn().mockResolvedValue({ id: "job-1" });
vi.mock("../../../../lib/jobs/index", () => ({
  sendEmail: mockSendEmail,
}));

describe("Email Triggers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set APP_URL for consistent test expectations
    process.env.APP_URL = "https://divestreams.com";
  });

  describe("formatCurrency", () => {
    it("exports formatCurrency function", async () => {
      const triggersModule = await import("../../../../lib/email/triggers");
      expect(typeof triggersModule.formatCurrency).toBe("function");
    });

    it("formats cents to USD currency string", async () => {
      const { formatCurrency } = await import("../../../../lib/email/triggers");

      expect(formatCurrency(1000)).toBe("$10.00");
      expect(formatCurrency(1550)).toBe("$15.50");
      expect(formatCurrency(99)).toBe("$0.99");
      expect(formatCurrency(10000)).toBe("$100.00");
    });

    it("handles zero cents", async () => {
      const { formatCurrency } = await import("../../../../lib/email/triggers");
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("handles large amounts", async () => {
      const { formatCurrency } = await import("../../../../lib/email/triggers");
      expect(formatCurrency(100000)).toBe("$1,000.00");
      expect(formatCurrency(1000000)).toBe("$10,000.00");
    });
  });

  describe("triggerBookingConfirmation", () => {
    it("exports triggerBookingConfirmation function", async () => {
      const triggersModule = await import("../../../../lib/email/triggers");
      expect(typeof triggersModule.triggerBookingConfirmation).toBe("function");
    });

    it("calls sendEmail with booking-confirmation type", async () => {
      const { triggerBookingConfirmation } = await import("../../../../lib/email/triggers");

      await triggerBookingConfirmation({
        customerEmail: "customer@example.com",
        customerName: "John Doe",
        tripName: "Morning Dive",
        tripDate: "2024-01-15",
        tripTime: "09:00",
        participants: 2,
        totalCents: 15000,
        bookingNumber: "BK123",
        shopName: "Coral Divers",
        tenantId: "tenant-1",
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        "booking-confirmation",
        expect.objectContaining({
          to: "customer@example.com",
          tenantId: "tenant-1",
          customerName: "John Doe",
          tripName: "Morning Dive",
          total: "$150.00",
        })
      );
    });

    it("formats totalCents correctly in email", async () => {
      const { triggerBookingConfirmation } = await import("../../../../lib/email/triggers");

      await triggerBookingConfirmation({
        customerEmail: "test@test.com",
        customerName: "Test User",
        tripName: "Test Trip",
        tripDate: "2024-02-20",
        tripTime: "14:00",
        participants: 4,
        totalCents: 29999,
        bookingNumber: "BK456",
        shopName: "Test Shop",
        tenantId: "tenant-2",
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        "booking-confirmation",
        expect.objectContaining({
          total: "$299.99",
        })
      );
    });

    it("returns a promise", async () => {
      const { triggerBookingConfirmation } = await import("../../../../lib/email/triggers");

      const result = triggerBookingConfirmation({
        customerEmail: "test@test.com",
        customerName: "Test",
        tripName: "Trip",
        tripDate: "2024-01-01",
        tripTime: "10:00",
        participants: 1,
        totalCents: 5000,
        bookingNumber: "BK000",
        shopName: "Shop",
        tenantId: "t1",
      });

      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe("triggerWelcomeEmail", () => {
    it("exports triggerWelcomeEmail function", async () => {
      const triggersModule = await import("../../../../lib/email/triggers");
      expect(typeof triggersModule.triggerWelcomeEmail).toBe("function");
    });

    it("calls sendEmail with welcome type", async () => {
      const { triggerWelcomeEmail } = await import("../../../../lib/email/triggers");

      await triggerWelcomeEmail({
        userEmail: "newuser@example.com",
        userName: "New User",
        shopName: "Ocean Divers",
        subdomain: "oceandivers",
        tenantId: "tenant-3",
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        "welcome",
        expect.objectContaining({
          to: "newuser@example.com",
          tenantId: "tenant-3",
          userName: "New User",
          shopName: "Ocean Divers",
        })
      );
    });

    it("generates correct login URL from subdomain", async () => {
      const { triggerWelcomeEmail } = await import("../../../../lib/email/triggers");

      await triggerWelcomeEmail({
        userEmail: "user@test.com",
        userName: "User",
        shopName: "Test Shop",
        subdomain: "testshop",
        tenantId: "t4",
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        "welcome",
        expect.objectContaining({
          loginUrl: "https://testshop.divestreams.com/login",
        })
      );
    });
  });

  describe("triggerPasswordReset", () => {
    it("exports triggerPasswordReset function", async () => {
      const triggersModule = await import("../../../../lib/email/triggers");
      expect(typeof triggersModule.triggerPasswordReset).toBe("function");
    });

    it("calls sendEmail with password-reset type", async () => {
      const { triggerPasswordReset } = await import("../../../../lib/email/triggers");

      await triggerPasswordReset({
        userEmail: "forgot@example.com",
        userName: "Forgot User",
        resetToken: "abc123def456",
        tenantId: "tenant-5",
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        "password-reset",
        expect.objectContaining({
          to: "forgot@example.com",
          tenantId: "tenant-5",
          userName: "Forgot User",
        })
      );
    });

    it("generates correct reset URL with token", async () => {
      const { triggerPasswordReset } = await import("../../../../lib/email/triggers");

      await triggerPasswordReset({
        userEmail: "test@test.com",
        userName: "Test",
        resetToken: "xyz789",
        tenantId: "t6",
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        "password-reset",
        expect.objectContaining({
          resetUrl: "https://divestreams.com/reset-password?token=xyz789",
        })
      );
    });
  });

  describe("triggerCustomerWelcomeEmail", () => {
    it("exports triggerCustomerWelcomeEmail function", async () => {
      const triggersModule = await import("../../../../lib/email/triggers");
      expect(typeof triggersModule.triggerCustomerWelcomeEmail).toBe("function");
    });

    it("calls sendEmail with customer-welcome type", async () => {
      const { triggerCustomerWelcomeEmail } = await import("../../../../lib/email/triggers");

      await triggerCustomerWelcomeEmail({
        customerEmail: "customer@example.com",
        customerName: "New Customer",
        shopName: "Dive Shop",
        subdomain: "diveshop",
        tenantId: "tenant-7",
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        "customer-welcome",
        expect.objectContaining({
          to: "customer@example.com",
          tenantId: "tenant-7",
          customerName: "New Customer",
          shopName: "Dive Shop",
        })
      );
    });

    it("generates correct customer login URL from subdomain", async () => {
      const { triggerCustomerWelcomeEmail } = await import("../../../../lib/email/triggers");

      await triggerCustomerWelcomeEmail({
        customerEmail: "customer@test.com",
        customerName: "Customer",
        shopName: "Test Shop",
        subdomain: "testshop",
        tenantId: "t8",
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        "customer-welcome",
        expect.objectContaining({
          loginUrl: "https://testshop.divestreams.com/site/login",
        })
      );
    });

    it("uses customer portal path /site/login", async () => {
      const { triggerCustomerWelcomeEmail } = await import("../../../../lib/email/triggers");

      await triggerCustomerWelcomeEmail({
        customerEmail: "customer@example.com",
        customerName: "Customer",
        shopName: "Shop",
        subdomain: "shop",
        tenantId: "t9",
      });

      const call = mockSendEmail.mock.calls[0];
      expect(call[1].loginUrl).toContain("/site/login");
    });
  });

  describe("triggerCustomerSetPassword", () => {
    it("exports triggerCustomerSetPassword function", async () => {
      const triggersModule = await import("../../../../lib/email/triggers");
      expect(typeof triggersModule.triggerCustomerSetPassword).toBe("function");
    });

    it("calls sendEmail with customer-set-password type", async () => {
      const { triggerCustomerSetPassword } = await import("../../../../lib/email/triggers");

      await triggerCustomerSetPassword({
        customerEmail: "newcustomer@example.com",
        customerName: "New Customer",
        shopName: "Ocean Divers",
        subdomain: "oceandivers",
        resetToken: "setpass123",
        tenantId: "tenant-10",
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(
        "customer-set-password",
        expect.objectContaining({
          to: "newcustomer@example.com",
          tenantId: "tenant-10",
          customerName: "New Customer",
          shopName: "Ocean Divers",
        })
      );
    });

    it("generates correct set password URL with token", async () => {
      const { triggerCustomerSetPassword } = await import("../../../../lib/email/triggers");

      await triggerCustomerSetPassword({
        customerEmail: "customer@test.com",
        customerName: "Test Customer",
        shopName: "Test Shop",
        subdomain: "testshop",
        resetToken: "token123",
        tenantId: "t11",
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        "customer-set-password",
        expect.objectContaining({
          setPasswordUrl: "https://testshop.divestreams.com/site/set-password?token=token123",
        })
      );
    });

    it("uses customer portal path /site/set-password", async () => {
      const { triggerCustomerSetPassword } = await import("../../../../lib/email/triggers");

      await triggerCustomerSetPassword({
        customerEmail: "customer@example.com",
        customerName: "Customer",
        shopName: "Shop",
        subdomain: "shop",
        resetToken: "abc",
        tenantId: "t12",
      });

      const call = mockSendEmail.mock.calls[0];
      expect(call[1].setPasswordUrl).toContain("/site/set-password");
    });

    it("includes reset token in query string", async () => {
      const { triggerCustomerSetPassword } = await import("../../../../lib/email/triggers");

      await triggerCustomerSetPassword({
        customerEmail: "customer@test.com",
        customerName: "Test",
        shopName: "Shop",
        subdomain: "shop",
        resetToken: "unique-token-xyz",
        tenantId: "t13",
      });

      const call = mockSendEmail.mock.calls[0];
      expect(call[1].setPasswordUrl).toContain("token=unique-token-xyz");
    });
  });
});
