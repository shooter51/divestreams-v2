/**
 * KAN-637: Customer already logged in, but 'Log in' and 'Sign Up' still exist on page header
 *
 * Integration test to verify the loader properly checks customer session
 * and the header conditionally renders auth buttons.
 *
 * Tests the site layout loader's customer session resolution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database so tests don't require a real PostgreSQL connection
vi.mock("../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock org-context resolution for the site layout
vi.mock("../../../lib/auth/org-context.server", () => ({
  getOrgFromRequest: vi.fn(),
}));

import { db } from "../../../lib/db";
import type { Mock } from "vitest";

// Helper to build a chainable mock select that resolves on .where() or .limit()
function mockSelect(returnValue: unknown[]) {
  const chain: Record<string, unknown> = {};
  const resolved = Promise.resolve(returnValue);
  // Make it thenable so destructuring `const [x] = await db.select()...` works
  Object.assign(chain, {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue({ ...chain, then: resolved.then.bind(resolved) }),
    limit: vi.fn().mockResolvedValue(returnValue),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    then: resolved.then.bind(resolved),
  });
  // Fix self-reference: where() needs to return the same chain-with-then
  (chain.where as ReturnType<typeof vi.fn>).mockImplementation(() => chain);
  (chain.from as ReturnType<typeof vi.fn>).mockImplementation(() => chain);
  (chain.innerJoin as ReturnType<typeof vi.fn>).mockImplementation(() => chain);
  (chain.leftJoin as ReturnType<typeof vi.fn>).mockImplementation(() => chain);
  return chain;
}

const mockOrg = {
  id: "org-1",
  name: "Test Dive Shop",
  slug: "kan637test",
  publicSiteSettings: {
    enabled: true,
    theme: "ocean",
    primaryColor: "",
  },
  logo: null,
  metadata: null,
};

const mockCustomer = {
  id: "cust-1",
  firstName: "Test",
  lastName: "Customer",
  email: "test@kan637.com",
  organizationId: "org-1",
  hasAccount: true,
};

const validToken = "valid-session-token-abc123";
const validSession = {
  id: "sess-1",
  token: validToken,
  customerId: "cust-1",
  organizationId: "org-1",
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
};

<<<<<<< HEAD
// Skip this suite if no database is available (local dev without test DB)
const dbAvailable = await db
  .execute("SELECT 1")
  .then(() => true)
  .catch(() => false);

describe.skipIf(!dbAvailable)("KAN-637: Site layout auth header state", () => {
  let testOrgId: string;
  let testCustomerId: string;
  let testSessionToken: string;

  beforeAll(async () => {
    // CSRF module requires AUTH_SECRET to generate tokens
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-for-integration-tests";
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
=======
describe("KAN-637: Site layout auth header state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret-for-integration-tests";
>>>>>>> worktree-agent-aee35569
  });

  it("should include customer in loader data when valid session exists", async () => {
    // Org lookup: returns the org
    (db.select as Mock)
      .mockReturnValueOnce(mockSelect([mockOrg]))    // org lookup by slug
      .mockReturnValueOnce(mockSelect([validSession])) // session lookup
      .mockReturnValueOnce(mockSelect([mockCustomer])); // customer lookup

    const { loader } = await import("../../../app/routes/site/_layout");

    const request = {
      url: `http://kan637test.localhost:5173/`,
      method: "GET",
      headers: {
        get: (name: string) => {
          if (name === "Cookie") return `customer_session=${validToken}`;
          return null;
        },
        has: (name: string) => name === "Cookie",
        forEach: () => {},
        entries: () => [][Symbol.iterator](),
        keys: () => [][Symbol.iterator](),
        values: () => [][Symbol.iterator](),
      },
    } as unknown as Request;

    const loaderData = await loader({ request, params: {}, context: {} });

    expect(loaderData.customer).toBeDefined();
    expect(loaderData.customer).not.toBeNull();
  });

  it("should NOT include customer in loader data when no session cookie", async () => {
    (db.select as Mock)
      .mockReturnValueOnce(mockSelect([mockOrg]));

    const { loader } = await import("../../../app/routes/site/_layout");

    const request = new Request("http://kan637test.localhost:5173/", {
      headers: {},
    });

    const loaderData = await loader({ request, params: {}, context: {} });

    expect(loaderData.customer).toBeNull();
  });

  it("should NOT include customer when session token is invalid", async () => {
    (db.select as Mock)
      .mockReturnValueOnce(mockSelect([mockOrg]))   // org lookup
      .mockReturnValueOnce(mockSelect([]));          // session lookup: returns nothing

    const { loader } = await import("../../../app/routes/site/_layout");

    const request = {
      url: "http://kan637test.localhost:5173/",
      method: "GET",
      headers: {
        get: (name: string) => {
          if (name === "Cookie") return "customer_session=invalid-token-xyz";
          return null;
        },
        has: (name: string) => name === "Cookie",
        forEach: () => {},
        entries: () => [][Symbol.iterator](),
        keys: () => [][Symbol.iterator](),
        values: () => [][Symbol.iterator](),
      },
    } as unknown as Request;

    const loaderData = await loader({ request, params: {}, context: {} });

    expect(loaderData.customer).toBeNull();
  });

  it("should NOT include customer when session is expired", async () => {
    const expiredSession = {
      ...validSession,
      token: "expired-token-abc",
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    };

    (db.select as Mock)
      .mockReturnValueOnce(mockSelect([mockOrg]))       // org lookup
      .mockReturnValueOnce(mockSelect([expiredSession])); // session lookup: returns expired

    const { loader } = await import("../../../app/routes/site/_layout");

    const request = {
      url: "http://kan637test.localhost:5173/",
      method: "GET",
      headers: {
        get: (name: string) => {
          if (name === "Cookie") return "customer_session=expired-token-abc";
          return null;
        },
        has: (name: string) => name === "Cookie",
        forEach: () => {},
        entries: () => [][Symbol.iterator](),
        keys: () => [][Symbol.iterator](),
        values: () => [][Symbol.iterator](),
      },
    } as unknown as Request;

    const loaderData = await loader({ request, params: {}, context: {} });

    expect(loaderData.customer).toBeNull();
  });
});
