/**
 * Email Configuration Tests [KAN-607]
 *
 * Tests email service behavior when SMTP is not configured or invalid.
 * This reproduces the bug where sendEmail() returned true even when emails weren't sent.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { sendEmail, isEmailConfigured, verifyEmailConnection } from "../../../../lib/email/index";

describe("[KAN-607] Email Service - SMTP Configuration", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("isEmailConfigured()", () => {
    test("returns false when SMTP_HOST is missing", () => {
      delete process.env.SMTP_HOST;
      process.env.SMTP_USER = "test@example.com";
      process.env.SMTP_PASS = "password";

      const configured = isEmailConfigured();

      expect(configured).toBe(false);
    });

    test("returns false when SMTP_USER is missing", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      delete process.env.SMTP_USER;
      process.env.SMTP_PASS = "password";

      const configured = isEmailConfigured();

      expect(configured).toBe(false);
    });

    test("returns false when SMTP_PASS is missing", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "test@example.com";
      delete process.env.SMTP_PASS;

      const configured = isEmailConfigured();

      expect(configured).toBe(false);
    });

    test("returns true when all SMTP credentials are present", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "test@example.com";
      process.env.SMTP_PASS = "password";

      const configured = isEmailConfigured();

      expect(configured).toBe(true);
    });
  });

  describe("sendEmail() - Production Environment", () => {
    beforeEach(() => {
      // Simulate production environment
      process.env.NODE_ENV = "production";
    });

    test("returns false when SMTP not configured in production [KAN-607 BUG]", async () => {
      // REPRODUCE BUG: SMTP not configured, should return false in production
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const result = await sendEmail({
        to: "customer@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      });

      // BUG: Used to return true even when email wasn't sent
      // FIX: Should return false in production when SMTP not configured
      expect(result).toBe(false);
    });

    test("returns false when SMTP_HOST is placeholder value", async () => {
      // Common misconfiguration: .env.example values left unchanged
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "";
      process.env.SMTP_PASS = "";

      const result = await sendEmail({
        to: "customer@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result).toBe(false);
    });
  });

  describe("sendEmail() - Development Environment", () => {
    beforeEach(() => {
      // Simulate development environment
      process.env.NODE_ENV = "development";
    });

    test("returns true in development when SMTP not configured (for testing)", async () => {
      // In development, we pretend emails sent for easier testing
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const result = await sendEmail({
        to: "customer@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      });

      // Development mode: return true to not block testing
      expect(result).toBe(true);
    });
  });

  describe("verifyEmailConnection()", () => {
    test("returns error when SMTP not configured", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const result = await verifyEmailConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing credentials");
    });

    test("returns error message explaining what's missing", async () => {
      delete process.env.SMTP_HOST;
      process.env.SMTP_USER = "test@example.com";
      process.env.SMTP_PASS = "password";

      const result = await verifyEmailConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("SMTP");
    });
  });

  describe("Real-world scenarios [KAN-607]", () => {
    test("contact form submission fails gracefully when SMTP not configured in production", async () => {
      // Simulate production
      process.env.NODE_ENV = "production";
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      // Contact form tries to send notification email
      const notificationResult = await sendEmail({
        to: "shop@example.com",
        subject: "New Contact Form Submission",
        html: "<p>Customer message...</p>",
        text: "Customer message...",
      });

      // Contact form tries to send auto-reply to customer
      const autoReplyResult = await sendEmail({
        to: "customer@example.com",
        subject: "Thank you for contacting us",
        html: "<p>We received your message...</p>",
        text: "We received your message...",
      });

      // BOTH should return false so calling code knows emails failed
      expect(notificationResult).toBe(false);
      expect(autoReplyResult).toBe(false);
    });

    test("startup verification detects misconfiguration early", async () => {
      // Common mistake: .env.example not updated
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "";
      process.env.SMTP_PASS = "";

      const verification = await verifyEmailConnection();

      expect(verification.success).toBe(false);
      expect(verification.error).toBeDefined();
    });
  });
});
