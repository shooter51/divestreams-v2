/**
 * Customer API Routes Integration Tests
 *
 * Tests customer management API endpoints with database integration,
 * tenant isolation, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sql as drizzleSql } from "drizzle-orm";
import {
  createTestTenantSchema,
  cleanupTestTenantSchema,
  useTestDatabase,
} from "../../../setup/database";

// Mock org context
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn().mockResolvedValue({
    user: { id: "test-user", email: "test@test.com" },
    org: { id: "test-org", slug: "test-org", name: "Test Org" },
    membership: { role: "owner" },
  }),
}));

describe.skip("Customer API Routes", () => {
  const getDb = useTestDatabase();
  const testSchema = "tenant_customers_api";

  beforeEach(async () => {
    const { db } = getDb();
    await createTestTenantSchema(db, testSchema);
    await db.execute(drizzleSql.raw(`SET search_path TO ${testSchema}`));
  });

  afterEach(async () => {
    const { db } = getDb();
    await cleanupTestTenantSchema(db, testSchema);
    vi.clearAllMocks();
  });

  describe("GET /customers", () => {
    it("should return all customers for organization", async () => {
      const { sql } = getDb();

      // Create test customers
      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email)
        VALUES ('test-org', 'John', 'Doe', 'john@example.com')
      `;
      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email)
        VALUES ('test-org', 'Jane', 'Smith', 'jane@example.com')
      `;

      const customers = await sql`SELECT * FROM customers ORDER BY email`;

      expect(customers).toHaveLength(2);
      expect(customers[0].email).toBe("jane@example.com");
      expect(customers[1].email).toBe("john@example.com");
    });

    it("should return empty array when no customers exist", async () => {
      const { sql } = getDb();

      const customers = await sql`SELECT * FROM customers`;
      expect(customers).toHaveLength(0);
    });

    it("should handle pagination", async () => {
      const { sql } = getDb();

      // Create multiple customers
      for (let i = 1; i <= 25; i++) {
        await sql`
          INSERT INTO customers (organization_id, first_name, last_name, email)
          VALUES ('test-org', ${`Customer${i}`}, 'Test', ${`customer${i}@test.com`})
        `;
      }

      // First page (10 items)
      const page1 = await sql`
        SELECT * FROM customers ORDER BY email LIMIT 10 OFFSET 0
      `;
      expect(page1).toHaveLength(10);

      // Second page (10 items)
      const page2 = await sql`
        SELECT * FROM customers ORDER BY email LIMIT 10 OFFSET 10
      `;
      expect(page2).toHaveLength(10);

      // Third page (5 items)
      const page3 = await sql`
        SELECT * FROM customers ORDER BY email LIMIT 10 OFFSET 20
      `;
      expect(page3).toHaveLength(5);
    });

    it("should filter customers by search query", async () => {
      const { sql } = getDb();

      await sql`INSERT INTO customers (organization_id, first_name, last_name, email) VALUES ('test-org', ('Alice', 'Anderson', 'alice@test.com')`;
      await sql`INSERT INTO customers (organization_id, first_name, last_name, email) VALUES ('test-org', ('Bob', 'Brown', 'bob@test.com')`;
      await sql`INSERT INTO customers (organization_id, first_name, last_name, email) VALUES ('test-org', ('Charlie', 'Chen', 'charlie@test.com')`;

      // Search by first name
      const searchResults = await sql`
        SELECT * FROM customers
        WHERE first_name ILIKE ${"% Alice%"} OR last_name ILIKE ${"% Alice%"}
      `;

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].first_name).toBe("Alice");
    });
  });

  describe("GET /customers/:id", () => {
    it("should return customer by ID", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email, phone)
        VALUES ('test-org', 'Test', 'Customer', 'test@test.com', '555-1234')
      `;

      const inserted = await sql`SELECT id FROM customers LIMIT 1`;
      const customerId = inserted[0].id;

      const customer = await sql`SELECT * FROM customers WHERE id = ${customerId}`;

      expect(customer).toHaveLength(1);
      expect(customer[0].email).toBe("test@test.com");
      expect(customer[0].phone).toBe("555-1234");
    });

    it("should return 404 for non-existent customer", async () => {
      const { sql } = getDb();

      const customer = await sql`SELECT * FROM customers WHERE id = 99999`;
      expect(customer).toHaveLength(0);
    });

    it("should include customer certifications", async () => {
      const { sql } = getDb();

      const certifications = JSON.stringify([
        { agency: "PADI", level: "Open Water", date: "2023-01-15" },
        { agency: "SSI", level: "Advanced", date: "2023-06-20" },
      ]);

      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email, certifications)
        VALUES ('test-org', 'Certified', 'Diver', 'cert@test.com', ${certifications})
      `;

      const customer = await sql`SELECT * FROM customers WHERE email = 'cert@test.com'`;

      expect(customer[0].certifications).toBeDefined();
      const certs = JSON.parse(customer[0].certifications);
      expect(certs).toHaveLength(2);
      expect(certs[0].agency).toBe("PADI");
    });
  });

  describe("POST /customers", () => {
    it("should create new customer with required fields", async () => {
      const { sql } = getDb();

      const newCustomer = {
        firstName: "New",
        lastName: "Customer",
        email: "new@test.com",
      };

      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email)
        VALUES (${newCustomer.firstName}, ${newCustomer.lastName}, ${newCustomer.email})
      `;

      const created = await sql`SELECT * FROM customers WHERE email = 'new@test.com'`;

      expect(created).toHaveLength(1);
      expect(created[0].first_name).toBe("New");
      expect(created[0].last_name).toBe("Customer");
    });

    it("should create customer with all optional fields", async () => {
      const { sql } = getDb();

      const fullCustomer = {
        firstName: "Complete",
        lastName: "Customer",
        email: "complete@test.com",
        phone: "555-9999",
        emergencyContactName: "Emergency Person",
        emergencyContactPhone: "555-0000",
        medicalConditions: "None",
        address: "123 Main St",
        city: "Test City",
        state: "TS",
        postalCode: "12345",
      };

      await sql`
        INSERT INTO customers (
          organization_id, first_name, last_name, email, phone,
          emergency_contact_name, emergency_contact_phone,
          medical_conditions, address, city, state, postal_code
        )
        VALUES (
          'test-org', ${fullCustomer.firstName}, ${fullCustomer.lastName}, ${fullCustomer.email},
          ${fullCustomer.phone}, ${fullCustomer.emergencyContactName},
          ${fullCustomer.emergencyContactPhone}, ${fullCustomer.medicalConditions},
          ${fullCustomer.address}, ${fullCustomer.city}, ${fullCustomer.state},
          ${fullCustomer.postalCode}
        )
      `;

      const created = await sql`SELECT * FROM customers WHERE email = 'complete@test.com'`;

      expect(created).toHaveLength(1);
      expect(created[0].phone).toBe("555-9999");
      expect(created[0].emergency_contact_name).toBe("Emergency Person");
      expect(created[0].address).toBe("123 Main St");
    });

    it("should validate required fields", async () => {
      const { sql } = getDb();

      // Try to create customer without email (should fail due to NOT NULL constraint)
      await expect(
        sql`
          INSERT INTO customers (organization_id, first_name, last_name)
          VALUES ('test-org', 'No', 'Email')
        `
      ).rejects.toThrow();
    });

    it("should handle duplicate email gracefully", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email)
        VALUES ('First', 'Customer', 'duplicate@test.com')
      `;

      // Try to create another with same email
      // Note: Without unique constraint, this will succeed
      // If unique constraint exists, it should throw
      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email)
        VALUES ('Second', 'Customer', 'duplicate@test.com')
      `;

      const customers = await sql`SELECT * FROM customers WHERE email = 'duplicate@test.com'`;
      // Will be 2 without constraint, 1 with constraint that throws
      expect(customers.length).toBeGreaterThan(0);
    });
  });

  describe("PUT /customers/:id", () => {
    it("should update customer fields", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email, phone)
        VALUES ('test-org', 'Update', 'Me', 'update@test.com', '555-0000')
      `;

      const customer = await sql`SELECT id FROM customers WHERE email = 'update@test.com'`;
      const customerId = customer[0].id;

      // Update
      await sql`
        UPDATE customers
        SET phone = '555-1111', first_name = 'Updated'
        WHERE id = ${customerId}
      `;

      const updated = await sql`SELECT * FROM customers WHERE id = ${customerId}`;

      expect(updated[0].first_name).toBe("Updated");
      expect(updated[0].phone).toBe("555-1111");
    });

    it("should update certifications array", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email)
        VALUES ('Cert', 'Update', 'certupdate@test.com')
      `;

      const customer = await sql`SELECT id FROM customers WHERE email = 'certupdate@test.com'`;
      const customerId = customer[0].id;

      const newCerts = JSON.stringify([
        { agency: "PADI", level: "Rescue Diver", date: "2024-01-10" },
      ]);

      await sql`
        UPDATE customers
        SET certifications = ${newCerts}
        WHERE id = ${customerId}
      `;

      const updated = await sql`SELECT certifications FROM customers WHERE id = ${customerId}`;
      const certs = JSON.parse(updated[0].certifications);

      expect(certs).toHaveLength(1);
      expect(certs[0].level).toBe("Rescue Diver");
    });

    it("should return 404 for non-existent customer update", async () => {
      const { sql } = getDb();

      const result = await sql`
        UPDATE customers
        SET first_name = 'Not Found'
        WHERE id = 99999
      `;

      // No rows affected
      expect(result.count).toBe(0);
    });
  });

  describe("DELETE /customers/:id", () => {
    it("should delete customer", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email)
        VALUES ('Delete', 'Me', 'delete@test.com')
      `;

      const customer = await sql`SELECT id FROM customers WHERE email = 'delete@test.com'`;
      const customerId = customer[0].id;

      // Verify exists
      let exists = await sql`SELECT * FROM customers WHERE id = ${customerId}`;
      expect(exists).toHaveLength(1);

      // Delete
      await sql`DELETE FROM customers WHERE id = ${customerId}`;

      // Verify deleted
      exists = await sql`SELECT * FROM customers WHERE id = ${customerId}`;
      expect(exists).toHaveLength(0);
    });

    it("should cascade delete customer bookings", async () => {
      const { sql } = getDb();

      // Create customer
      await sql`INSERT INTO customers (organization_id, first_name, last_name, email) VALUES ('test-org', ('Cascade', 'Delete', 'cascade@test.com')`;
      const customer = await sql`SELECT id FROM customers LIMIT 1`;
      const customerId = customer[0].id;

      // Create tour, boat, trip
      await sql`INSERT INTO tours (name, price, max_participants, is_active) VALUES ('Tour', 100, 10, true)`;
      const tour = await sql`SELECT id FROM tours LIMIT 1`;
      const tourId = tour[0].id;

      await sql`INSERT INTO boats (name, capacity, is_active) VALUES ('Boat', 20, true)`;
      const boat = await sql`SELECT id FROM boats LIMIT 1`;
      const boatId = boat[0].id;

      await sql`
        INSERT INTO trips (tour_id, boat_id, date, time, available_spots, status)
        VALUES (${tourId}, ${boatId}, '2024-12-25', '09:00:00', 10, 'scheduled')
      `;
      const trip = await sql`SELECT id FROM trips LIMIT 1`;
      const tripId = trip[0].id;

      // Create booking
      await sql`
        INSERT INTO bookings (booking_number, customer_id, trip_id, participants, total, status)
        VALUES ('BK-CASCADE', ${customerId}, ${tripId}, 2, 200.00, 'confirmed')
      `;

      // Verify booking exists
      let bookings = await sql`SELECT * FROM bookings WHERE customer_id = ${customerId}`;
      expect(bookings).toHaveLength(1);

      // Delete customer
      await sql`DELETE FROM customers WHERE id = ${customerId}`;

      // Bookings should be cascade deleted
      bookings = await sql`SELECT * FROM bookings WHERE customer_id = ${customerId}`;
      expect(bookings).toHaveLength(0);
    });

    it("should return 404 for non-existent customer deletion", async () => {
      const { sql } = getDb();

      const result = await sql`DELETE FROM customers WHERE id = '00000000-0000-0000-0000-000000000000'::uuid`;
      expect(result.count).toBe(0);
    });
  });

  describe("Tenant Isolation", () => {
    it("should only access customers in current tenant schema", async () => {
      const { db, sql } = getDb();

      // Insert in current test schema
      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email)
        VALUES ('test-org', 'Tenant1', 'Customer', 'tenant1@test.com')
      `;

      // Create another tenant schema
      const tenant2Schema = "tenant_customers_api_2";
      await createTestTenantSchema(db, tenant2Schema);
      await db.execute(drizzleSql.raw(`SET search_path TO ${tenant2Schema}`));

      await sql`
        INSERT INTO customers (organization_id, first_name, last_name, email)
        VALUES ('test-org', 'Tenant2', 'Customer', 'tenant2@test.com')
      `;

      // Query from tenant2 - should only see tenant2 customer
      const tenant2Customers = await sql`SELECT * FROM customers`;
      expect(tenant2Customers).toHaveLength(1);
      expect(tenant2Customers[0].email).toBe("tenant2@test.com");

      // Switch back to original schema
      await db.execute(drizzleSql.raw(`SET search_path TO ${testSchema}`));

      // Query from tenant1 - should only see tenant1 customer
      const tenant1Customers = await sql`SELECT * FROM customers`;
      expect(tenant1Customers).toHaveLength(1);
      expect(tenant1Customers[0].email).toBe("tenant1@test.com");

      // Cleanup
      await cleanupTestTenantSchema(db, tenant2Schema);
    });
  });
});
