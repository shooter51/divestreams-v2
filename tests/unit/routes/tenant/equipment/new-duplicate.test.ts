import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn().mockResolvedValue({
    org: { id: "org-1", name: "Test Org", metadata: {} },
    user: { id: "user-1", role: "owner" },
  }),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../lib/db/queries.server", () => ({
  getEquipmentById: vi.fn(),
  createEquipment: vi.fn(),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn((path, msg) => `${path}?notification=${msg}`),
}));

import { getEquipmentById } from "../../../../../lib/db/queries.server";
import { loader } from "../../../../../app/routes/tenant/equipment/new";
import type { Mock } from "vitest";

const mockEquipment = {
  id: "eq-1",
  organizationId: "org-1",
  category: "tank",
  name: "Aluminum 80",
  brand: "Catalina",
  model: "S80",
  serialNumber: "SN-12345",
  barcode: "BC-67890",
  size: "M",
  gasType: "nitrox32",
  status: "available",
  condition: "good",
  isRentable: true,
  rentalPrice: 25,
  isPublic: true,
  notes: "Good tank for beginners",
  purchaseDate: "2025-01-15",
  purchasePrice: 350,
  lastServiceDate: "2025-06-01",
  nextServiceDate: "2026-06-01",
  serviceNotes: "Hydro test",
};

describe("Equipment New - Duplicate (from= query param)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns prefill data when from= param has valid equipment ID", async () => {
    (getEquipmentById as Mock).mockResolvedValue(mockEquipment);

    const request = new Request("https://demo.divestreams.com/tenant/equipment/new?from=eq-1");
    const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

    expect(getEquipmentById).toHaveBeenCalledWith("org-1", "eq-1");
    expect(result.prefill).toEqual({
      category: "tank",
      name: "Aluminum 80",
      brand: "Catalina",
      model: "S80",
      size: "M",
      gasType: "nitrox32",
      status: "available",
      condition: "good",
      isRentable: true,
      rentalPrice: "25",
      isPublic: true,
      notes: "Good tank for beginners",
    });
  });

  it("does NOT include serialNumber, barcode, or service/purchase dates in prefill", async () => {
    (getEquipmentById as Mock).mockResolvedValue(mockEquipment);

    const request = new Request("https://demo.divestreams.com/tenant/equipment/new?from=eq-1");
    const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

    const prefill = result.prefill!;
    expect(prefill).not.toHaveProperty("serialNumber");
    expect(prefill).not.toHaveProperty("barcode");
    expect(prefill).not.toHaveProperty("purchaseDate");
    expect(prefill).not.toHaveProperty("purchasePrice");
    expect(prefill).not.toHaveProperty("lastServiceDate");
    expect(prefill).not.toHaveProperty("nextServiceDate");
    expect(prefill).not.toHaveProperty("serviceNotes");
  });

  it("returns null prefill when no from= param", async () => {
    const request = new Request("https://demo.divestreams.com/tenant/equipment/new");
    const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

    expect(getEquipmentById).not.toHaveBeenCalled();
    expect(result.prefill).toBeNull();
  });

  it("returns null prefill when from= references non-existent equipment", async () => {
    (getEquipmentById as Mock).mockResolvedValue(null);

    const request = new Request("https://demo.divestreams.com/tenant/equipment/new?from=nonexistent");
    const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

    expect(getEquipmentById).toHaveBeenCalledWith("org-1", "nonexistent");
    expect(result.prefill).toBeNull();
  });

  it("handles equipment with null optional fields", async () => {
    (getEquipmentById as Mock).mockResolvedValue({
      ...mockEquipment,
      brand: null,
      model: null,
      size: null,
      gasType: null,
      notes: null,
      rentalPrice: null,
    });

    const request = new Request("https://demo.divestreams.com/tenant/equipment/new?from=eq-1");
    const result = await loader({ request, params: {}, context: {} } as Parameters<typeof loader>[0]);

    expect(result.prefill).toEqual({
      category: "tank",
      name: "Aluminum 80",
      brand: "",
      model: "",
      size: "",
      gasType: "",
      status: "available",
      condition: "good",
      isRentable: true,
      rentalPrice: "",
      isPublic: true,
      notes: "",
    });
  });
});
