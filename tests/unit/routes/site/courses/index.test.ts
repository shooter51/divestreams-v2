import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Unit Tests for Public Site Courses Loader (DS-rf2e)
 *
 * Verifies that the agency filter dropdown only shows agencies
 * that have active courses, not all hardcoded agencies.
 */

// ============================================================================
// MOCKS
// ============================================================================

// Chainable DB mock for organization query
const { mockGetPublicCourses, queryResults, createChainableDbMock } = vi.hoisted(() => {
  const mockGetPublicCourses = vi.fn();
  const queryResults: unknown[][] = [];

  function createChainableDbMock() {
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop) {
        if (prop === "then") {
          const result = queryResults.shift() || [];
          return (resolve: (value: unknown) => void) => resolve(result);
        }
        return () => new Proxy({}, handler);
      },
    };
    return new Proxy({}, handler);
  }

  return { mockGetPublicCourses, queryResults, createChainableDbMock };
});

vi.mock("../../../../../lib/db/public-site.server", () => ({
  getPublicCourses: mockGetPublicCourses,
}));

vi.mock("../../../../../lib/db", () => ({
  db: createChainableDbMock(),
}));

vi.mock("../../../../../lib/db/schema/auth", () => ({
  organization: { id: "auth.organization.id", slug: "auth.organization.slug", customDomain: "auth.organization.customDomain" },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((a: unknown, b: unknown) => ({ type: "eq", field: a, value: b })),
  };
});

import { loader } from "../../../../../app/routes/site/courses/index";

// ============================================================================
// HELPERS
// ============================================================================

function makeLoaderArgs(host = "demo.divestreams.com", searchParams: Record<string, string> = {}) {
  const url = new URL(`https://${host}/site/courses`);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  const request = new Request(url.toString());
  return { request, params: {}, context: {} } as Parameters<typeof loader>[0];
}

function queueResults(...results: unknown[][]) {
  queryResults.length = 0;
  for (const r of results) {
    queryResults.push(r);
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe("Site Courses Loader (DS-rf2e)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults.length = 0;
  });

  it("returns availableAgencies derived only from courses that exist (PADI and SSI only)", async () => {
    // Mock org lookup
    queueResults([{ id: "org-1", name: "Demo Dive Shop", slug: "demo" }]);

    // Mock getPublicCourses returning only PADI and SSI courses
    mockGetPublicCourses.mockResolvedValueOnce({
      courses: [
        {
          id: "course-1",
          name: "Open Water Diver",
          description: null,
          price: "450.00",
          currency: "USD",
          durationDays: 3,
          maxStudents: 10,
          minAge: null,
          prerequisites: null,
          materialsIncluded: true,
          equipmentIncluded: false,
          images: null,
          agencyName: "PADI",
          levelName: "Open Water",
        },
        {
          id: "course-2",
          name: "SSI Open Water",
          description: null,
          price: "400.00",
          currency: "USD",
          durationDays: 3,
          maxStudents: 8,
          minAge: null,
          prerequisites: null,
          materialsIncluded: false,
          equipmentIncluded: false,
          images: null,
          agencyName: "SSI",
          levelName: "Open Water",
        },
      ],
      total: 2,
    });

    const result = await loader(makeLoaderArgs());

    // availableAgencies should exist and contain only PADI and SSI (not all 7 hardcoded agencies)
    expect(result).toHaveProperty("availableAgencies");
    const agencies = (result as { availableAgencies: Array<{ id: string; name: string }> }).availableAgencies;
    expect(agencies).toHaveLength(2);

    const agencyNames = agencies.map((a) => a.name);
    expect(agencyNames).toContain("PADI");
    expect(agencyNames).toContain("SSI");
    expect(agencyNames).not.toContain("NAUI");
    expect(agencyNames).not.toContain("RAID");
    expect(agencyNames).not.toContain("GUE");
  });

  it("returns empty availableAgencies when no courses exist", async () => {
    queueResults([{ id: "org-1", name: "Demo Dive Shop", slug: "demo" }]);

    mockGetPublicCourses.mockResolvedValueOnce({ courses: [], total: 0 });

    const result = await loader(makeLoaderArgs());

    expect(result).toHaveProperty("availableAgencies");
    const agencies = (result as { availableAgencies: Array<{ id: string; name: string }> }).availableAgencies;
    expect(agencies).toHaveLength(0);
  });

  it("deduplicates agencies when multiple courses share the same agency", async () => {
    queueResults([{ id: "org-1", name: "Demo Dive Shop", slug: "demo" }]);

    mockGetPublicCourses.mockResolvedValueOnce({
      courses: [
        { id: "c1", name: "OWD", description: null, price: "450.00", currency: "USD", durationDays: 3, maxStudents: 10, minAge: null, prerequisites: null, materialsIncluded: null, equipmentIncluded: null, images: null, agencyName: "PADI", levelName: null },
        { id: "c2", name: "AOW", description: null, price: "500.00", currency: "USD", durationDays: 3, maxStudents: 10, minAge: null, prerequisites: null, materialsIncluded: null, equipmentIncluded: null, images: null, agencyName: "PADI", levelName: null },
        { id: "c3", name: "Rescue", description: null, price: "600.00", currency: "USD", durationDays: 4, maxStudents: 10, minAge: null, prerequisites: null, materialsIncluded: null, equipmentIncluded: null, images: null, agencyName: "PADI", levelName: null },
      ],
      total: 3,
    });

    const result = await loader(makeLoaderArgs());

    const agencies = (result as { availableAgencies: Array<{ id: string; name: string }> }).availableAgencies;
    expect(agencies).toHaveLength(1);
    expect(agencies[0].name).toBe("PADI");
  });
});
