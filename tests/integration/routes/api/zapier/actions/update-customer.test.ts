import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { action } from "../../../../../../app/routes/api/zapier/actions/update-customer";

/**
 * Integration tests for api/zapier/actions/update-customer route
 * Tests Zapier customer update functionality
 */

// Mock Zapier validation
vi.mock("../../../../../../lib/integrations/zapier-enhanced.server", () => ({
  validateZapierApiKey: vi.fn(),
}));

// Mock database
vi.mock("../../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { validateZapierApiKey } from "../../../../../../lib/integrations/zapier-enhanced.server";
import { db } from "../../../../../../lib/db";

describe("api/zapier/actions/update-customer route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/zapier/actions/update-customer", () => {
    it("returns 405 for non-POST requests", async () => {
      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "GET",
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(405);

      const data = await response.json();
      expect(data.error).toBe("Method not allowed");
    });

    it("returns 401 when X-API-Key header is missing", async () => {
      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Missing API key. Provide X-API-Key header.");
    });

    it("returns 401 when API key is invalid", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue(null);

      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: { "x-api-key": "invalid-key" },
        body: JSON.stringify({ email: "test@example.com" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Invalid API key");
    });

    it("returns 400 when email is missing", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({ first_name: "John" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Missing required field: email");
    });

    it("returns 404 when customer not found", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      // Mock customer query (not found)
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({ email: "nonexistent@example.com" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe("Customer not found with this email");
    });

    it("updates customer and returns updated data", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      // Mock customer query (found)
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: "cust-1",
          email: "existing@example.com",
          firstName: "Old",
          lastName: "Name",
          certifications: [],
        }]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      // Mock update
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "cust-1",
          email: "existing@example.com",
          firstName: "John",
          lastName: "Doe",
          phone: "+1234567890",
          updatedAt: new Date("2024-01-15T10:00:00Z"),
        }]),
      };
      (db.update as Mock).mockReturnValue(mockUpdate);

      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          email: "existing@example.com",
          first_name: "John",
          last_name: "Doe",
          phone: "+1234567890",
        }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe("cust-1");
      expect(data.email).toBe("existing@example.com");
      expect(data.first_name).toBe("John");
      expect(data.last_name).toBe("Doe");
      expect(data.phone).toBe("+1234567890");
      expect(data.updated_at).toBeDefined();
    });

    it("updates emergency contact information", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: "cust-1",
          email: "test@example.com",
          certifications: [],
        }]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const updateSpy = vi.fn().mockReturnThis();
      const mockUpdate = {
        set: updateSpy,
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "cust-1",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          phone: null,
          updatedAt: new Date(),
        }]),
      };
      (db.update as Mock).mockReturnValue(mockUpdate);

      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          email: "test@example.com",
          emergency_contact: "Jane Doe",
          emergency_phone: "+0987654321",
        }),
      });
      await action({ request, params: {}, context: {} } as any);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          emergencyContactName: "Jane Doe",
          emergencyContactPhone: "+0987654321",
          updatedAt: expect.any(Date),
        })
      );
    });

    it("adds certification to customer", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: "cust-1",
          email: "diver@example.com",
          certifications: [{ agency: "PADI", level: "Open Water" }],
        }]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const updateSpy = vi.fn().mockReturnThis();
      const mockUpdate = {
        set: updateSpy,
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "cust-1",
          email: "diver@example.com",
          firstName: "Test",
          lastName: "Diver",
          phone: null,
          updatedAt: new Date(),
        }]),
      };
      (db.update as Mock).mockReturnValue(mockUpdate);

      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          email: "diver@example.com",
          certification_level: "Advanced Open Water",
        }),
      });
      await action({ request, params: {}, context: {} } as any);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          certifications: expect.arrayContaining([
            { agency: "PADI", level: "Open Water" },
            { agency: "Unknown", level: "Advanced Open Water" },
          ]),
          updatedAt: expect.any(Date),
        })
      );
    });

    it("updates customer notes", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: "cust-1",
          email: "test@example.com",
          certifications: [],
        }]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const updateSpy = vi.fn().mockReturnThis();
      const mockUpdate = {
        set: updateSpy,
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "cust-1",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          phone: null,
          updatedAt: new Date(),
        }]),
      };
      (db.update as Mock).mockReturnValue(mockUpdate);

      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          email: "test@example.com",
          notes: "VIP customer - prefers morning dives",
        }),
      });
      await action({ request, params: {}, context: {} } as any);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: "VIP customer - prefers morning dives",
          updatedAt: expect.any(Date),
        })
      );
    });

    it("only updates provided fields", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: "cust-1",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
          certifications: [],
        }]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const updateSpy = vi.fn().mockReturnThis();
      const mockUpdate = {
        set: updateSpy,
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "cust-1",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
          phone: "+1111111111",
          updatedAt: new Date(),
        }]),
      };
      (db.update as Mock).mockReturnValue(mockUpdate);

      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          email: "test@example.com",
          phone: "+1111111111",
        }),
      });
      await action({ request, params: {}, context: {} } as any);

      const updateCall = updateSpy.mock.calls[0][0];
      expect(updateCall.phone).toBe("+1111111111");
      expect(updateCall.firstName).toBeUndefined();
      expect(updateCall.lastName).toBeUndefined();
      expect(updateCall.updatedAt).toBeDefined();
    });

    it("returns 500 on database error", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error("Database connection lost")),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const request = new Request("https://divestreams.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({ email: "test@example.com", first_name: "Test" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe("Database connection lost");
    });
  });
});
