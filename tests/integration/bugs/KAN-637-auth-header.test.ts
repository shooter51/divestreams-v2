/**
 * KAN-637: Customer already logged in, but 'Log in' and 'Sign Up' still exist on page header
 *
 * Integration test to verify the loader properly checks customer session
 * and the header conditionally renders auth buttons.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../../../lib/db";
import { organization, customers, customerCredentials, customerSessions } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";

describe("KAN-637: Site layout auth header state", () => {
  let testOrgId: string;
  let testCustomerId: string;
  let testSessionToken: string;

  beforeAll(async () => {
    // Create a test organization with UUID
    const orgId = randomUUID();
    const uniqueSlug = `kan637test-${Date.now()}`;

    const [testOrg] = await db
      .insert(organization)
      .values({
        id: orgId,
        name: `KAN-637 Test Org ${Date.now()}`,
        slug: uniqueSlug,
        publicSiteSettings: {
          enabled: true,
          theme: "ocean",
          primaryColor: "",
          secondaryColor: "",
          logoUrl: null,
          heroImageUrl: null,
          heroVideoUrl: null,
          fontFamily: "inter",
          pages: {
            home: true,
            about: true,
            trips: true,
            courses: true,
            equipment: false,
            contact: true,
            gallery: false,
          },
          aboutContent: null,
          contactInfo: null,
        },
      })
      .returning();

    testOrgId = testOrg.id;

    // Create a test customer
    const [testCustomer] = await db
      .insert(customers)
      .values({
        organizationId: testOrgId,
        firstName: "Test",
        lastName: "Customer",
        email: "test@kan637.com",
        phone: "555-0100",
        hasAccount: true,
      })
      .returning();

    testCustomerId = testCustomer.id;

    // Create customer credentials
    const passwordHash = await bcrypt.hash("TestPassword123!", 12);
    await db.insert(customerCredentials).values({
      organizationId: testOrgId,
      customerId: testCustomerId,
      email: "test@kan637.com",
      passwordHash,
    });

    // Create a session for the customer
    testSessionToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insert(customerSessions).values({
      organizationId: testOrgId,
      customerId: testCustomerId,
      token: testSessionToken,
      expiresAt,
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testOrgId) {
      await db.delete(customerSessions).where(eq(customerSessions.organizationId, testOrgId));
      await db.delete(customerCredentials).where(eq(customerCredentials.organizationId, testOrgId));
      await db.delete(customers).where(eq(customers.organizationId, testOrgId));
      await db.delete(organization).where(eq(organization.id, testOrgId));
    }
  });

  it("should include customer in loader data when valid session exists", async () => {
    // Import the loader function
    const { loader } = await import("../../../app/routes/site/_layout");

    // Get the org slug for the URL
    const [org] = await db.select().from(organization).where(eq(organization.id, testOrgId)).limit(1);

    // Verify session exists in DB
    const [session] = await db.select().from(customerSessions).where(eq(customerSessions.token, testSessionToken)).limit(1);
    expect(session, "Session should exist in DB before test").toBeDefined();
    expect(session.customerId).toBe(testCustomerId);

    // Verify customer exists in DB
    const [customer] = await db.select().from(customers).where(eq(customers.id, testCustomerId)).limit(1);
    expect(customer, "Customer should exist in DB before test").toBeDefined();

    // Create a mock request with customer session cookie
    // Note: We can't use new Request() with Cookie header because it's a forbidden header
    // Instead, create a mock request object that mimics the Request interface
    const request = {
      url: `http://${org.slug}.localhost:5173/site`,
      method: "GET",
      headers: {
        get: (name: string) => {
          if (name === "Cookie") {
            return `customer_session=${testSessionToken}`;
          }
          return null;
        },
        has: (name: string) => name === "Cookie",
        forEach: () => {},
        entries: () => [],
        keys: () => [],
        values: () => [],
      },
    } as unknown as Request;

    const loaderData = await loader({ request, params: {}, context: {} });

    // Verify customer is included in loader data
    expect(loaderData.customer).toBeDefined();
    expect(loaderData.customer).not.toBeNull();
    expect(loaderData.customer?.id).toBe(testCustomerId);
    expect(loaderData.customer?.firstName).toBe("Test");
    expect(loaderData.customer?.lastName).toBe("Customer");
    expect(loaderData.customer?.email).toBe("test@kan637.com");
  });

  it("should NOT include customer in loader data when no session cookie", async () => {
    // Import the loader function
    const { loader } = await import("../../../app/routes/site/_layout");

    // Get the org slug for the URL
    const [org] = await db.select().from(organization).where(eq(organization.id, testOrgId)).limit(1);

    // Create a mock request WITHOUT session cookie
    const request = new Request(`http://${org.slug}.localhost:5173/site`, {
      headers: {},
    });

    const loaderData = await loader({ request, params: {}, context: {} });

    // Verify customer is null when no session
    expect(loaderData.customer).toBeNull();
  });

  it("should NOT include customer when session token is invalid", async () => {
    // Import the loader function
    const { loader } = await import("../../../app/routes/site/_layout");

    // Get the org slug for the URL
    const [org] = await db.select().from(organization).where(eq(organization.id, testOrgId)).limit(1);

    // Create a mock request with invalid session token
    const invalidToken = "invalid-token-12345";
    const request = {
      url: `http://${org.slug}.localhost:5173/site`,
      method: "GET",
      headers: {
        get: (name: string) => {
          if (name === "Cookie") {
            return `customer_session=${invalidToken}`;
          }
          return null;
        },
        has: (name: string) => name === "Cookie",
        forEach: () => {},
        entries: () => [],
        keys: () => [],
        values: () => [],
      },
    } as unknown as Request;

    const loaderData = await loader({ request, params: {}, context: {} });

    // Verify customer is null when session is invalid
    expect(loaderData.customer).toBeNull();
  });

  it("should NOT include customer when session is expired", async () => {
    // Create an expired session
    const expiredToken = randomBytes(32).toString("hex");
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

    await db.insert(customerSessions).values({
      organizationId: testOrgId,
      customerId: testCustomerId,
      token: expiredToken,
      expiresAt: expiredDate,
    });

    // Import the loader function
    const { loader } = await import("../../../app/routes/site/_layout");

    // Get the org slug for the URL
    const [org] = await db.select().from(organization).where(eq(organization.id, testOrgId)).limit(1);

    // Create a mock request with expired session token
    const request = {
      url: `http://${org.slug}.localhost:5173/site`,
      method: "GET",
      headers: {
        get: (name: string) => {
          if (name === "Cookie") {
            return `customer_session=${expiredToken}`;
          }
          return null;
        },
        has: (name: string) => name === "Cookie",
        forEach: () => {},
        entries: () => [],
        keys: () => [],
        values: () => [],
      },
    } as unknown as Request;

    const loaderData = await loader({ request, params: {}, context: {} });

    // Verify customer is null when session is expired
    expect(loaderData.customer).toBeNull();

    // Clean up expired session
    await db.delete(customerSessions).where(eq(customerSessions.token, expiredToken));
  });
});
