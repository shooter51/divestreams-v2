/**
 * Customers Queries Integration Tests
 *
 * Tests database operations for customer management including
 * search, filtering, and data validation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql as drizzleSql } from "drizzle-orm";
import {
  createTestTenantSchema,
  cleanupTestTenantSchema,
  useTestDatabase,
} from "../../../../setup/database";
import {
  getAllCustomers,
  getCustomerById,
  getCustomerByEmail,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
} from "../../../../../lib/db/queries/customers.server";

describe("Customers Queries Integration Tests", () => {
  const getDb = useTestDatabase();
  const testOrgId = "test-org-customers";

  beforeEach(async () => {
    const { db } = getDb();

    // Create customers table
    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id TEXT NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        date_of_birth DATE,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        emergency_contact_relation TEXT,
        medical_conditions TEXT,
        medications TEXT,
        certifications JSONB,
        address TEXT,
        city TEXT,
        state TEXT,
        postal_code TEXT,
        country TEXT,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(organization_id, email)
      )
    `));
  });

  afterEach(async () => {
    const { db } = getDb();
    await db.execute(drizzleSql.raw(`DROP TABLE IF NOT EXISTS customers CASCADE`));
  });

  describe("getAllCustomers", () => {
    it("should return all customers for an organization", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name, phone)
        VALUES
          (${testOrgId}, 'alice@example.com', 'Alice', 'Johnson', '555-1234'),
          (${testOrgId}, 'bob@example.com', 'Bob', 'Smith', '555-5678'),
          (${testOrgId}, 'charlie@example.com', 'Charlie', 'Brown', '555-9012')
      `;

      const customers = await getAllCustomers(testOrgId);

      expect(customers).toHaveLength(3);
      expect(customers.map(c => c.email)).toContain('alice@example.com');
      expect(customers.map(c => c.email)).toContain('bob@example.com');
    });

    it("should return empty array when no customers exist", async () => {
      const customers = await getAllCustomers("nonexistent-org");
      expect(customers).toEqual([]);
    });

    it("should only return customers for the specified organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES
          (${testOrgId}, 'myorg@test.com', 'My', 'Org'),
          (${otherOrgId}, 'their@test.com', 'Their', 'Org')
      `;

      const customers = await getAllCustomers(testOrgId);

      expect(customers).toHaveLength(1);
      expect(customers[0].email).toBe('myorg@test.com');
    });
  });

  describe("getCustomerById", () => {
    it("should return customer by ID with all fields", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (
          organization_id, email, first_name, last_name, phone,
          date_of_birth, emergency_contact_name, emergency_contact_phone,
          medical_conditions, address, city, state, postal_code, country
        )
        VALUES (
          ${testOrgId}, 'john@test.com', 'John', 'Doe', '555-1234',
          '1990-05-15', 'Jane Doe', '555-5678',
          'None', '123 Main St', 'Miami', 'FL', '33101', 'USA'
        )
      `;

      const result = await sql`SELECT id FROM customers WHERE email = 'john@test.com' LIMIT 1`;
      const customerId = result[0].id;

      const customer = await getCustomerById(customerId, testOrgId);

      expect(customer).toBeDefined();
      expect(customer?.email).toBe('john@test.com');
      expect(customer?.firstName).toBe('John');
      expect(customer?.lastName).toBe('Doe');
      expect(customer?.phone).toBe('555-1234');
      expect(customer?.city).toBe('Miami');
      expect(customer?.state).toBe('FL');
    });

    it("should return null when customer does not exist", async () => {
      const customer = await getCustomerById('00000000-0000-0000-0000-000000000000', testOrgId);
      expect(customer).toBeNull();
    });

    it("should not return customer from different organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${otherOrgId}, 'other@test.com', 'Other', 'User')
      `;

      const result = await sql`SELECT id FROM customers WHERE email = 'other@test.com' LIMIT 1`;
      const customerId = result[0].id;

      const customer = await getCustomerById(customerId, testOrgId);
      expect(customer).toBeNull();
    });
  });

  describe("getCustomerByEmail", () => {
    it("should return customer by email", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${testOrgId}, 'findme@test.com', 'Find', 'Me')
      `;

      const customer = await getCustomerByEmail('findme@test.com', testOrgId);

      expect(customer).toBeDefined();
      expect(customer?.firstName).toBe('Find');
      expect(customer?.lastName).toBe('Me');
    });

    it("should be case-insensitive", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${testOrgId}, 'MixedCase@Test.COM', 'Mixed', 'Case')
      `;

      const customer1 = await getCustomerByEmail('mixedcase@test.com', testOrgId);
      const customer2 = await getCustomerByEmail('MIXEDCASE@TEST.COM', testOrgId);

      expect(customer1).toBeDefined();
      expect(customer2).toBeDefined();
      expect(customer1?.id).toBe(customer2?.id);
    });

    it("should return null when email not found", async () => {
      const customer = await getCustomerByEmail('notfound@test.com', testOrgId);
      expect(customer).toBeNull();
    });
  });

  describe("createCustomer", () => {
    it("should create a new customer with all fields", async () => {
      const newCustomer = {
        organizationId: testOrgId,
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'Customer',
        phone: '555-9999',
        dateOfBirth: new Date('1985-03-20'),
        emergencyContactName: 'Emergency Contact',
        emergencyContactPhone: '555-0000',
        emergencyContactRelation: 'Spouse',
        medicalConditions: 'Allergies to shellfish',
        medications: 'None',
        address: '456 Ocean Ave',
        city: 'Key West',
        state: 'FL',
        postalCode: '33040',
        country: 'USA',
        notes: 'VIP customer',
      };

      const createdCustomer = await createCustomer(newCustomer);

      expect(createdCustomer).toBeDefined();
      expect(createdCustomer.email).toBe('new@example.com');
      expect(createdCustomer.firstName).toBe('New');
      expect(createdCustomer.phone).toBe('555-9999');
      expect(createdCustomer.city).toBe('Key West');

      // Verify in database
      const { sql } = getDb();
      const result = await sql`SELECT * FROM customers WHERE id = ${createdCustomer.id}`;
      expect(result).toHaveLength(1);
      expect(result[0].emergency_contact_name).toBe('Emergency Contact');
    });

    it("should create customer with minimal required fields", async () => {
      const newCustomer = {
        organizationId: testOrgId,
        email: 'minimal@test.com',
        firstName: 'Min',
        lastName: 'User',
      };

      const createdCustomer = await createCustomer(newCustomer);

      expect(createdCustomer).toBeDefined();
      expect(createdCustomer.email).toBe('minimal@test.com');
      expect(createdCustomer.phone).toBeUndefined();
      expect(createdCustomer.notes).toBeUndefined();
    });

    it("should enforce unique email within organization", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${testOrgId}, 'duplicate@test.com', 'First', 'User')
      `;

      const duplicateCustomer = {
        organizationId: testOrgId,
        email: 'duplicate@test.com',
        firstName: 'Second',
        lastName: 'User',
      };

      await expect(createCustomer(duplicateCustomer)).rejects.toThrow();
    });

    it("should allow same email in different organizations", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${testOrgId}, 'shared@test.com', 'Org1', 'User')
      `;

      const sameEmailDiffOrg = {
        organizationId: otherOrgId,
        email: 'shared@test.com',
        firstName: 'Org2',
        lastName: 'User',
      };

      const createdCustomer = await createCustomer(sameEmailDiffOrg);
      expect(createdCustomer).toBeDefined();
      expect(createdCustomer.organizationId).toBe(otherOrgId);
    });
  });

  describe("updateCustomer", () => {
    it("should update customer details", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name, phone, city)
        VALUES (${testOrgId}, 'update@test.com', 'Original', 'Name', '555-0000', 'OldCity')
      `;

      const result = await sql`SELECT id FROM customers WHERE email = 'update@test.com' LIMIT 1`;
      const customerId = result[0].id;

      const updates = {
        firstName: 'Updated',
        lastName: 'NameChanged',
        phone: '555-1111',
        city: 'NewCity',
        notes: 'Updated notes',
      };

      const updatedCustomer = await updateCustomer(customerId, testOrgId, updates);

      expect(updatedCustomer).toBeDefined();
      expect(updatedCustomer?.firstName).toBe('Updated');
      expect(updatedCustomer?.lastName).toBe('NameChanged');
      expect(updatedCustomer?.phone).toBe('555-1111');
      expect(updatedCustomer?.city).toBe('NewCity');
      expect(updatedCustomer?.email).toBe('update@test.com'); // Email unchanged
    });

    it("should update partial fields", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name, phone)
        VALUES (${testOrgId}, 'partial@test.com', 'Partial', 'Update', '555-1234')
      `;

      const result = await sql`SELECT id FROM customers WHERE email = 'partial@test.com' LIMIT 1`;
      const customerId = result[0].id;

      const updates = {
        phone: '555-9999',
      };

      const updatedCustomer = await updateCustomer(customerId, testOrgId, updates);

      expect(updatedCustomer?.firstName).toBe('Partial'); // Unchanged
      expect(updatedCustomer?.lastName).toBe('Update'); // Unchanged
      expect(updatedCustomer?.phone).toBe('555-9999'); // Updated
    });

    it("should not update customer from different organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${otherOrgId}, 'protected@test.com', 'Protected', 'Customer')
      `;

      const result = await sql`SELECT id FROM customers WHERE email = 'protected@test.com' LIMIT 1`;
      const customerId = result[0].id;

      const updates = { firstName: 'Hacked' };
      const updatedCustomer = await updateCustomer(customerId, testOrgId, updates);

      expect(updatedCustomer).toBeNull();

      // Verify customer wasn't updated
      const dbResult = await sql`SELECT * FROM customers WHERE id = ${customerId}`;
      expect(dbResult[0].first_name).toBe('Protected');
    });
  });

  describe("deleteCustomer", () => {
    it("should delete customer (hard delete)", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${testOrgId}, 'delete@test.com', 'Delete', 'Me')
      `;

      const result = await sql`SELECT id FROM customers WHERE email = 'delete@test.com' LIMIT 1`;
      const customerId = result[0].id;

      await deleteCustomer(customerId, testOrgId);

      // Customer should be deleted
      const dbResult = await sql`SELECT * FROM customers WHERE id = ${customerId}`;
      expect(dbResult).toHaveLength(0);
    });

    it("should not delete customer from different organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${otherOrgId}, 'safe@test.com', 'Safe', 'Customer')
      `;

      const result = await sql`SELECT id FROM customers WHERE email = 'safe@test.com' LIMIT 1`;
      const customerId = result[0].id;

      await deleteCustomer(customerId, testOrgId);

      // Customer should still exist
      const dbResult = await sql`SELECT * FROM customers WHERE id = ${customerId}`;
      expect(dbResult).toHaveLength(1);
    });
  });

  describe("searchCustomers", () => {
    beforeEach(async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name, phone)
        VALUES
          (${testOrgId}, 'alice.johnson@test.com', 'Alice', 'Johnson', '555-1111'),
          (${testOrgId}, 'bob.smith@test.com', 'Bob', 'Smith', '555-2222'),
          (${testOrgId}, 'charlie.brown@test.com', 'Charlie', 'Brown', '555-3333'),
          (${testOrgId}, 'alice.brown@test.com', 'Alice', 'Brown', '555-4444')
      `;
    });

    it("should search by first name", async () => {
      const results = await searchCustomers(testOrgId, 'Alice');

      expect(results).toHaveLength(2);
      expect(results.every(c => c.firstName === 'Alice')).toBe(true);
    });

    it("should search by last name", async () => {
      const results = await searchCustomers(testOrgId, 'Brown');

      expect(results).toHaveLength(2);
      expect(results.every(c => c.lastName === 'Brown')).toBe(true);
    });

    it("should search by email", async () => {
      const results = await searchCustomers(testOrgId, 'bob.smith@test.com');

      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('bob.smith@test.com');
    });

    it("should search by partial phone number", async () => {
      const results = await searchCustomers(testOrgId, '555-1111');

      expect(results).toHaveLength(1);
      expect(results[0].phone).toBe('555-1111');
    });

    it("should be case-insensitive", async () => {
      const resultsLower = await searchCustomers(testOrgId, 'alice');
      const resultsUpper = await searchCustomers(testOrgId, 'ALICE');

      expect(resultsLower).toHaveLength(2);
      expect(resultsUpper).toHaveLength(2);
      expect(resultsLower.length).toBe(resultsUpper.length);
    });

    it("should return empty array when no matches", async () => {
      const results = await searchCustomers(testOrgId, 'nonexistent');

      expect(results).toEqual([]);
    });

    it("should only search within organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      await sql`
        INSERT INTO customers (organization_id, email, first_name, last_name)
        VALUES (${otherOrgId}, 'alice.other@test.com', 'Alice', 'Other')
      `;

      const results = await searchCustomers(testOrgId, 'Alice');

      expect(results).toHaveLength(2); // Only from testOrgId
      expect(results.every(c => c.organizationId === testOrgId)).toBe(true);
    });
  });
});
