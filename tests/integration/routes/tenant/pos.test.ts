import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/pos";

// Mock the org-context module
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireTenant: vi.fn(),
}));

// Mock the tenant database module
vi.mock("../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

// Mock the POS server functions
vi.mock("../../../../lib/db/pos.server", () => ({
  getPOSProducts: vi.fn(),
  getPOSEquipment: vi.fn(),
  getPOSTrips: vi.fn(),
  searchPOSCustomers: vi.fn(),
  processPOSCheckout: vi.fn(),
  generateAgreementNumber: vi.fn(),
  getProductByBarcode: vi.fn(),
}));

import { requireTenant } from "../../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import {
  getPOSProducts,
  getPOSEquipment,
  getPOSTrips,
  searchPOSCustomers,
  processPOSCheckout,
  generateAgreementNumber,
  getProductByBarcode,
} from "../../../../lib/db/pos.server";

describe("tenant/pos route", () => {
  const mockTenantContext = {
    tenant: { id: "tenant-1", name: "Demo Dive Shop", schemaName: "tenant_demo" },
    organizationId: "org-uuid",
  };

  const mockTenantDb = {
    schema: { products: {}, equipment: {}, trips: {}, customers: {} },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireTenant as Mock).mockResolvedValue(mockTenantContext);
    (getTenantDb as Mock).mockReturnValue(mockTenantDb);
  });

  describe("loader", () => {
    it("requires tenant context", async () => {
      (getPOSProducts as Mock).mockResolvedValue([]);
      (getPOSEquipment as Mock).mockResolvedValue([]);
      (getPOSTrips as Mock).mockResolvedValue([]);
      (generateAgreementNumber as Mock).mockResolvedValue("RA-2024-0001");

      const request = new Request("https://demo.divestreams.com/app/pos");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireTenant).toHaveBeenCalledWith(request);
    });

    it("fetches products, equipment, and trips", async () => {
      (getPOSProducts as Mock).mockResolvedValue([]);
      (getPOSEquipment as Mock).mockResolvedValue([]);
      (getPOSTrips as Mock).mockResolvedValue([]);
      (generateAgreementNumber as Mock).mockResolvedValue("RA-2024-0001");

      const request = new Request("https://demo.divestreams.com/app/pos");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(getPOSProducts).toHaveBeenCalled();
      expect(getPOSEquipment).toHaveBeenCalled();
      expect(getPOSTrips).toHaveBeenCalled();
    });

    it("returns POS data", async () => {
      const mockProducts = [
        { id: "p1", name: "Mask", price: "50.00", category: "gear" },
      ];
      const mockEquipment = [
        { id: "e1", name: "BCD Rental", rentalPrice: "25.00", category: "rental" },
      ];
      const mockTrips = [
        { id: "t1", tour: { name: "Morning Dive", price: "99.00" } },
      ];

      (getPOSProducts as Mock).mockResolvedValue(mockProducts);
      (getPOSEquipment as Mock).mockResolvedValue(mockEquipment);
      (getPOSTrips as Mock).mockResolvedValue(mockTrips);
      (generateAgreementNumber as Mock).mockResolvedValue("RA-2024-0001");

      const request = new Request("https://demo.divestreams.com/app/pos");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.products).toEqual(mockProducts);
      expect(result.equipment).toEqual(mockEquipment);
      expect(result.trips).toEqual(mockTrips);
      expect(result.tenant).toBeDefined();
      expect(result.agreementNumber).toBe("RA-2024-0001");
    });

    it("handles agreement number generation error gracefully", async () => {
      (getPOSProducts as Mock).mockResolvedValue([]);
      (getPOSEquipment as Mock).mockResolvedValue([]);
      (getPOSTrips as Mock).mockResolvedValue([]);
      (generateAgreementNumber as Mock).mockRejectedValue(new Error("Table not found"));

      const request = new Request("https://demo.divestreams.com/app/pos");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      // Should use default agreement number pattern
      expect(result.agreementNumber).toMatch(/^RA-\d{4}-0001$/);
    });
  });

  describe("action", () => {
    describe("search-customers intent", () => {
      it("searches customers by query", async () => {
        const mockCustomers = [
          { id: "c1", firstName: "John", lastName: "Doe", email: "john@example.com" },
        ];
        (searchPOSCustomers as Mock).mockResolvedValue(mockCustomers);

        const formData = new FormData();
        formData.append("intent", "search-customers");
        formData.append("query", "john");

        const request = new Request("https://demo.divestreams.com/app/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(searchPOSCustomers).toHaveBeenCalledWith(
          mockTenantDb.schema,
          "org-uuid",
          "john"
        );
        expect(result).toEqual({ customers: mockCustomers });
      });
    });

    describe("scan-barcode intent", () => {
      it("returns scanned product when found", async () => {
        const mockProduct = {
          id: "p1",
          name: "Diving Mask",
          price: "50.00",
          stockQuantity: 10,
        };
        (getProductByBarcode as Mock).mockResolvedValue(mockProduct);

        const formData = new FormData();
        formData.append("intent", "scan-barcode");
        formData.append("barcode", "123456789");

        const request = new Request("https://demo.divestreams.com/app/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(getProductByBarcode).toHaveBeenCalledWith(
          mockTenantDb.schema,
          "org-uuid",
          "123456789"
        );
        expect(result).toMatchObject({
          scannedProduct: {
            id: "p1",
            name: "Diving Mask",
            price: "50.00",
            stockQuantity: 10,
          },
        });
      });

      it("returns not found when barcode does not exist", async () => {
        (getProductByBarcode as Mock).mockResolvedValue(null);

        const formData = new FormData();
        formData.append("intent", "scan-barcode");
        formData.append("barcode", "nonexistent");

        const request = new Request("https://demo.divestreams.com/app/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toMatchObject({
          barcodeNotFound: true,
          scannedBarcode: "nonexistent",
        });
      });
    });

    describe("checkout intent", () => {
      it("processes checkout successfully", async () => {
        (processPOSCheckout as Mock).mockResolvedValue({ receiptNumber: "R-0001" });

        const checkoutData = {
          items: [{ type: "product", productId: "p1", quantity: 2 }],
          customerId: "c1",
          userId: null,
          payments: [{ method: "card", amount: 100 }],
          subtotal: 100,
          tax: 0,
          total: 100,
          notes: "",
        };

        const formData = new FormData();
        formData.append("intent", "checkout");
        formData.append("data", JSON.stringify(checkoutData));

        const request = new Request("https://demo.divestreams.com/app/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(processPOSCheckout).toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          receiptNumber: "R-0001",
        });
      });

      it("returns error when checkout fails", async () => {
        (processPOSCheckout as Mock).mockRejectedValue(new Error("Insufficient stock"));

        const checkoutData = {
          items: [{ type: "product", productId: "p1", quantity: 100 }],
          payments: [{ method: "cash", amount: 5000 }],
          subtotal: 5000,
          tax: 0,
          total: 5000,
        };

        const formData = new FormData();
        formData.append("intent", "checkout");
        formData.append("data", JSON.stringify(checkoutData));

        const request = new Request("https://demo.divestreams.com/app/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Insufficient stock" });
      });

      it("returns generic error for non-Error exceptions", async () => {
        (processPOSCheckout as Mock).mockRejectedValue("Unknown error");

        const checkoutData = {
          items: [],
          payments: [],
          subtotal: 0,
          tax: 0,
          total: 0,
        };

        const formData = new FormData();
        formData.append("intent", "checkout");
        formData.append("data", JSON.stringify(checkoutData));

        const request = new Request("https://demo.divestreams.com/app/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Checkout failed" });
      });
    });

    it("returns error for invalid intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/app/pos", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Invalid intent" });
    });
  });
});
