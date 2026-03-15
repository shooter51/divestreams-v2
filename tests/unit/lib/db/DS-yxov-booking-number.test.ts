/**
 * DS-yxov: getNextBookingNumber SQL error "negative substring length not allowed"
 *
 * Root cause: The original ORDER BY used SUBSTRING/POSITION which fails when
 * a booking_number doesn't have a second '-' after position 4 (e.g. "BK-1A"
 * or "BK-1000" without a suffix). The fix replaced it with an atomic sequence
 * table (DS-8p6q) and a regexp_match fallback scan for first-use initialisation.
 *
 * These tests verify the function handles edge-case booking number formats
 * gracefully when the fallback path runs (no sequence row yet).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks for the three key DB operations in getNextBookingNumber:
// 1. update().set().where().returning()  — sequence table atomic increment
// 2. select().from().where()             — fallback MAX scan
// 3. insert().values().returning()       — fallback sequence row creation
const mockUpdateReturning = vi.fn();
const mockSelectWhere = vi.fn();
const mockInsertReturning = vi.fn();

function makeDb() {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: mockUpdateReturning,
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockInsertReturning,
      })),
    })),
  };
}

let dbMock = makeDb();

vi.mock("../../../../lib/db/index", () => ({
  get db() { return dbMock; },
}));

vi.mock("../../../../lib/db/schema", () => ({
  bookings: {
    organizationId: "organizationId",
    bookingNumber: "bookingNumber",
  },
  bookingNumberSequences: {
    organizationId: "organization_id",
    nextNumber: "next_number",
    updatedAt: "updated_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args) => ({ type: "and", args })),
  eq: vi.fn((col, val) => ({ type: "eq", col, val })),
  sql: vi.fn((strings, ...values) => ({ type: "sql", strings, values })),
  desc: vi.fn((col) => ({ type: "desc", col })),
}));

const BOOKING_PATTERN = /^BK-\d+-[A-Z0-9]{4}$/;

describe("DS-yxov: getNextBookingNumber handles non-standard booking number formats", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    dbMock = makeDb();
    mockUpdateReturning.mockReset();
    mockSelectWhere.mockReset();
    mockInsertReturning.mockReset();
    // Default: no sequence row (fallback path), no existing bookings
    mockUpdateReturning.mockResolvedValue([]);
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);
    mockInsertReturning.mockResolvedValue([{ nextNumber: 1001 }]);
  });

  it("handles normal BK-NNNN-XXXX format correctly (fast path)", async () => {
    // Sequence row exists — fast path returns nextNumber=1006 → BK-1005
    mockUpdateReturning.mockResolvedValue([{ nextNumber: 1006 }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1005-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("handles old format without suffix (BK-1000) gracefully via fallback scan", async () => {
    // No sequence row; fallback MAX scan finds 1000
    mockSelectWhere.mockResolvedValue([{ maxNum: 1000 }]);
    mockInsertReturning.mockResolvedValue([{ nextNumber: 1002 }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1001-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("falls back to BK-1000-XXXX when DB MAX scan returns null (no parseable bookings)", async () => {
    // No sequence row; fallback MAX returns null (non-parseable formats like BK-ABC)
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("falls back to BK-1000-XXXX when DB has mixed format bookings (MAX scan handles it)", async () => {
    // The MAX regexp_match in the DB query handles mixed formats;
    // non-matching rows return NULL and are excluded by MAX()
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("falls back to BK-1000-XXXX when no bookings exist", async () => {
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("falls back to BK-1000-XXXX when MAX result is null", async () => {
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);

    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    const result = await getNextBookingNumber("org-1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
    expect(result).toMatch(BOOKING_PATTERN);
  });

  it("uses regexp_match-based SQL in the fallback MAX scan (not fragile SUBSTRING/POSITION)", async () => {
    // Trigger fallback path (no sequence row)
    mockUpdateReturning.mockResolvedValue([]);
    mockSelectWhere.mockResolvedValue([{ maxNum: null }]);

    const { sql: sqlMock } = await import("drizzle-orm");
    const { getNextBookingNumber } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    await getNextBookingNumber("org-1");

    // The sql template tag is called with strings containing regexp_match
    const sqlCalls = (sqlMock as any).mock.calls;
    const allStrings = sqlCalls
      .map((call: any) => {
        const strings = call[0];
        return Array.isArray(strings) ? strings.join("") : String(strings);
      })
      .join(" ");

    expect(allStrings).toContain("regexp_match");
    expect(allStrings).not.toContain("SUBSTRING");
    expect(allStrings).not.toContain("POSITION");
  });
});
