/**
 * DS-8p6q: getNextBookingNumber — sequence table
 *
 * Verifies the new atomic sequence-table implementation:
 *  - Primary path: UPDATE next_number + 1 RETURNING (sequence row exists)
 *  - Fallback path: scan MAX(bookings) and INSERT sequence row on first use
 *  - Format stays BK-NNNN-XXXX
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Shared db mock — reset per test
vi.mock("../../../../lib/db/index", () => {
  const make = () => {
    const obj: Record<string, any> = {};
    obj.select = vi.fn(() => obj);
    obj.from = vi.fn(() => obj);
    obj.where = vi.fn(() => obj);
    obj.update = vi.fn(() => obj);
    obj.set = vi.fn(() => obj);
    obj.insert = vi.fn(() => obj);
    obj.values = vi.fn(() => obj);
    obj.returning = vi.fn().mockResolvedValue([]);
    obj.limit = vi.fn(() => obj);
    obj.orderBy = vi.fn().mockResolvedValue([]);
    obj.transaction = vi.fn(async (cb: any) => cb(obj));
    return obj;
  };
  return { db: make() };
});

vi.mock("../../../../lib/db/schema", () => ({
  bookings: {
    organizationId: "organization_id",
    bookingNumber: "booking_number",
  },
  bookingNumberSequences: {
    organizationId: "organization_id",
    nextNumber: "next_number",
    updatedAt: "updated_at",
  },
}));

describe("DS-8p6q: getNextBookingNumber — sequence table", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
  });

  it("uses atomic UPDATE...RETURNING when sequence row exists", async () => {
    // Sequence row found: next_number was 1006 → after increment is 1006
    // booking number = 1006 - 1 = 1005
    (db.returning as Mock).mockResolvedValue([{ nextNumber: 1006 }]);

    const { getNextBookingNumber } = await import("../../../../lib/db/queries/bookings.server");
    const result = await getNextBookingNumber("org1");

    expect(result).toMatch(/^BK-1005-[A-Z0-9]{4}$/);
    expect(db.update).toHaveBeenCalledTimes(1);
    // No insert/select scan when sequence row exists
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns BK-1000-XXXX for first booking (sequence starts at 1000)", async () => {
    // UPDATE returns [] (no sequence row yet)
    // MAX scan returns null (no existing bookings)
    // INSERT sequence row with nextNumber=1001
    (db.returning as Mock)
      .mockResolvedValueOnce([])   // UPDATE returning
      .mockResolvedValueOnce([])   // SELECT scan (mockResolvedValue handles .where chain)
      .mockResolvedValueOnce([{ nextNumber: 1001 }]); // INSERT returning

    // The SELECT .from().where() chain needs to resolve to [{maxNum: null}]
    (db.where as Mock).mockImplementation(() => {
      const result = Promise.resolve([{ maxNum: null }]) as any;
      result.returning = vi.fn().mockResolvedValue([{ nextNumber: 1001 }]);
      return result;
    });

    const { getNextBookingNumber } = await import("../../../../lib/db/queries/bookings.server");
    const result = await getNextBookingNumber("org1");

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
  });

  it("initialises sequence from max existing booking number when no sequence row", async () => {
    // UPDATE returns [] (no sequence row)
    // Existing bookings have max BK-1042
    (db.update as Mock).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    (db.select as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ maxNum: 1042 }]),
      }),
    });

    (db.insert as Mock).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ nextNumber: 1044 }]),
      }),
    });

    const { getNextBookingNumber } = await import("../../../../lib/db/queries/bookings.server");
    const result = await getNextBookingNumber("org1");

    expect(result).toMatch(/^BK-1043-[A-Z0-9]{4}$/);
  });

  it("does NOT scan all bookings when sequence row exists", async () => {
    // Reset to shared mock pattern
    db.update = vi.fn(() => db);
    db.set = vi.fn(() => db);
    db.where = vi.fn(() => db);
    db.returning = vi.fn().mockResolvedValue([{ nextNumber: 2000 }]);
    db.insert = vi.fn(() => db);
    db.values = vi.fn(() => db);

    const { getNextBookingNumber } = await import("../../../../lib/db/queries/bookings.server");
    await getNextBookingNumber("org1");

    // insert (fallback) should not be called on the sequence fast path
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("output always matches BK-NNNN-XXXX format", async () => {
    (db.returning as Mock).mockResolvedValue([{ nextNumber: 9999 }]);

    const { getNextBookingNumber } = await import("../../../../lib/db/queries/bookings.server");
    const result = await getNextBookingNumber("org1");

    expect(result).toMatch(/^BK-\d{4,}-[A-Z0-9]{4}$/);
  });

  it("works when a transaction dbInstance is passed", async () => {
    const txMock: Record<string, any> = {};
    txMock.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ nextNumber: 1001 }]),
        }),
      }),
    });

    const { getNextBookingNumber } = await import("../../../../lib/db/queries/bookings.server");
    const result = await getNextBookingNumber("org1", txMock as any);

    expect(result).toMatch(/^BK-1000-[A-Z0-9]{4}$/);
    expect(txMock.update).toHaveBeenCalledTimes(1);
  });
});
