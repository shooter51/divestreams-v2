/**
 * Unit tests for training template merge logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../lib/logger", () => ({
  dbLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock the database transaction
const mockTransaction = vi.fn();
vi.mock("../../../../lib/db", () => ({
  db: {
    transaction: mockTransaction,
  },
}));

describe("mergeTemplateUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return { updated: 0 } when no courses need updating", async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const mockTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      return fn(mockTx);
    });

    const { mergeTemplateUpdates } = await import(
      "../../../../lib/training/merge-templates.server"
    );

    const result = await mergeTemplateUpdates("org-1");
    expect(result).toEqual({ updated: 0 });
  });

  it("should throw and log error when transaction fails", async () => {
    mockTransaction.mockRejectedValue(new Error("DB connection failed"));

    const { mergeTemplateUpdates } = await import(
      "../../../../lib/training/merge-templates.server"
    );
    const { dbLogger } = await import("../../../../lib/logger");

    await expect(mergeTemplateUpdates("org-1")).rejects.toThrow("Template merge failed");
    expect(dbLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1" }),
      "Failed to merge template updates"
    );
  });
});
