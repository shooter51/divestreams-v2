/**
 * DS-ktz5: Sequential BK-NNNN booking reference numbers
 *
 * New bookings should get sequential BK-NNNN format IDs (e.g. BK-1000, BK-1001)
 * instead of random alphanumeric IDs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db
const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const dbMock = {
  select: mockSelect,
};

vi.mock("../../../../lib/db/index", () => ({
  db: dbMock,
}));

vi.mock("../../../../lib/db/schema", () => ({
  bookings: {
    organizationId: "organizationId",
    bookingNumber: "bookingNumber",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args) => ({ type: "and", args })),
  eq: vi.fn((col, val) => ({ type: "eq", col, val })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  desc: vi.fn((col) => ({ type: "desc", col })),
}));

describe("DS-ktz5: getNextBookingNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns BK-1000 when no bookings exist for the org", async () => {
    mockLimit.mockResolvedValue([]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toBe("BK-1000");
  });

  it("returns next sequential number after the highest existing BK-NNNN booking", async () => {
    mockLimit.mockResolvedValue([{ bookingNumber: "BK-1005" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toBe("BK-1006");
  });

  it("returns BK-1001 when only BK-1000 exists", async () => {
    mockLimit.mockResolvedValue([{ bookingNumber: "BK-1000" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toBe("BK-1001");
  });

  it("produces BK-NNNN format output that matches the expected pattern", async () => {
    mockLimit.mockResolvedValue([{ bookingNumber: "BK-1007" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-\d+$/);
    expect(result).toBe("BK-1008");
  });

  it("falls back to BK-1000 when existing booking number cannot be parsed", async () => {
    mockLimit.mockResolvedValue([{ bookingNumber: "BK-INVALID" }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toBe("BK-1000");
  });
});
