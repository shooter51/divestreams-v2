/**
 * Site Contact Route Tests
 *
 * Tests the contact form action with validation, rate limiting, and email sending.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../app/routes/site/contact";

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    insert: vi.fn(),
  },
}));

// Mock email
vi.mock("../../../../lib/email", () => ({
  sendEmail: vi.fn(),
  contactFormNotificationEmail: vi.fn(),
  contactFormAutoReplyEmail: vi.fn(),
}));

// Mock rate limit
vi.mock("../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

// Import mocked modules
import { db } from "../../../../lib/db";
import { sendEmail, contactFormNotificationEmail, contactFormAutoReplyEmail } from "../../../../lib/email";
import { checkRateLimit, getClientIp } from "../../../../lib/utils/rate-limit";

describe("Route: site/contact.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getClientIp as any).mockReturnValue("127.0.0.1");
    (checkRateLimit as any).mockReturnValue({ allowed: true });
    (contactFormNotificationEmail as any).mockReturnValue({
      subject: "New Contact Form Submission",
      html: "<p>Email content</p>",
      text: "Email content",
    });
    (contactFormAutoReplyEmail as any).mockReturnValue({
      subject: "Thank you for contacting us",
      html: "<p>Auto-reply content</p>",
      text: "Auto-reply content",
    });
  });

  const mockContext = {
    organization: {
      id: "org-123",
      name: "Demo Dive Shop",
      email: "admin@example.com",
    },
    contactInfo: {
      email: "contact@example.com",
      phone: "+1234567890",
      address: "123 Ocean Drive",
    },
  };

  describe("action", () => {
    it("should return success when honeypot is triggered", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("message", "This is a test message");
      formData.append("website", "https://spam.com"); // Honeypot
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result).toEqual({ success: true });
      expect(db.insert).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("should return error when rate limit exceeded", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;
      (checkRateLimit as any).mockReturnValue({
        allowed: false,
        resetAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Too many submissions");
      expect(result.error).toContain("10 minutes");
    });

    it("should return error when name is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "");
      formData.append("email", "john@example.com");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors?.name).toBe("Name must be at least 2 characters");
    });

    it("should return error when name is too short", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "J");
      formData.append("email", "john@example.com");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors?.name).toBe("Name must be at least 2 characters");
    });

    it("should return error when email is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors?.email).toBe("Please enter a valid email address");
    });

    it("should return error when email is invalid", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "invalid-email");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors?.email).toBe("Please enter a valid email address");
    });

    it("should return error when message is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("message", "");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors?.message).toBe("Message must be at least 10 characters");
    });

    it("should return error when message is too short", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("message", "Short");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors?.message).toBe("Message must be at least 10 characters");
    });

    it("should return error when message is too long", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("message", "a".repeat(5001));
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors?.message).toBe("Message must be less than 5000 characters");
    });

    it("should return error when phone format is invalid", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("phone", "invalid-phone!!!");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors?.phone).toBe("Please enter a valid phone number");
    });

    it("should return error when organization not in context", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unable to process your request. Please try again later.");
    });

    it("should successfully submit contact form", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("phone", "+1234567890");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => {
            if (name === "referer") return "https://example.com/about";
            if (name === "user-agent") return "Mozilla/5.0";
            return null;
          },
        },
      } as Request;
      const mockValues = vi.fn().mockResolvedValue(undefined);
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });
      (sendEmail as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(getClientIp).toHaveBeenCalledWith(request);
      expect(checkRateLimit).toHaveBeenCalledWith("contact-form:127.0.0.1", {
        maxAttempts: 5,
        windowMs: 900000,
      });
      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        organizationId: "org-123",
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        subject: null,
        message: "This is a test message",
        referrerPage: "https://example.com/about",
        userAgent: "Mozilla/5.0",
        ipAddress: "127.0.0.1",
        status: "new",
      });
      expect(sendEmail).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it("should handle submission without optional phone", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;
      const mockValues = vi.fn().mockResolvedValue(undefined);
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });
      (sendEmail as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(mockValues).toHaveBeenCalledWith({
        organizationId: "org-123",
        name: "John Doe",
        email: "john@example.com",
        phone: null,
        subject: null,
        message: "This is a test message",
        referrerPage: undefined,
        userAgent: undefined,
        ipAddress: "127.0.0.1",
        status: "new",
      });
      expect(result).toEqual({ success: true });
    });

    it("should return error when database insert fails", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;
      const mockValues = vi.fn().mockRejectedValue(new Error("Database error"));
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to send your message. Please try again later.");
    });

    it("should return error when email sending fails", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("message", "This is a test message");
      const request = {
        formData: () => Promise.resolve(formData),
        headers: {
          get: () => null,
        },
      } as Request;
      const mockValues = vi.fn().mockResolvedValue(undefined);
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });
      (sendEmail as any).mockRejectedValue(new Error("Email error"));

      // Act
      const result = await action({ request, params: {}, context: mockContext });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to send your message. Please try again later.");
    });
  });
});
