/**
 * DS-0i8w: Training course deposit validation tests
 *
 * Verifies that depositRequired=true cannot be saved with depositAmount=null.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Create a DB mock chain
let mockReturnValue: unknown[] = [];
const createDbMock = () => {
  const chain: Record<string, unknown> = {};
  chain.then = (resolve: (value: unknown[]) => void) => { resolve(mockReturnValue); return chain; };
  chain.catch = () => chain;
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve([{ id: "new-id", organizationId: "org-1", name: "Test Course" }]));
  chain.transaction = vi.fn(async (callback: any) => callback(chain));
  chain.execute = vi.fn(async () => []);
  return chain;
};

const dbMock = createDbMock();

vi.mock("../../../../lib/db", () => ({ db: dbMock }));

vi.mock("../../../../lib/db/schema", () => {
  const fields = (prefix: string) =>
    new Proxy({}, { get: (_, prop) => `${prefix}.${String(prop)}` });
  return {
    trainingCourses: fields("trainingCourses"),
    trainingSessions: fields("trainingSessions"),
    trainingEnrollments: fields("trainingEnrollments"),
    certificationAgencies: fields("certificationAgencies"),
    certificationLevels: fields("certificationLevels"),
    agencyCourseTemplates: fields("agencyCourseTemplates"),
  };
});

vi.mock("../../../../lib/db/training-templates.server", () => ({
  AGENCY_METADATA: { padi: { name: "PADI" } },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", conditions: args })),
  sql: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
}));

describe("DS-0i8w: deposit validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturnValue = [];
  });

  it("createCourse throws when depositRequired=true and depositAmount is null", async () => {
    const { createCourse } = await import("../../../../lib/db/training.server");
    await expect(
      createCourse({
        organizationId: "org-1",
        name: "Test Course",
        price: "500.00",
        depositRequired: true,
        depositAmount: null as unknown as string,
      } as any)
    ).rejects.toThrow("Deposit amount must be greater than 0 when deposit is required");
  });

  it("createCourse throws when depositRequired=true and depositAmount is 0", async () => {
    const { createCourse } = await import("../../../../lib/db/training.server");
    await expect(
      createCourse({
        organizationId: "org-1",
        name: "Test Course",
        price: "500.00",
        depositRequired: true,
        depositAmount: "0",
      } as any)
    ).rejects.toThrow("Deposit amount must be greater than 0 when deposit is required");
  });

  it("createCourse throws when depositRequired=true and depositAmount is empty string", async () => {
    const { createCourse } = await import("../../../../lib/db/training.server");
    await expect(
      createCourse({
        organizationId: "org-1",
        name: "Test Course",
        price: "500.00",
        depositRequired: true,
        depositAmount: "",
      } as any)
    ).rejects.toThrow("Deposit amount must be greater than 0 when deposit is required");
  });

  it("createCourse succeeds when depositRequired=true and depositAmount > 0", async () => {
    const { createCourse } = await import("../../../../lib/db/training.server");
    // Should not throw
    const result = await createCourse({
      organizationId: "org-1",
      name: "Test Course",
      price: "500.00",
      depositRequired: true,
      depositAmount: "100.00",
    } as any);
    expect(result).toBeDefined();
  });

  it("createCourse succeeds when depositRequired=false and depositAmount is null", async () => {
    const { createCourse } = await import("../../../../lib/db/training.server");
    const result = await createCourse({
      organizationId: "org-1",
      name: "Test Course",
      price: "500.00",
      depositRequired: false,
    } as any);
    expect(result).toBeDefined();
  });

  it("updateCourse throws when depositRequired=true and depositAmount is null", async () => {
    const { updateCourse } = await import("../../../../lib/db/training.server");
    await expect(
      updateCourse("org-1", "course-1", {
        depositRequired: true,
        depositAmount: null,
      })
    ).rejects.toThrow("Deposit amount must be greater than 0 when deposit is required");
  });

  it("updateCourse succeeds when depositRequired=true and depositAmount > 0", async () => {
    const { updateCourse } = await import("../../../../lib/db/training.server");
    mockReturnValue = [{ id: "course-1" }];
    const result = await updateCourse("org-1", "course-1", {
      depositRequired: true,
      depositAmount: "50.00",
    });
    expect(result).toBeDefined();
  });
});
