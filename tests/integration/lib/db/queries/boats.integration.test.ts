/**
 * Boats Queries Integration Tests
 *
 * Tests database operations for boats using a real PostgreSQL container.
 * Uses testcontainers to spin up an isolated database for each test suite.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sql as drizzleSql } from "drizzle-orm";
import {
  createTestTenantSchema,
  cleanupTestTenantSchema,
  useTestDatabase,
} from "../../../../setup/database";
import {
  getAllBoats,
  getBoatById,
  createBoat,
  updateBoat,
  deleteBoat,
  getActiveBoats,
} from "../../../../../lib/db/queries/boats.server";

describe("Boats Queries Integration Tests", () => {
  const getDb = useTestDatabase();
  const testSchema = "public"; // Use public schema for these tests
  const testOrgId = "test-org-boats";

  beforeEach(async () => {
    const { db } = getDb();
    // Create necessary tables in public schema
    await db.execute(drizzleSql.raw(`
      CREATE TABLE IF NOT EXISTS boats (
        id SERIAL PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        capacity INTEGER NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  });

  afterEach(async () => {
    const { db } = getDb();
    // Clean up test data
    await db.execute(drizzleSql.raw(`DROP TABLE IF EXISTS boats CASCADE`));
  });

  describe("getAllBoats", () => {
    it("should return all boats for an organization", async () => {
      const { sql } = getDb();

      // Insert test boats
      await sql`
        INSERT INTO boats (organization_id, name, capacity, description, is_active)
        VALUES
          (${testOrgId}, 'Sea Explorer', 20, 'Large dive boat', true),
          (${testOrgId}, 'Ocean Rider', 15, 'Medium dive boat', true),
          (${testOrgId}, 'Wave Master', 10, 'Small dive boat', false)
      `;

      const boats = await getAllBoats(testOrgId);

      expect(boats).toHaveLength(3);
      expect(boats[0].name).toBe('Sea Explorer');
      expect(boats[0].capacity).toBe(20);
    });

    it("should return empty array when no boats exist", async () => {
      const boats = await getAllBoats("nonexistent-org");
      expect(boats).toEqual([]);
    });

    it("should only return boats for the specified organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      await sql`
        INSERT INTO boats (organization_id, name, capacity)
        VALUES
          (${testOrgId}, 'Org1 Boat', 20),
          (${otherOrgId}, 'Org2 Boat', 15)
      `;

      const boats = await getAllBoats(testOrgId);

      expect(boats).toHaveLength(1);
      expect(boats[0].name).toBe('Org1 Boat');
    });
  });

  describe("getActiveBoats", () => {
    it("should return only active boats", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO boats (organization_id, name, capacity, is_active)
        VALUES
          (${testOrgId}, 'Active Boat 1', 20, true),
          (${testOrgId}, 'Active Boat 2', 15, true),
          (${testOrgId}, 'Inactive Boat', 10, false)
      `;

      const activeBoats = await getActiveBoats(testOrgId);

      expect(activeBoats).toHaveLength(2);
      expect(activeBoats.every(boat => boat.isActive)).toBe(true);
    });

    it("should return empty array when no active boats exist", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO boats (organization_id, name, capacity, is_active)
        VALUES (${testOrgId}, 'Inactive Boat', 10, false)
      `;

      const activeBoats = await getActiveBoats(testOrgId);
      expect(activeBoats).toEqual([]);
    });
  });

  describe("getBoatById", () => {
    it("should return boat by ID", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO boats (organization_id, name, capacity, description)
        VALUES (${testOrgId}, 'Test Boat', 20, 'Test description')
      `;

      const result = await sql`SELECT id FROM boats WHERE name = 'Test Boat' LIMIT 1`;
      const boatId = result[0].id;

      const boat = await getBoatById(boatId, testOrgId);

      expect(boat).toBeDefined();
      expect(boat?.name).toBe('Test Boat');
      expect(boat?.capacity).toBe(20);
      expect(boat?.description).toBe('Test description');
    });

    it("should return null when boat does not exist", async () => {
      const boat = await getBoatById(999999, testOrgId);
      expect(boat).toBeNull();
    });

    it("should not return boat from different organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      await sql`
        INSERT INTO boats (organization_id, name, capacity)
        VALUES (${otherOrgId}, 'Other Org Boat', 20)
      `;

      const result = await sql`SELECT id FROM boats WHERE name = 'Other Org Boat' LIMIT 1`;
      const boatId = result[0].id;

      const boat = await getBoatById(boatId, testOrgId);
      expect(boat).toBeNull();
    });
  });

  describe("createBoat", () => {
    it("should create a new boat", async () => {
      const newBoat = {
        organizationId: testOrgId,
        name: 'New Boat',
        capacity: 25,
        description: 'Brand new boat',
        isActive: true,
      };

      const createdBoat = await createBoat(newBoat);

      expect(createdBoat).toBeDefined();
      expect(createdBoat.name).toBe('New Boat');
      expect(createdBoat.capacity).toBe(25);
      expect(createdBoat.organizationId).toBe(testOrgId);

      // Verify in database
      const { sql } = getDb();
      const result = await sql`SELECT * FROM boats WHERE id = ${createdBoat.id}`;
      expect(result).toHaveLength(1);
    });

    it("should create boat with minimal fields", async () => {
      const newBoat = {
        organizationId: testOrgId,
        name: 'Minimal Boat',
        capacity: 10,
      };

      const createdBoat = await createBoat(newBoat);

      expect(createdBoat).toBeDefined();
      expect(createdBoat.name).toBe('Minimal Boat');
      expect(createdBoat.description).toBeUndefined();
      expect(createdBoat.isActive).toBe(true); // Default value
    });
  });

  describe("updateBoat", () => {
    it("should update boat details", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO boats (organization_id, name, capacity, description)
        VALUES (${testOrgId}, 'Original Boat', 20, 'Original description')
      `;

      const result = await sql`SELECT id FROM boats WHERE name = 'Original Boat' LIMIT 1`;
      const boatId = result[0].id;

      const updates = {
        name: 'Updated Boat',
        capacity: 30,
        description: 'Updated description',
      };

      const updatedBoat = await updateBoat(boatId, testOrgId, updates);

      expect(updatedBoat).toBeDefined();
      expect(updatedBoat?.name).toBe('Updated Boat');
      expect(updatedBoat?.capacity).toBe(30);
      expect(updatedBoat?.description).toBe('Updated description');

      // Verify in database
      const dbResult = await sql`SELECT * FROM boats WHERE id = ${boatId}`;
      expect(dbResult[0].name).toBe('Updated Boat');
    });

    it("should update partial fields", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO boats (organization_id, name, capacity, description)
        VALUES (${testOrgId}, 'Partial Update Boat', 20, 'Original')
      `;

      const result = await sql`SELECT id FROM boats WHERE name = 'Partial Update Boat' LIMIT 1`;
      const boatId = result[0].id;

      const updates = {
        capacity: 25,
      };

      const updatedBoat = await updateBoat(boatId, testOrgId, updates);

      expect(updatedBoat?.name).toBe('Partial Update Boat'); // Unchanged
      expect(updatedBoat?.capacity).toBe(25); // Updated
      expect(updatedBoat?.description).toBe('Original'); // Unchanged
    });

    it("should not update boat from different organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      await sql`
        INSERT INTO boats (organization_id, name, capacity)
        VALUES (${otherOrgId}, 'Other Org Boat', 20)
      `;

      const result = await sql`SELECT id FROM boats WHERE name = 'Other Org Boat' LIMIT 1`;
      const boatId = result[0].id;

      const updates = { name: 'Hacked Boat' };
      const updatedBoat = await updateBoat(boatId, testOrgId, updates);

      expect(updatedBoat).toBeNull();

      // Verify boat wasn't updated
      const dbResult = await sql`SELECT * FROM boats WHERE id = ${boatId}`;
      expect(dbResult[0].name).toBe('Other Org Boat');
    });
  });

  describe("deleteBoat", () => {
    it("should soft delete a boat by setting is_active to false", async () => {
      const { sql } = getDb();

      await sql`
        INSERT INTO boats (organization_id, name, capacity, is_active)
        VALUES (${testOrgId}, 'Boat to Delete', 20, true)
      `;

      const result = await sql`SELECT id FROM boats WHERE name = 'Boat to Delete' LIMIT 1`;
      const boatId = result[0].id;

      await deleteBoat(boatId, testOrgId);

      // Boat should still exist but be inactive
      const dbResult = await sql`SELECT * FROM boats WHERE id = ${boatId}`;
      expect(dbResult).toHaveLength(1);
      expect(dbResult[0].is_active).toBe(false);
    });

    it("should not delete boat from different organization", async () => {
      const { sql } = getDb();
      const otherOrgId = "other-org";

      await sql`
        INSERT INTO boats (organization_id, name, capacity, is_active)
        VALUES (${otherOrgId}, 'Protected Boat', 20, true)
      `;

      const result = await sql`SELECT id FROM boats WHERE name = 'Protected Boat' LIMIT 1`;
      const boatId = result[0].id;

      await deleteBoat(boatId, testOrgId);

      // Boat should still be active
      const dbResult = await sql`SELECT * FROM boats WHERE id = ${boatId}`;
      expect(dbResult[0].is_active).toBe(true);
    });
  });

  describe("Multi-tenant isolation", () => {
    it("should maintain strict data isolation between organizations", async () => {
      const { sql } = getDb();
      const org1 = "org-1";
      const org2 = "org-2";

      // Create boats for both orgs
      await sql`
        INSERT INTO boats (organization_id, name, capacity)
        VALUES
          (${org1}, 'Org1 Boat 1', 20),
          (${org1}, 'Org1 Boat 2', 15),
          (${org2}, 'Org2 Boat 1', 25),
          (${org2}, 'Org2 Boat 2', 30)
      `;

      const org1Boats = await getAllBoats(org1);
      const org2Boats = await getAllBoats(org2);

      expect(org1Boats).toHaveLength(2);
      expect(org2Boats).toHaveLength(2);
      expect(org1Boats.every(boat => boat.organizationId === org1)).toBe(true);
      expect(org2Boats.every(boat => boat.organizationId === org2)).toBe(true);
    });
  });
});
