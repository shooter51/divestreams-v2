/**
 * Tenant POS (Point of Sale) Route Tests
 *
 * Tests loader and action intents for POS functionality.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/pos";

// Mock org context
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

// Mock tenant db
vi.mock("../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

// Mock POS functions
vi.mock("../../../../lib/db/pos.server", () => ({
  getPOSProducts: vi.fn(),
  getPOSEquipment: vi.fn(),
  getPOSTrips: vi.fn(),
  searchPOSCustomers: vi.fn(),
  processPOSCheckout: vi.fn(),
  generateAgreementNumber: vi.fn(),
  getProductByBarcode: vi.fn(),
}));

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock Stripe functions
vi.mock("../../../../lib/integrations/stripe.server", () => ({
  getStripeSettings: vi.fn(),
  getStripePublishableKey: vi.fn(),
  createPOSPaymentIntent: vi.fn(),
  createTerminalConnectionToken: vi.fn(),
  listTerminalReaders: vi.fn(),
}));

// Import mocked modules
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
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
import { db } from "../../../../lib/db";
import {
  getStripeSettings,
  getStripePublishableKey,
  createPOSPaymentIntent,
  createTerminalConnectionToken,
  listTerminalReaders,
} from "../../../../lib/integrations/stripe.server";

describe("Route: tenant/pos.tsx", () => {
  const mockTenantDb = {
    schema: {
      products: {},
      equipment: {},
      trips: {},
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup
    (requireOrgContext as any).mockResolvedValue({
      org: {
        id: "org-123",
        name: "Dive Shop ABC",
        slug: "diveshop",
      },
      user: {
        id: "user-123",
      },
    });

    (getTenantDb as any).mockReturnValue(mockTenantDb);
  });

  describe("loader", () => {
    it("should load POS data with products, equipment, and trips", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/pos");

      const mockProducts = [
        { id: "prod-1", name: "Mask", price: "50.00" },
        { id: "prod-2", name: "Fins", price: "75.00" },
      ];
      const mockEquipment = [
        { id: "eq-1", name: "BCD", rentalPrice: "25.00" },
      ];
      const mockTrips = [
        { id: "trip-1", tour: { name: "Reef Tour", price: "100.00" } },
      ];

      (getPOSProducts as any).mockResolvedValue(mockProducts);
      (getPOSEquipment as any).mockResolvedValue(mockEquipment);
      (getPOSTrips as any).mockResolvedValue(mockTrips);
      (generateAgreementNumber as any).mockResolvedValue("RA-2024-0042");

      // Mock organization settings - tax rate
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ taxRate: "7.5" }]),
          }),
        }),
      });

      // Mock Stripe settings
      (getStripeSettings as any).mockResolvedValue({
        connected: true,
        chargesEnabled: true,
      });
      (getStripePublishableKey as any).mockResolvedValue("pk_test_123");
      (listTerminalReaders as any).mockResolvedValue([
        { id: "reader-1", label: "Front Desk" },
      ]);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.tenant.name).toBe("Dive Shop ABC");
      expect(result.tenant.subdomain).toBe("diveshop");
      expect(result.products).toEqual(mockProducts);
      expect(result.equipment).toEqual(mockEquipment);
      expect(result.trips).toEqual(mockTrips);
      expect(result.agreementNumber).toBe("RA-2024-0042");
      expect(result.taxRate).toBe(7.5);
      expect(result.stripeConnected).toBe(true);
      expect(result.stripePublishableKey).toBe("pk_test_123");
      expect(result.hasTerminalReaders).toBe(true);
      expect(result.terminalReaders).toHaveLength(1);
    });

    it("should default to 0 tax rate if no settings", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/pos");

      (getPOSProducts as any).mockResolvedValue([]);
      (getPOSEquipment as any).mockResolvedValue([]);
      (getPOSTrips as any).mockResolvedValue([]);
      (generateAgreementNumber as any).mockResolvedValue("RA-2024-0001");

      // No settings found
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      (getStripeSettings as any).mockResolvedValue(null);
      (getStripePublishableKey as any).mockResolvedValue(null);
      (listTerminalReaders as any).mockResolvedValue([]);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.taxRate).toBe(0);
    });

    it("should handle agreement number generation error", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/pos");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      (getPOSProducts as any).mockResolvedValue([]);
      (getPOSEquipment as any).mockResolvedValue([]);
      (getPOSTrips as any).mockResolvedValue([]);
      (generateAgreementNumber as any).mockRejectedValue(
        new Error("Rentals table does not exist")
      );

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      (getStripeSettings as any).mockResolvedValue(null);
      (getStripePublishableKey as any).mockResolvedValue(null);
      (listTerminalReaders as any).mockResolvedValue([]);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      // Should use default format when generation fails
      expect(result.agreementNumber).toMatch(/^RA-\d{4}-0001$/);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Could not generate agreement number:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should mark Stripe as not connected if chargesEnabled is false", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/pos");

      (getPOSProducts as any).mockResolvedValue([]);
      (getPOSEquipment as any).mockResolvedValue([]);
      (getPOSTrips as any).mockResolvedValue([]);
      (generateAgreementNumber as any).mockResolvedValue("RA-2024-0001");

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Stripe connected but charges disabled
      (getStripeSettings as any).mockResolvedValue({
        connected: true,
        chargesEnabled: false,
      });
      (getStripePublishableKey as any).mockResolvedValue("pk_test_123");
      (listTerminalReaders as any).mockResolvedValue([]);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.stripeConnected).toBe(false);
      expect(result.stripePublishableKey).toBe(null);
    });
  });

  describe("action - search-customers", () => {
    it("should search and return customers", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "search-customers");
      formData.append("query", "john");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockCustomers = [
        {
          id: "cust-1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "555-1234",
        },
        {
          id: "cust-2",
          firstName: "Johnny",
          lastName: "Smith",
          email: "johnny@example.com",
          phone: null,
        },
      ];

      (searchPOSCustomers as any).mockResolvedValue(mockCustomers);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.customers).toEqual(mockCustomers);
      expect(searchPOSCustomers).toHaveBeenCalledWith(
        mockTenantDb.schema,
        "org-123",
        "john"
      );
    });
  });

  describe("action - create-payment-intent", () => {
    it("should create payment intent successfully", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create-payment-intent");
      formData.append("amount", "10000"); // $100.00 in cents
      formData.append("customerId", "cust-123");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (createPOSPaymentIntent as any).mockResolvedValue({
        clientSecret: "pi_secret_123",
        paymentIntentId: "pi_123",
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.clientSecret).toBe("pi_secret_123");
      expect(result.paymentIntentId).toBe("pi_123");
      expect(createPOSPaymentIntent).toHaveBeenCalledWith("org-123", 10000, {
        customerId: "cust-123",
      });
    });

    it("should return error for invalid amount (zero)", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create-payment-intent");
      formData.append("amount", "0");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("Invalid payment amount");
      expect(createPOSPaymentIntent).not.toHaveBeenCalled();
    });

    it("should return error for negative amount", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create-payment-intent");
      formData.append("amount", "-500");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("Invalid payment amount");
    });

    it("should return error if Stripe not connected", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create-payment-intent");
      formData.append("amount", "5000");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (createPOSPaymentIntent as any).mockResolvedValue(null);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("Stripe not connected. Please connect Stripe in Settings → Integrations.");
    });

    it("should handle payment intent creation error", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create-payment-intent");
      formData.append("amount", "5000");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (createPOSPaymentIntent as any).mockRejectedValue(
        new Error("Stripe API error")
      );

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("Stripe API error");
    });

    it("should handle customerId as null if not provided", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "create-payment-intent");
      formData.append("amount", "5000");
      // customerId not appended

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (createPOSPaymentIntent as any).mockResolvedValue({
        clientSecret: "pi_secret_123",
        paymentIntentId: "pi_123",
      });

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(createPOSPaymentIntent).toHaveBeenCalledWith("org-123", 5000, {
        customerId: undefined,
      });
    });
  });

  describe("action - connection-token", () => {
    it("should create terminal connection token", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "connection-token");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (createTerminalConnectionToken as any).mockResolvedValue({
        secret: "tml_secret_123",
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.secret).toBe("tml_secret_123");
    });

    it("should return error if Stripe not connected", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "connection-token");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (createTerminalConnectionToken as any).mockResolvedValue(null);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("Stripe not connected");
    });

    it("should handle connection token error", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "connection-token");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (createTerminalConnectionToken as any).mockRejectedValue(
        new Error("Terminal error")
      );

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("Terminal error");
    });
  });

  describe("action - scan-barcode", () => {
    it("should return product if barcode found", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "scan-barcode");
      formData.append("barcode", "1234567890");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockProduct = {
        id: "prod-1",
        name: "Dive Mask",
        price: "50.00",
        stockQuantity: 10,
      };

      (getProductByBarcode as any).mockResolvedValue(mockProduct);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.scannedProduct).toEqual({
        id: "prod-1",
        name: "Dive Mask",
        price: "50.00",
        stockQuantity: 10,
      });
      expect(getProductByBarcode).toHaveBeenCalledWith(
        mockTenantDb.schema,
        "org-123",
        "1234567890"
      );
    });

    it("should return not found if barcode not found", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "scan-barcode");
      formData.append("barcode", "9999999999");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (getProductByBarcode as any).mockResolvedValue(null);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.barcodeNotFound).toBe(true);
      expect(result.scannedBarcode).toBe("9999999999");
    });
  });

  describe("action - checkout", () => {
    it("should process checkout successfully", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "checkout");
      formData.append(
        "data",
        JSON.stringify({
          items: [
            { type: "product", productId: "prod-1", name: "Mask", quantity: 2, unitPrice: 50, total: 100 },
          ],
          customerId: "cust-123",
          payments: [{ method: "cash", amount: 110 }],
          subtotal: 100,
          tax: 10,
          total: 110,
          notes: "Customer paid cash",
        })
      );

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (processPOSCheckout as any).mockResolvedValue({
        receiptNumber: "POS-2024-0042",
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(true);
      expect(result.receiptNumber).toBe("POS-2024-0042");
      expect(processPOSCheckout).toHaveBeenCalledWith(
        mockTenantDb.schema,
        "org-123",
        expect.objectContaining({
          userId: "user-123",
          customerId: "cust-123",
          subtotal: 100,
          tax: 10,
          total: 110,
        })
      );
    });

    it("should handle checkout error", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "checkout");
      formData.append(
        "data",
        JSON.stringify({
          items: [],
          payments: [],
          subtotal: 0,
          tax: 0,
          total: 0,
        })
      );

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (processPOSCheckout as any).mockRejectedValue(
        new Error("Insufficient inventory")
      );

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("Insufficient inventory");
    });
  });

  describe("action - invalid intent", () => {
    it("should return error for invalid intent", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "unknown-action");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.error).toBe("Invalid intent");
    });
  });
});
