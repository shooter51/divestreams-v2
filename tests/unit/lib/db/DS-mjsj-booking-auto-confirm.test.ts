/**
 * DS-mjsj: Auto-confirm booking status when fully paid
 *
 * When a payment is recorded that brings paidAmount >= total,
 * booking status should automatically update to 'confirmed' (if currently 'pending').
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Fluent chain for select inside transaction
const txSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  for: vi.fn(),
};

// Fluent chain for insert inside transaction
const txInsertChain = {
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

// Fluent chain for update inside transaction
const txUpdateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
};

const tx = {
  select: vi.fn(() => txSelectChain),
  insert: vi.fn(() => txInsertChain),
  update: vi.fn(() => txUpdateChain),
};

const dbMock = {
  transaction: vi.fn((fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
};

vi.mock("../../../../lib/db", () => ({ db: dbMock }));
vi.mock("../../../../lib/db/index", () => ({ db: dbMock }));

vi.mock("../../../../lib/db/schema", () => ({
  bookings: {
    id: "id",
    organizationId: "organizationId",
    total: "total",
    paidAmount: "paidAmount",
    status: "status",
    paymentStatus: "paymentStatus",
    updatedAt: "updatedAt",
  },
  transactions: {
    organizationId: "organizationId",
    bookingId: "bookingId",
    type: "type",
    amount: "amount",
    paymentMethod: "paymentMethod",
    notes: "notes",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args) => ({ type: "and", args })),
  eq: vi.fn((col, val) => ({ type: "eq", col, val })),
}));

describe("DS-mjsj: recordPayment auto-confirms booking when fully paid", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset chain mocks
    txSelectChain.from.mockReturnThis();
    txSelectChain.where.mockReturnThis();
    txInsertChain.values.mockReturnThis();
    txUpdateChain.set.mockReturnThis();
    txUpdateChain.where.mockResolvedValue(undefined);

    tx.select.mockReturnValue(txSelectChain);
    tx.insert.mockReturnValue(txInsertChain);
    tx.update.mockReturnValue(txUpdateChain);
  });

  it("updates booking status to confirmed when full payment is recorded on a pending booking", async () => {
    // Booking total=$100, already paid=$0, status=pending
    txSelectChain.for = vi.fn().mockResolvedValue([
      { total: "100.00", paidAmount: "0", status: "pending" },
    ]);
    txInsertChain.returning = vi.fn().mockResolvedValue([
      { id: "txn-1", amount: "100.00", paymentMethod: "cash" },
    ]);

    const { recordPayment } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    await recordPayment("org-1", {
      bookingId: "booking-1",
      amount: 100,
      paymentMethod: "cash",
    });

    // The update call should have been made
    expect(tx.update).toHaveBeenCalled();
    const setCall = txUpdateChain.set.mock.calls[0][0];

    // paymentStatus should be 'paid'
    expect(setCall.paymentStatus).toBe("paid");
    // status should be updated to 'confirmed'
    expect(setCall.status).toBe("confirmed");
  });

  it("does not change status when payment is partial", async () => {
    // Booking total=$100, already paid=$0, status=pending — paying only $50
    txSelectChain.for = vi.fn().mockResolvedValue([
      { total: "100.00", paidAmount: "0", status: "pending" },
    ]);
    txInsertChain.returning = vi.fn().mockResolvedValue([
      { id: "txn-2", amount: "50.00", paymentMethod: "cash" },
    ]);

    const { recordPayment } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    await recordPayment("org-1", {
      bookingId: "booking-2",
      amount: 50,
      paymentMethod: "cash",
    });

    const setCall = txUpdateChain.set.mock.calls[0][0];

    // paymentStatus should be 'partial'
    expect(setCall.paymentStatus).toBe("partial");
    // status should NOT be 'confirmed'
    expect(setCall.status).not.toBe("confirmed");
  });

  it("does not change status when booking is already confirmed", async () => {
    // Booking total=$100, paid=$50 already, status=confirmed — paying remaining $50
    txSelectChain.for = vi.fn().mockResolvedValue([
      { total: "100.00", paidAmount: "50.00", status: "confirmed" },
    ]);
    txInsertChain.returning = vi.fn().mockResolvedValue([
      { id: "txn-3", amount: "50.00", paymentMethod: "card" },
    ]);

    const { recordPayment } = await import(
      "../../../../lib/db/queries/bookings.server"
    );

    await recordPayment("org-1", {
      bookingId: "booking-3",
      amount: 50,
      paymentMethod: "card",
    });

    const setCall = txUpdateChain.set.mock.calls[0][0];

    // paymentStatus becomes 'paid'
    expect(setCall.paymentStatus).toBe("paid");
    // status should remain undefined (not changed) for already-confirmed bookings
    expect(setCall.status).toBeUndefined();
  });
});
