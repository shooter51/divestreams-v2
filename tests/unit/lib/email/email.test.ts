/**
 * Email Service Tests
 *
 * Tests for email sending functionality and email templates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-id" });
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
    }),
  },
}));

describe("Email Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendEmail function", () => {
    it("exports sendEmail function", async () => {
      const emailModule = await import("../../../../lib/email/index");
      expect(typeof emailModule.sendEmail).toBe("function");
    });

    it("returns true when SMTP is not configured (logs only)", async () => {
      // Without SMTP_HOST, should log and return true
      const originalHost = process.env.SMTP_HOST;
      delete process.env.SMTP_HOST;

      // Reset module cache to pick up env change
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/index");

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test body</p>",
      });

      expect(result).toBe(true);

      // Restore
      if (originalHost) process.env.SMTP_HOST = originalHost;
    });
  });

  describe("bookingConfirmationEmail template", () => {
    it("exports bookingConfirmationEmail function", async () => {
      const emailModule = await import("../../../../lib/email/index");
      expect(typeof emailModule.bookingConfirmationEmail).toBe("function");
    });

    it("generates correct subject line", async () => {
      const { bookingConfirmationEmail } = await import("../../../../lib/email/index");

      const result = bookingConfirmationEmail({
        customerName: "John Doe",
        tripName: "Morning Dive",
        tripDate: "2024-01-15",
        tripTime: "09:00",
        participants: 2,
        total: "$150.00",
        bookingNumber: "BK123",
        shopName: "Coral Reef Divers",
      });

      expect(result.subject).toBe("Booking Confirmed - Morning Dive");
    });

    it("includes customer name in HTML", async () => {
      const { bookingConfirmationEmail } = await import("../../../../lib/email/index");

      const result = bookingConfirmationEmail({
        customerName: "Jane Smith",
        tripName: "Sunset Snorkel",
        tripDate: "2024-02-20",
        tripTime: "17:00",
        participants: 4,
        total: "$280.00",
        bookingNumber: "BK456",
        shopName: "Ocean Adventures",
      });

      expect(result.html).toContain("Jane Smith");
      expect(result.html).toContain("Sunset Snorkel");
      expect(result.html).toContain("BK456");
    });

    it("includes all booking details in text version", async () => {
      const { bookingConfirmationEmail } = await import("../../../../lib/email/index");

      const result = bookingConfirmationEmail({
        customerName: "Bob Wilson",
        tripName: "Night Dive",
        tripDate: "2024-03-10",
        tripTime: "19:00",
        participants: 1,
        total: "$95.00",
        bookingNumber: "BK789",
        shopName: "Deep Blue Diving",
      });

      expect(result.text).toContain("Bob Wilson");
      expect(result.text).toContain("Night Dive");
      expect(result.text).toContain("BK789");
      expect(result.text).toContain("$95.00");
    });
  });

  describe("bookingReminderEmail template", () => {
    it("exports bookingReminderEmail function", async () => {
      const emailModule = await import("../../../../lib/email/index");
      expect(typeof emailModule.bookingReminderEmail).toBe("function");
    });

    it("generates correct subject line", async () => {
      const { bookingReminderEmail } = await import("../../../../lib/email/index");

      const result = bookingReminderEmail({
        customerName: "Alice Brown",
        tripName: "Reef Explorer",
        tripDate: "2024-04-15",
        tripTime: "08:00",
        bookingNumber: "BK100",
        shopName: "Island Divers",
      });

      expect(result.subject).toBe("Reminder: Reef Explorer Tomorrow");
    });

    it("includes what to bring list in HTML", async () => {
      const { bookingReminderEmail } = await import("../../../../lib/email/index");

      const result = bookingReminderEmail({
        customerName: "Test User",
        tripName: "Test Trip",
        tripDate: "2024-05-01",
        tripTime: "10:00",
        bookingNumber: "BK200",
        shopName: "Test Shop",
      });

      expect(result.html).toContain("Swimsuit and towel");
      expect(result.html).toContain("Sunscreen");
      expect(result.html).toContain("Certification card");
    });
  });

  describe("welcomeEmail template", () => {
    it("exports welcomeEmail function", async () => {
      const emailModule = await import("../../../../lib/email/index");
      expect(typeof emailModule.welcomeEmail).toBe("function");
    });

    it("generates correct subject line", async () => {
      const { welcomeEmail } = await import("../../../../lib/email/index");

      const result = welcomeEmail({
        userName: "New User",
        shopName: "Dive Paradise",
        loginUrl: "https://diveparadise.divestreams.com/login",
      });

      expect(result.subject).toBe("Welcome to Dive Paradise!");
    });

    it("includes login URL in both HTML and text", async () => {
      const { welcomeEmail } = await import("../../../../lib/email/index");

      const loginUrl = "https://test.divestreams.com/login";
      const result = welcomeEmail({
        userName: "Test User",
        shopName: "Test Shop",
        loginUrl,
      });

      // HTML version has escaped URLs for security (/ becomes &#x2F;)
      expect(result.html).toContain(loginUrl.replace(/\//g, '&#x2F;'));
      // Text version also has escaped URLs (defense in depth)
      expect(result.text).toContain(loginUrl.replace(/\//g, '&#x2F;'));
    });
  });

  describe("passwordResetEmail template", () => {
    it("exports passwordResetEmail function", async () => {
      const emailModule = await import("../../../../lib/email/index");
      expect(typeof emailModule.passwordResetEmail).toBe("function");
    });

    it("generates correct subject line", async () => {
      const { passwordResetEmail } = await import("../../../../lib/email/index");

      const result = passwordResetEmail({
        userName: "Reset User",
        resetUrl: "https://divestreams.com/reset?token=abc123",
      });

      expect(result.subject).toBe("Reset Your Password");
    });

    it("includes reset URL in both versions", async () => {
      const { passwordResetEmail } = await import("../../../../lib/email/index");

      const resetUrl = "https://divestreams.com/reset?token=xyz789";
      const result = passwordResetEmail({
        userName: "Test User",
        resetUrl,
      });

      // HTML version has escaped URLs for security (/ becomes &#x2F;)
      expect(result.html).toContain(resetUrl.replace(/\//g, '&#x2F;'));
      // Text version also has escaped URLs (defense in depth)
      expect(result.text).toContain(resetUrl.replace(/\//g, '&#x2F;'));
    });

    it("mentions expiration in both versions", async () => {
      const { passwordResetEmail } = await import("../../../../lib/email/index");

      const result = passwordResetEmail({
        userName: "Test User",
        resetUrl: "https://test.com/reset",
      });

      expect(result.html).toContain("expire");
      expect(result.text).toContain("expire");
    });
  });
});
