/**
 * Email Server Functions Tests
 *
 * Tests for server-side email sending functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock nodemailer
const mockVerify = vi.fn();
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-message-id" });
const mockCreateTransport = vi.fn().mockReturnValue({
  sendMail: mockSendMail,
  verify: mockVerify,
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport,
  },
  createTransport: mockCreateTransport,
}));

describe("Email Server", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    // Set default SMTP config for tests
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "password123";
    process.env.SMTP_FROM = "noreply@divestreams.com";
    process.env.SMTP_FROM_NAME = "DiveStreams";
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  describe("isEmailConfigured", () => {
    it("should return true when all SMTP credentials are set", async () => {
      vi.resetModules();
      const { isEmailConfigured } = await import("../../../../lib/email/email.server");
      expect(isEmailConfigured()).toBe(true);
    });

    it("should return false when SMTP_HOST is missing", async () => {
      delete process.env.SMTP_HOST;
      vi.resetModules();
      const { isEmailConfigured } = await import("../../../../lib/email/email.server");
      expect(isEmailConfigured()).toBe(false);
    });

    it("should return false when SMTP_USER is missing", async () => {
      delete process.env.SMTP_USER;
      vi.resetModules();
      const { isEmailConfigured } = await import("../../../../lib/email/email.server");
      expect(isEmailConfigured()).toBe(false);
    });

    it("should return false when SMTP_PASS is missing", async () => {
      delete process.env.SMTP_PASS;
      vi.resetModules();
      const { isEmailConfigured } = await import("../../../../lib/email/email.server");
      expect(isEmailConfigured()).toBe(false);
    });

    it("should return false when all credentials are missing", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      vi.resetModules();
      const { isEmailConfigured } = await import("../../../../lib/email/email.server");
      expect(isEmailConfigured()).toBe(false);
    });
  });

  describe("sendEmail", () => {
    it("should send email successfully when configured", async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: "success-123" });
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      const result = await sendEmail({
        to: "recipient@example.com",
        subject: "Test Email",
        html: "<p>Test body</p>",
        text: "Test body",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("success-123");
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it("should include all email fields in sendMail call", async () => {
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Subject Line",
        html: "<p>HTML content</p>",
        text: "Plain text content",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: "Subject Line",
          html: "<p>HTML content</p>",
          text: "Plain text content",
        })
      );
    });

    it("should use configured FROM address", async () => {
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"DiveStreams" <noreply@divestreams.com>',
        })
      );
    });

    it("should include replyTo if provided", async () => {
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        replyTo: "support@example.com",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: "support@example.com",
        })
      );
    });

    it("should return dev message ID when SMTP not configured", async () => {
      delete process.env.SMTP_HOST;
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-/);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should handle sendMail errors gracefully", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP connection failed"));
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("SMTP connection failed");
    });

    it("should handle non-Error exceptions", async () => {
      mockSendMail.mockRejectedValueOnce("String error");
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  describe("verifyEmailConnection", () => {
    it("should return true when connection is successful", async () => {
      mockVerify.mockResolvedValueOnce(true);
      vi.resetModules();
      const { verifyEmailConnection } = await import("../../../../lib/email/email.server");

      const result = await verifyEmailConnection();

      expect(result).toBe(true);
      expect(mockVerify).toHaveBeenCalledTimes(1);
    });

    it("should return false when SMTP not configured", async () => {
      delete process.env.SMTP_HOST;
      vi.resetModules();
      const { verifyEmailConnection } = await import("../../../../lib/email/email.server");

      const result = await verifyEmailConnection();

      expect(result).toBe(false);
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it("should return false when verification fails", async () => {
      mockVerify.mockRejectedValueOnce(new Error("Connection refused"));
      vi.resetModules();
      const { verifyEmailConnection } = await import("../../../../lib/email/email.server");

      const result = await verifyEmailConnection();

      expect(result).toBe(false);
      expect(mockVerify).toHaveBeenCalledTimes(1);
    });

    it("should handle verification errors gracefully", async () => {
      mockVerify.mockRejectedValueOnce(new Error("Invalid credentials"));
      vi.resetModules();
      const { verifyEmailConnection } = await import("../../../../lib/email/email.server");

      const result = await verifyEmailConnection();

      expect(result).toBe(false);
    });
  });

  describe("SMTP configuration", () => {
    it("should use port 465 for secure connection", async () => {
      process.env.SMTP_PORT = "465";
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 465,
          secure: true,
        })
      );
    });

    it("should use port 587 for non-secure connection", async () => {
      process.env.SMTP_PORT = "587";
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 587,
          secure: false,
        })
      );
    });

    it("should default to port 587 if not specified", async () => {
      delete process.env.SMTP_PORT;
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 587,
        })
      );
    });

    it("should use configured SMTP credentials", async () => {
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "smtp.example.com",
          auth: {
            user: "user@example.com",
            pass: "password123",
          },
        })
      );
    });

    it("should use default FROM address if not configured", async () => {
      delete process.env.SMTP_FROM;
      delete process.env.SMTP_FROM_NAME;
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"DiveStreams" <noreply@divestreams.com>',
        })
      );
    });

    it("should use custom FROM address if configured", async () => {
      process.env.SMTP_FROM = "custom@example.com";
      process.env.SMTP_FROM_NAME = "Custom Name";
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Custom Name" <custom@example.com>',
        })
      );
    });
  });

  describe("transporter caching", () => {
    it("should reuse transporter for multiple emails", async () => {
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test1@example.com",
        subject: "Test 1",
        html: "<p>Test 1</p>",
      });

      await sendEmail({
        to: "test2@example.com",
        subject: "Test 2",
        html: "<p>Test 2</p>",
      });

      // Transport should only be created once
      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe("email content handling", () => {
    it("should send HTML-only email", async () => {
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>HTML only</p>",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "<p>HTML only</p>",
        })
      );
    });

    it("should send text fallback when provided", async () => {
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>HTML version</p>",
        text: "Plain text version",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "<p>HTML version</p>",
          text: "Plain text version",
        })
      );
    });

    it("should handle special characters in subject", async () => {
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test: Special chars & symbols <test>",
        html: "<p>Test</p>",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Test: Special chars & symbols <test>",
        })
      );
    });

    it("should handle UTF-8 characters", async () => {
      vi.resetModules();
      const { sendEmail } = await import("../../../../lib/email/email.server");

      await sendEmail({
        to: "test@example.com",
        subject: "Test: Café ☕ 日本語",
        html: "<p>UTF-8 content: Café ☕ 日本語</p>",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Test: Café ☕ 日本語",
          html: "<p>UTF-8 content: Café ☕ 日本語</p>",
        })
      );
    });
  });
});
