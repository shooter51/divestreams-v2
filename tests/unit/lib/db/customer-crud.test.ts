/**
 * Customer CRUD Business Logic Tests
 *
 * Tests for customer create, read, update, delete operations
 * including search functionality and data validation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database - must use factory function for vitest hoisting
vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    returning: vi.fn(),
  },
}));

// Mock schema
vi.mock("../../../../lib/db/schema", () => ({
  customers: {
    id: "id",
    organizationId: "organizationId",
    email: "email",
    firstName: "firstName",
    lastName: "lastName",
    phone: "phone",
    dateOfBirth: "dateOfBirth",
    emergencyContactName: "emergencyContactName",
    emergencyContactPhone: "emergencyContactPhone",
    certifications: "certifications",
    totalDives: "totalDives",
    totalSpent: "totalSpent",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  bookings: { tripId: "tripId" },
  trips: { tourId: "tourId" },
  tours: { name: "name" },
}));

// Import after mocks
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../../../../lib/db/queries.server";
import { db } from "../../../../lib/db/index";

describe("Customer CRUD Business Logic", () => {
  const testOrgId = "org-123";

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks
    (db.select as any).mockReturnValue(db);
    (db.from as any).mockReturnValue(db);
    (db.where as any).mockReturnValue(db);
    (db.innerJoin as any).mockReturnValue(db);
    (db.leftJoin as any).mockReturnValue(db);
    (db.insert as any).mockReturnValue(db);
    (db.values as any).mockReturnValue(db);
    (db.update as any).mockReturnValue(db);
    (db.set as any).mockReturnValue(db);
    (db.delete as any).mockReturnValue(db);
    (db.orderBy as any).mockReturnValue(db);
    (db.limit as any).mockReturnValue(db);  // Return db to allow offset chaining
    (db.offset as any).mockResolvedValue([]);  // This is the terminal method
    (db.returning as any).mockResolvedValue([]);
  });

  // ============================================================================
  // Get Customers Tests
  // ============================================================================

  describe("getCustomers", () => {
    it("should return customers with pagination", async () => {
      const mockCustomers = [
        {
          id: "cust-1",
          organizationId: testOrgId,
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
          phone: "+1234567890",
          totalDives: 25,
          totalSpent: "1500.00",
        },
        {
          id: "cust-2",
          organizationId: testOrgId,
          email: "jane@example.com",
          firstName: "Jane",
          lastName: "Smith",
          phone: "+0987654321",
          totalDives: 12,
          totalSpent: "800.00",
        },
      ];

      // Mock first query chain (customers with pagination)
      const mockOffset = vi.fn().mockResolvedValue(mockCustomers);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit, offset: mockOffset });
      const mockWhere1 = vi.fn().mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit, offset: mockOffset });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

      // Mock second query chain (count)
      const mockWhere2 = vi.fn().mockResolvedValue([{ count: 2 }]);
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      // db.select is called twice - once for customers, once for count
      (db.select as any)
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getCustomers(testOrgId, { limit: 10, offset: 0 });

      expect(result.customers).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockWhere1).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
    });

    it("should filter customers by search term", async () => {
      const mockCustomers = [
        {
          id: "cust-1",
          organizationId: testOrgId,
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
          phone: "+1234567890",
        },
      ];

      const mockOffset = vi.fn().mockResolvedValue(mockCustomers);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit, offset: mockOffset });
      const mockWhere1 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockWhere2 = vi.fn().mockResolvedValue([{ count: 1 }]);
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getCustomers(testOrgId, { search: "John" });

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].firstName).toBe("John");
    });

    it("should handle empty search results", async () => {
      const mockOffset = vi.fn().mockResolvedValue([]);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit, offset: mockOffset });
      const mockWhere1 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockWhere2 = vi.fn().mockResolvedValue([{ count: 0 }]);
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await getCustomers(testOrgId, { search: "nonexistent" });

      expect(result.customers).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should apply limit and offset correctly", async () => {
      const mockCustomers = Array.from({ length: 5 }, (_, i) => ({
        id: `cust-${i}`,
        organizationId: testOrgId,
        email: `user${i}@example.com`,
        firstName: `User${i}`,
        lastName: `Test`,
      }));

      const mockOffset = vi.fn().mockResolvedValue(mockCustomers);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit, offset: mockOffset });
      const mockWhere1 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });
      const mockWhere2 = vi.fn().mockResolvedValue([{ count: 100 }]);
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      await getCustomers(testOrgId, { limit: 5, offset: 10 });

      expect(mockLimit).toHaveBeenCalled();
      expect(mockOffset).toHaveBeenCalled();
    });
  });

  describe("getCustomerById", () => {
    it("should return customer when found", async () => {
      const mockCustomer = {
        id: "cust-123",
        organizationId: testOrgId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "Customer",
        phone: "+1234567890",
        dateOfBirth: "1990-01-01",
        totalDives: 50,
        totalSpent: "3000.00",
      };

      const mockLimit = vi.fn().mockResolvedValue([mockCustomer]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await getCustomerById(testOrgId, "cust-123");

      expect(result).toBeDefined();
      expect(result?.id).toBe("cust-123");
      expect(result?.email).toBe("test@example.com");
    });

    it("should return null when customer not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await getCustomerById(testOrgId, "nonexistent-id");

      expect(result).toBeNull();
    });

    it("should filter by organization ID", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      await getCustomerById(testOrgId, "cust-123");

      expect(mockWhere).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Create Customer Tests
  // ============================================================================

  describe("createCustomer", () => {
    it("should create customer with required fields", async () => {
      const newCustomer = {
        id: "cust-new",
        organizationId: testOrgId,
        email: "newcustomer@example.com",
        firstName: "New",
        lastName: "Customer",
        phone: null,
        totalDives: 0,
        totalSpent: "0.00",
        createdAt: new Date(),
      };

      (db.returning as any).mockResolvedValue([newCustomer]);

      const result = await createCustomer(testOrgId, {
        email: "newcustomer@example.com",
        firstName: "New",
        lastName: "Customer",
      });

      expect(result.email).toBe("newcustomer@example.com");
      expect(result.firstName).toBe("New");
      expect(result.lastName).toBe("Customer");
      expect((db.insert as any)).toHaveBeenCalled();
      expect((db.values as any)).toHaveBeenCalled();
    });

    it("should create customer with all optional fields", async () => {
      const fullCustomer = {
        id: "cust-full",
        organizationId: testOrgId,
        email: "full@example.com",
        firstName: "Full",
        lastName: "Data",
        phone: "+1234567890",
        dateOfBirth: "1985-05-15",
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: "+0987654321",
        emergencyContactRelation: "Spouse",
        medicalConditions: "None",
        medications: "None",
        certifications: [{ agency: "PADI", level: "Advanced", number: "12345" }],
        address: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33101",
        country: "USA",
        notes: "VIP customer",
      };

      (db.returning as any).mockResolvedValue([fullCustomer]);

      const result = await createCustomer(testOrgId, {
        email: "full@example.com",
        firstName: "Full",
        lastName: "Data",
        phone: "+1234567890",
        dateOfBirth: "1985-05-15",
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: "+0987654321",
        emergencyContactRelation: "Spouse",
        medicalConditions: "None",
        medications: "None",
        certifications: [{ agency: "PADI", level: "Advanced", number: "12345" }],
        address: "123 Main St",
        city: "Miami",
        state: "FL",
        postalCode: "33101",
        country: "USA",
        notes: "VIP customer",
      });

      expect(result.phone).toBe("+1234567890");
      expect(result.emergencyContactName).toBe("Emergency Contact");
      expect(result.certifications).toBeDefined();
    });

    it("should handle customer with certifications", async () => {
      const certifiedCustomer = {
        id: "cust-cert",
        organizationId: testOrgId,
        email: "certified@example.com",
        firstName: "Certified",
        lastName: "Diver",
        certifications: [
          { agency: "PADI", level: "Open Water", number: "OW123", date: "2020-01-01" },
          { agency: "PADI", level: "Advanced", number: "AOW456", date: "2021-06-15" },
        ],
      };

      (db.returning as any).mockResolvedValue([certifiedCustomer]);

      const result = await createCustomer(testOrgId, {
        email: "certified@example.com",
        firstName: "Certified",
        lastName: "Diver",
        certifications: [
          { agency: "PADI", level: "Open Water", number: "OW123", date: "2020-01-01" },
          { agency: "PADI", level: "Advanced", number: "AOW456", date: "2021-06-15" },
        ],
      });

      expect(result.certifications).toHaveLength(2);
      expect(result.certifications[0].agency).toBe("PADI");
    });
  });

  // ============================================================================
  // Update Customer Tests
  // ============================================================================

  describe("updateCustomer", () => {
    it("should update customer fields", async () => {
      const updatedCustomer = {
        id: "cust-123",
        organizationId: testOrgId,
        email: "updated@example.com",
        firstName: "Updated",
        lastName: "Name",
        phone: "+9999999999",
        updatedAt: new Date(),
      };

      (db.returning as any).mockResolvedValue([updatedCustomer]);

      const result = await updateCustomer(testOrgId, "cust-123", {
        email: "updated@example.com",
        firstName: "Updated",
        lastName: "Name",
        phone: "+9999999999",
      });

      expect(result?.email).toBe("updated@example.com");
      expect(result?.phone).toBe("+9999999999");
      expect((db.update as any)).toHaveBeenCalled();
      expect((db.set as any)).toHaveBeenCalled();
    });

    it("should update only provided fields", async () => {
      const updatedCustomer = {
        id: "cust-123",
        organizationId: testOrgId,
        email: "original@example.com",
        firstName: "Original",
        lastName: "Name",
        phone: "+1111111111",
        updatedAt: new Date(),
      };

      (db.returning as any).mockResolvedValue([updatedCustomer]);

      const result = await updateCustomer(testOrgId, "cust-123", {
        phone: "+1111111111",
      });

      expect(result?.phone).toBe("+1111111111");
    });

    it("should return null when customer not found", async () => {
      (db.returning as any).mockResolvedValue([]);

      const result = await updateCustomer(testOrgId, "nonexistent-id", {
        firstName: "Test",
      });

      expect(result).toBeNull();
    });

    it("should update emergency contact information", async () => {
      const updatedCustomer = {
        id: "cust-123",
        organizationId: testOrgId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "Customer",
        emergencyContactName: "New Emergency Contact",
        emergencyContactPhone: "+5555555555",
        emergencyContactRelation: "Parent",
      };

      (db.returning as any).mockResolvedValue([updatedCustomer]);

      const result = await updateCustomer(testOrgId, "cust-123", {
        emergencyContactName: "New Emergency Contact",
        emergencyContactPhone: "+5555555555",
        emergencyContactRelation: "Parent",
      });

      expect(result?.emergencyContactName).toBe("New Emergency Contact");
      expect(result?.emergencyContactRelation).toBe("Parent");
    });

    it("should update medical information", async () => {
      const updatedCustomer = {
        id: "cust-123",
        organizationId: testOrgId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "Customer",
        medicalConditions: "Asthma",
        medications: "Inhaler",
      };

      (db.returning as any).mockResolvedValue([updatedCustomer]);

      const result = await updateCustomer(testOrgId, "cust-123", {
        medicalConditions: "Asthma",
        medications: "Inhaler",
      });

      expect(result?.medicalConditions).toBe("Asthma");
      expect(result?.medications).toBe("Inhaler");
    });
  });

  // ============================================================================
  // Delete Customer Tests
  // ============================================================================

  describe("deleteCustomer", () => {
    it("should delete customer successfully", async () => {
      (db.delete as any) = vi.fn(() => db);
      (db.where as any) = vi.fn(() => Promise.resolve());

      const result = await deleteCustomer(testOrgId, "cust-123");

      expect(result).toBe(true);
      expect((db.delete as any)).toHaveBeenCalled();
      expect((db.where as any)).toHaveBeenCalled();
    });

    it("should filter by organization ID when deleting", async () => {
      (db.delete as any) = vi.fn(() => db);
      (db.where as any) = vi.fn(() => Promise.resolve());

      await deleteCustomer(testOrgId, "cust-123");

      expect((db.where as any)).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases and Validation
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle customers with no phone number", async () => {
      const customer = {
        id: "cust-123",
        organizationId: testOrgId,
        email: "nophone@example.com",
        firstName: "No",
        lastName: "Phone",
        phone: null,
      };

      (db.returning as any).mockResolvedValue([customer]);

      const result = await createCustomer(testOrgId, {
        email: "nophone@example.com",
        firstName: "No",
        lastName: "Phone",
      });

      expect(result.phone).toBeNull();
    });

    it("should handle customers with no date of birth", async () => {
      const customer = {
        id: "cust-123",
        organizationId: testOrgId,
        email: "nodob@example.com",
        firstName: "No",
        lastName: "DOB",
        dateOfBirth: null,
      };

      (db.returning as any).mockResolvedValue([customer]);

      const result = await createCustomer(testOrgId, {
        email: "nodob@example.com",
        firstName: "No",
        lastName: "DOB",
      });

      expect(result.dateOfBirth).toBeUndefined();
    });

    it("should handle customers with empty certifications array", async () => {
      const customer = {
        id: "cust-123",
        organizationId: testOrgId,
        email: "nocert@example.com",
        firstName: "No",
        lastName: "Cert",
        certifications: [],
      };

      (db.returning as any).mockResolvedValue([customer]);

      const result = await createCustomer(testOrgId, {
        email: "nocert@example.com",
        firstName: "No",
        lastName: "Cert",
        certifications: [],
      });

      expect(result.certifications).toEqual([]);
    });
  });
});
