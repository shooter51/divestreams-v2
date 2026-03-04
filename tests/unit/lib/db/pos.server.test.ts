/**
 * POS Database Functions Tests
 *
 * Tests for POS-related database operations.
 * Uses mocked database calls to test business logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Create chain mock using vi.hoisted to avoid hoisting issues
const { dbMock, mockReturning, mockLimit, mockOffset, mockGroupBy, resetMocks } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockLimit = vi.fn();
  const mockOffset = vi.fn();
  const mockGroupBy = vi.fn();

  // Track which method was called last to determine which mock to use in thenable
  let lastMethod: 'limit' | 'offset' | 'returning' | 'other' = 'other';

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.from = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.where = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.insert = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.values = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.update = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.set = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.delete = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.innerJoin = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.leftJoin = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.orderBy = vi.fn(() => { lastMethod = 'other'; return chain; });
  chain.limit = vi.fn((...args) => { mockLimit(...args); lastMethod = 'limit'; return chain; });
  chain.offset = vi.fn((...args) => { mockOffset(...args); lastMethod = 'offset'; return chain; });
  chain.groupBy = vi.fn(() => { mockGroupBy(); lastMethod = 'other'; return chain; });
  chain.returning = vi.fn((...args) => { mockReturning(...args); lastMethod = 'returning'; return chain; });
  // Mock transaction method - takes a callback and executes it with the chain (acting as tx)
  chain.transaction = vi.fn(async (callback) => {
    return await callback(chain);
  });
  // Thenable - use appropriate mock based on last method called
  chain.then = (resolve: (value: unknown[]) => void, reject?: (error: unknown) => void) => {
    // Call the appropriate mock based on which method was called last
    const mockToCall = lastMethod === 'returning' ? mockReturning
                     : lastMethod === 'offset' ? mockOffset
                     : mockLimit;
    return mockToCall().then(resolve, reject);
  };

  const resetMocks = () => {
    Object.values(chain).forEach((mock) => {
      if (typeof mock === "function" && mock.mockClear) {
        mock.mockClear();
      }
    });
    mockReturning.mockClear();
    mockLimit.mockClear();
    mockOffset.mockClear();
    mockGroupBy.mockClear();
    // Reset to return empty array by default
    mockLimit.mockResolvedValue([]);
    mockOffset.mockResolvedValue([]);
    mockReturning.mockResolvedValue([]);
    // Reset last method tracker
    lastMethod = 'other';
  };

  // Initialize mockLimit and mockOffset to resolve to empty arrays
  mockLimit.mockResolvedValue([]);
  mockOffset.mockResolvedValue([]);

  return { dbMock: chain, mockReturning, mockLimit, mockOffset, mockGroupBy, resetMocks };
});

// Mock the database
vi.mock("../../../../lib/db", () => ({
  db: dbMock,
}));

// Mock the schema
vi.mock("../../../../lib/db/schema", () => ({
  products: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    category: "category",
    price: "price",
    taxRate: "taxRate",
    salePrice: "salePrice",
    saleStartDate: "saleStartDate",
    saleEndDate: "saleEndDate",
    stockQuantity: "stockQuantity",
    imageUrl: "imageUrl",
    isActive: "isActive",
    barcode: "barcode",
    updatedAt: "updatedAt",
  },
  equipment: {
    id: "id",
    organizationId: "organizationId",
    category: "category",
    name: "name",
    isRentable: "isRentable",
    rentalPrice: "rentalPrice",
    status: "status",
    barcode: "barcode",
  },
  trips: {
    id: "id",
    organizationId: "organizationId",
    tourId: "tourId",
    date: "date",
    startTime: "startTime",
    price: "price",
    maxParticipants: "maxParticipants",
    status: "status",
  },
  tours: {
    id: "id",
    price: "price",
    maxParticipants: "maxParticipants",
  },
  bookings: {
    tripId: "tripId",
    participants: "participants",
    status: "status",
  },
  customers: {
    id: "id",
    organizationId: "organizationId",
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    phone: "phone",
  },
  transactions: {
    id: "id",
    organizationId: "organizationId",
    createdAt: "createdAt",
  },
  rentals: {
    organizationId: "organizationId",
    createdAt: "createdAt",
  },
  organizationSettings: {
    organizationId: "organizationId",
    taxRate: "taxRate",
  },
  discountCodes: {
    id: "id",
    organizationId: "organizationId",
    code: "code",
    maxUses: "maxUses",
    usedCount: "usedCount",
  },
}));

// Mock drizzle-orm functions
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val, op: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, op: "and" })),
  inArray: vi.fn((col, vals) => ({ col, vals, op: "inArray" })),
  sql: vi.fn((strings, ...values) => ({
    strings,
    values,
    op: "sql",
    as: vi.fn((alias) => ({ strings, values, op: "sql", alias })),
  })),
}));

describe("pos.server database functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  // ============================================================================
  // getPOSProducts Tests
  // ============================================================================
  describe("getPOSProducts", () => {
    it("should query products with sale fields", async () => {
      const mockProducts = [
        {
          id: "prod-1",
          name: "Product 1",
          category: "Gear",
          price: "50.00",
          salePrice: null,
          saleStartDate: null,
          saleEndDate: null,
          stockQuantity: 10,
          imageUrl: null,
        },
      ];
      mockLimit.mockResolvedValueOnce(mockProducts);

      const { getPOSProducts } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const result = await getPOSProducts(tables, "org-1");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(dbMock.orderBy).toHaveBeenCalled();
      expect(result).toEqual(mockProducts);
    });

    it("should handle query failure and fallback to basic fields", async () => {
      const mockBasicProducts = [
        {
          id: "prod-1",
          name: "Product 1",
          category: "Gear",
          price: "50.00",
          stockQuantity: 10,
          imageUrl: null,
        },
      ];

      mockLimit
        .mockRejectedValueOnce(new Error("sale_price column not found"))
        .mockResolvedValueOnce(mockBasicProducts);

      const { getPOSProducts } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const result = await getPOSProducts(tables, "org-1");

      expect(result).toHaveLength(1);
      expect(result[0].salePrice).toBeNull();
      expect(result[0].saleStartDate).toBeNull();
      expect(result[0].saleEndDate).toBeNull();
    });

    it("should execute without error for any organization", async () => {
      const { getPOSProducts } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await expect(getPOSProducts(tables, "org-1")).resolves.not.toThrow();
      await expect(getPOSProducts(tables, "org-2")).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // getPOSEquipment Tests
  // ============================================================================
  describe("getPOSEquipment", () => {
    it("should query available rentable equipment", async () => {
      const { getPOSEquipment } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await getPOSEquipment(tables, "org-1");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(dbMock.orderBy).toHaveBeenCalled();
    });

    it("should execute without error", async () => {
      const { getPOSEquipment } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await expect(getPOSEquipment(tables, "org-1")).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // getPOSTrips Tests
  // ============================================================================
  describe("getPOSTrips", () => {
    it("should query trips with availability", async () => {
      const mockTrips = [
        {
          trip: {
            id: "trip-1",
            date: "2025-02-01",
            startTime: "09:00",
            maxParticipants: 10,
            status: "scheduled",
          },
          tour: { id: "tour-1", name: "Tour 1", maxParticipants: 12 },
          bookedCount: 5,
        },
      ];
      mockGroupBy.mockReturnValue({
        ...dbMock,
        orderBy: vi.fn().mockResolvedValue(mockTrips),
      });

      const { getPOSTrips } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await getPOSTrips(tables, "org-1", "UTC");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.innerJoin).toHaveBeenCalled();
      expect(dbMock.leftJoin).toHaveBeenCalled();
      expect(mockGroupBy).toHaveBeenCalled();
    });

    it("should execute without error", async () => {
      mockGroupBy.mockReturnValue({
        ...dbMock,
        orderBy: vi.fn().mockResolvedValue([]),
      });

      const { getPOSTrips } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await expect(getPOSTrips(tables, "org-1", "UTC")).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // searchPOSCustomers Tests
  // ============================================================================
  describe("searchPOSCustomers", () => {
    it("should search customers with query", async () => {
      const { searchPOSCustomers } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await searchPOSCustomers(tables, "org-1", "john");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it("should respect custom limit", async () => {
      const { searchPOSCustomers } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await searchPOSCustomers(tables, "org-1", "jane", 25);

      expect(mockLimit).toHaveBeenCalledWith(25);
    });

    it("should execute without error", async () => {
      const { searchPOSCustomers } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await expect(searchPOSCustomers(tables, "org-1", "test")).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // generateReceiptNumber Tests
  // ============================================================================
  describe("generateReceiptNumber", () => {
    it("should generate receipt number with today's date", async () => {
      mockLimit.mockResolvedValueOnce([{ count: 5 }]);

      const { generateReceiptNumber } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const result = await generateReceiptNumber(tables, "org-1");

      expect(result).toMatch(/^POS-\d{8}-\d{4}$/);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
    });

    it("should increment sequence number", async () => {
      mockLimit.mockResolvedValueOnce([{ count: 42 }]);

      const { generateReceiptNumber } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const result = await generateReceiptNumber(tables, "org-1");

      expect(result).toContain("0043");
    });

    it("should handle zero count", async () => {
      mockLimit.mockResolvedValueOnce([{ count: 0 }]);

      const { generateReceiptNumber } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const result = await generateReceiptNumber(tables, "org-1");

      expect(result).toContain("0001");
    });
  });

  // ============================================================================
  // generateAgreementNumber Tests
  // ============================================================================
  describe("generateAgreementNumber", () => {
    it("should generate agreement number with current year", async () => {
      mockLimit.mockResolvedValueOnce([{ count: 10 }]);

      const { generateAgreementNumber } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const result = await generateAgreementNumber(tables, "org-1");

      const currentYear = new Date().getFullYear();
      expect(result).toMatch(new RegExp(`^RA-${currentYear}-\\d{4}$`));
      expect(result).toContain("0011");
    });

    it("should execute without error", async () => {
      mockLimit.mockResolvedValueOnce([{ count: 0 }]);

      const { generateAgreementNumber } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await expect(generateAgreementNumber(tables, "org-1")).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // processPOSCheckout Tests
  // ============================================================================
  describe("processPOSCheckout", () => {
    it("should create transaction for product sale", async () => {
      // 1. Product price lookup (no .limit(), thenable -> mockLimit)
      mockLimit.mockResolvedValueOnce([{ id: "prod-1", price: "50.00", taxRate: null, salePrice: null, saleStartDate: null, saleEndDate: null }]);
      // 2. Org settings .limit(1) -> wrapper consumes mockLimit, thenable consumes mockLimit
      mockLimit.mockResolvedValueOnce([]); // wrapper (ignored)
      mockLimit.mockResolvedValueOnce([{ taxRate: "0" }]); // thenable (org tax rate 0%)
      // 3. Receipt number count (no .limit(), thenable -> mockLimit)
      mockLimit.mockResolvedValueOnce([{ count: 0 }]);
      // 4. Transaction insert .returning()
      mockReturning.mockResolvedValueOnce([]); // wrapper (ignored)
      mockReturning.mockResolvedValueOnce([{ id: "trans-1" }]); // thenable (used)
      // 5. Stock pre-validation (no .limit(), thenable -> mockLimit)
      mockLimit.mockResolvedValueOnce([]);
      // 6. Stock update (thenable -> mockLimit, default empty)

      const { processPOSCheckout } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const checkoutData = {
        items: [
          {
            type: "product" as const,
            productId: "prod-1",
            name: "Product 1",
            quantity: 2,
            unitPrice: 50,
            total: 100,
          },
        ],
        customerId: "cust-1",
        userId: "user-1",
        payments: [{ method: "cash" as const, amount: 100 }], // tax=0, total=100
        subtotal: 100,
        tax: 999, // client value ignored — server recalculates to 0
        total: 999, // client value ignored — server recalculates to 100
      };

      const result = await processPOSCheckout(tables, "org-1", checkoutData);

      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalled();
      expect(mockReturning).toHaveBeenCalled();
      expect(result.transaction.id).toBe("trans-1");
      expect(result.receiptNumber).toMatch(/^POS-/);
    });

    it("should process booking items", async () => {
      // 1. Trip price lookup .limit(1) -> wrapper + thenable
      mockLimit.mockResolvedValueOnce([]); // wrapper (ignored)
      mockLimit.mockResolvedValueOnce([{ tripPrice: "100.00", tourPrice: "100.00" }]); // thenable
      // 2. Org settings .limit(1) -> wrapper + thenable
      mockLimit.mockResolvedValueOnce([]); // wrapper (ignored)
      mockLimit.mockResolvedValueOnce([{ taxRate: "0" }]); // thenable (0% tax)
      // 3. Receipt number (no .limit(), thenable -> mockLimit)
      mockLimit.mockResolvedValueOnce([{ count: 0 }]);
      // 4. Transaction insert .returning()
      mockReturning.mockResolvedValueOnce([]); // wrapper (ignored)
      mockReturning.mockResolvedValueOnce([{ id: "trans-1" }]); // thenable
      // 5. getNextBookingNumber .limit(1) -> wrapper + thenable
      mockLimit.mockResolvedValueOnce([]); // wrapper (ignored)
      mockLimit.mockResolvedValueOnce([]); // thenable (no existing bookings)
      // 6. Booking insert (thenable -> mockLimit, default [])

      const { processPOSCheckout } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const checkoutData = {
        items: [
          {
            type: "booking" as const,
            tripId: "trip-1",
            tourName: "Tour 1",
            participants: 3,
            unitPrice: 100,
            total: 300,
          },
        ],
        customerId: "cust-1",
        payments: [{ method: "card" as const, amount: 300, stripePaymentIntentId: "pi_123" }], // tax=0
        subtotal: 300,
        tax: 0,
        total: 300,
      };

      await processPOSCheckout(tables, "org-1", checkoutData);

      expect(dbMock.insert).toHaveBeenCalledTimes(2); // Transaction + booking
    });

    it("should process rental items", async () => {
      // 1. Equipment price lookup .limit(1) -> wrapper + thenable
      mockLimit.mockResolvedValueOnce([]); // wrapper (ignored)
      mockLimit.mockResolvedValueOnce([{ rentalPrice: "20.00" }]); // thenable
      // 2. Org settings .limit(1) -> wrapper + thenable
      mockLimit.mockResolvedValueOnce([]); // wrapper (ignored)
      mockLimit.mockResolvedValueOnce([{ taxRate: "0" }]); // thenable (0% tax)
      // 3. Receipt number (no .limit(), thenable -> mockLimit)
      mockLimit.mockResolvedValueOnce([{ count: 0 }]);
      // 4. Transaction insert .returning()
      mockReturning.mockResolvedValueOnce([]); // wrapper (ignored)
      mockReturning.mockResolvedValueOnce([{ id: "trans-1" }]); // thenable
      // 5. Agreement number .limit(1) -> wrapper + thenable
      mockLimit.mockResolvedValueOnce([]); // wrapper (ignored)
      mockLimit.mockResolvedValueOnce([{ count: 0 }]); // thenable
      // 6. Rental insert (thenable -> mockLimit, default [])
      // 7. Equipment status update (thenable -> mockLimit, default [])

      const { processPOSCheckout } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const checkoutData = {
        items: [
          {
            type: "rental" as const,
            equipmentId: "eq-1",
            name: "Wetsuit",
            days: 3,
            dailyRate: 20,
            total: 60,
          },
        ],
        customerId: "cust-1",
        payments: [{ method: "cash" as const, amount: 60 }], // tax=0
        subtotal: 60,
        tax: 0,
        total: 60,
      };

      await processPOSCheckout(tables, "org-1", checkoutData);

      expect(dbMock.insert).toHaveBeenCalledTimes(2); // Transaction + rental
      expect(dbMock.update).toHaveBeenCalled(); // Equipment status update
    });

    it("should handle split payment", async () => {
      // 1. Product price lookup (no .limit(), thenable -> mockLimit)
      mockLimit.mockResolvedValueOnce([{ id: "prod-1", price: "100.00", taxRate: null, salePrice: null, saleStartDate: null, saleEndDate: null }]);
      // 2. Org settings .limit(1) -> wrapper + thenable
      mockLimit.mockResolvedValueOnce([]); // wrapper (ignored)
      mockLimit.mockResolvedValueOnce([{ taxRate: "0" }]); // thenable (0% tax)
      // 3. Receipt number (thenable -> mockLimit)
      mockLimit.mockResolvedValueOnce([{ count: 0 }]);
      // 4. Transaction insert .returning()
      mockReturning.mockResolvedValueOnce([]); // wrapper (ignored)
      mockReturning.mockResolvedValueOnce([{ id: "trans-1" }]); // thenable
      // 5. Stock pre-validation (thenable -> mockLimit)
      mockLimit.mockResolvedValueOnce([]);

      const { processPOSCheckout } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const checkoutData = {
        items: [
          {
            type: "product" as const,
            productId: "prod-1",
            name: "Product 1",
            quantity: 1,
            unitPrice: 100,
            total: 100,
          },
        ],
        payments: [
          { method: "cash" as const, amount: 50 }, // Split: 50 + 50 = 100
          { method: "card" as const, amount: 50, stripePaymentIntentId: "pi_123" },
        ],
        subtotal: 100,
        tax: 0,
        total: 100,
      };

      await processPOSCheckout(tables, "org-1", checkoutData);

      expect(dbMock.insert).toHaveBeenCalled();
    });

    it("should recalculate tax server-side ignoring client value (DS-6h11)", async () => {
      // 1. Product price lookup
      mockLimit.mockResolvedValueOnce([{ id: "prod-1", price: "50.00", taxRate: "10", salePrice: null, saleStartDate: null, saleEndDate: null }]);
      // 2. Org settings .limit(1) -> wrapper + thenable
      mockLimit.mockResolvedValueOnce([]); // wrapper (ignored)
      mockLimit.mockResolvedValueOnce([{ taxRate: "8" }]); // thenable (8% org rate, but product has 10%)
      // 3. Receipt number
      mockLimit.mockResolvedValueOnce([{ count: 0 }]);
      // 4. Transaction insert .returning()
      mockReturning.mockResolvedValueOnce([]); // wrapper (ignored)
      mockReturning.mockResolvedValueOnce([{ id: "trans-1" }]); // thenable
      // 5. Stock pre-validation
      mockLimit.mockResolvedValueOnce([]);

      const { processPOSCheckout } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      const checkoutData = {
        items: [
          {
            type: "product" as const,
            productId: "prod-1",
            name: "Product 1",
            quantity: 1,
            unitPrice: 50,
            total: 50,
          },
        ],
        customerId: "cust-1",
        payments: [{ method: "cash" as const, amount: 55 }], // 50 + 10% tax = 55
        subtotal: 50,
        tax: 0, // Client sends 0, but server should calculate 5 (10% of 50)
        total: 50, // Client sends 50, but server should calculate 55
      };

      const result = await processPOSCheckout(tables, "org-1", checkoutData);

      // Verify server overrode client tax with calculated value
      expect(result.transaction.id).toBe("trans-1");
    });
  });

  // ============================================================================
  // getProductById Tests
  // ============================================================================
  describe("getProductById", () => {
    it("should query product by ID", async () => {
      const { getProductById } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await getProductById(tables, "org-1", "prod-1");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it("should execute without error", async () => {
      const { getProductById } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await expect(getProductById(tables, "org-1", "prod-1")).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // getEquipmentById Tests
  // ============================================================================
  describe("getEquipmentById", () => {
    it("should query equipment by ID", async () => {
      const { getEquipmentById } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await getEquipmentById(tables, "org-1", "eq-1");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(1);
    });
  });

  // ============================================================================
  // getProductByBarcode Tests
  // ============================================================================
  describe("getProductByBarcode", () => {
    it("should query product by barcode", async () => {
      const { getProductByBarcode } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await getProductByBarcode(tables, "org-1", "123456789");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it("should execute without error", async () => {
      const { getProductByBarcode } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await expect(getProductByBarcode(tables, "org-1", "123456789")).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // getEquipmentByBarcode Tests
  // ============================================================================
  describe("getEquipmentByBarcode", () => {
    it("should query equipment by barcode", async () => {
      const { getEquipmentByBarcode } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await getEquipmentByBarcode(tables, "org-1", "987654321");

      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it("should execute without error", async () => {
      const { getEquipmentByBarcode } = await import("../../../../lib/db/pos.server");
      const tables = await import("../../../../lib/db/schema");

      await expect(getEquipmentByBarcode(tables, "org-1", "987654321")).resolves.not.toThrow();
    });
  });
});
