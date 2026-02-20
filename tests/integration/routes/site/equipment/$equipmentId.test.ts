import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../../lib/db/schema", () => ({
  equipment: {
    id: "id",
    organizationId: "organizationId",
    category: "category",
    name: "name",
    brand: "brand",
    model: "model",
    serialNumber: "serialNumber",
    size: "size",
    rentalPrice: "rentalPrice",
    isRentable: "isRentable",
    isPublic: "isPublic",
    status: "status",
    condition: "condition",
    lastServiceDate: "lastServiceDate",
    nextServiceDate: "nextServiceDate",
    serviceNotes: "serviceNotes",
    notes: "notes",
  },
  images: {
    id: "id",
    url: "url",
    thumbnailUrl: "thumbnailUrl",
    alt: "alt",
    isPrimary: "isPrimary",
    sortOrder: "sortOrder",
    organizationId: "organizationId",
    entityType: "entityType",
    entityId: "entityId",
  },
  organization: {
    id: "id",
    slug: "slug",
    customDomain: "customDomain",
    name: "name",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
}));

import { db } from "../../../../../lib/db";
import { loader } from "../../../../../app/routes/site/equipment/$equipmentId";

describe("site/equipment/$equipmentId route", () => {
  const mockOrg = { id: "org-1", name: "Demo Dive Shop", slug: "demo" };
  const mockEquipment = {
    id: "eq-1",
    category: "bcd",
    name: "Aqualung Pro HD",
    brand: "Aqualung",
    model: "Pro HD",
    serialNumber: "SN-12345",
    size: "L",
    rentalPrice: "25.00",
    isRentable: true,
    isPublic: true,
    status: "available",
    condition: "excellent",
    lastServiceDate: "2025-01-15",
    nextServiceDate: "2025-07-15",
    serviceNotes: "Fully serviced",
    notes: "Premium BCD",
    organizationId: "org-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("throws 400 when equipmentId param is missing", async () => {
      const request = new Request("https://demo.divestreams.com/site/equipment/");
      try {
        await loader({
          request,
          params: {},
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
      }
    });

    it("throws 404 when organization is not found", async () => {
      (db.limit as Mock).mockResolvedValueOnce([]);

      const request = new Request("https://unknown.divestreams.com/site/equipment/eq-1");
      try {
        await loader({
          request,
          params: { equipmentId: "eq-1" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("throws 404 when equipment is not found", async () => {
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg])
        .mockResolvedValueOnce([]);

      const request = new Request("https://demo.divestreams.com/site/equipment/nonexistent");
      try {
        await loader({
          request,
          params: { equipmentId: "nonexistent" },
          context: {},
        } as Parameters<typeof loader>[0]);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });

    it("returns equipment detail and images when found", async () => {
      const mockImages = [
        { id: "img-1", url: "https://cdn.example.com/bcd.jpg", thumbnailUrl: null, alt: "BCD front", isPrimary: true, sortOrder: 0 },
        { id: "img-2", url: "https://cdn.example.com/bcd-2.jpg", thumbnailUrl: "https://cdn.example.com/bcd-2-thumb.jpg", alt: "BCD side", isPrimary: false, sortOrder: 1 },
      ];

      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg])
        .mockResolvedValueOnce([mockEquipment]);
      (db.orderBy as Mock).mockResolvedValue(mockImages);

      const request = new Request("https://demo.divestreams.com/site/equipment/eq-1");
      const result = await loader({
        request,
        params: { equipmentId: "eq-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.equipment.id).toBe("eq-1");
      expect(result.equipment.name).toBe("Aqualung Pro HD");
      expect(result.equipment.brand).toBe("Aqualung");
      expect(result.equipment.model).toBe("Pro HD");
      expect(result.equipment.rentalPrice).toBe("25.00");
      expect(result.equipment.isRentable).toBe(true);
      expect(result.equipment.status).toBe("available");
      expect(result.equipment.condition).toBe("excellent");
      expect(result.images).toHaveLength(2);
      expect(result.images[0].isPrimary).toBe(true);
      expect(result.organizationName).toBe("Demo Dive Shop");
      expect(result.organizationId).toBe("org-1");
    });

    it("returns empty images array when no images exist", async () => {
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg])
        .mockResolvedValueOnce([mockEquipment]);
      (db.orderBy as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/site/equipment/eq-1");
      const result = await loader({
        request,
        params: { equipmentId: "eq-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.equipment.id).toBe("eq-1");
      expect(result.images).toEqual([]);
      expect(result.organizationName).toBe("Demo Dive Shop");
    });

    it("handles custom domain fallback when no subdomain is present", async () => {
      (db.limit as Mock)
        .mockResolvedValueOnce([mockOrg])
        .mockResolvedValueOnce([mockEquipment]);
      (db.orderBy as Mock).mockResolvedValue([]);

      const request = new Request("https://customdomain.com/site/equipment/eq-1");
      const result = await loader({
        request,
        params: { equipmentId: "eq-1" },
        context: {},
      } as Parameters<typeof loader>[0]);

      expect(result.equipment.id).toBe("eq-1");
      expect(result.organizationName).toBe("Demo Dive Shop");
      expect(result.organizationId).toBe("org-1");
    });
  });
});
