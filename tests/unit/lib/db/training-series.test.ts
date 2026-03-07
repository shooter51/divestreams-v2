/**
 * Training Series Server Database Functions Tests
 *
 * Tests for the series-related training module database operations.
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
    obj.innerJoin = vi.fn(() => obj);
    obj.leftJoin = vi.fn(() => obj);
    obj.insert = vi.fn(() => obj);
    obj.values = vi.fn(() => obj);
    obj.returning = vi.fn().mockResolvedValue([{ id: "new-id" }]);
    obj.update = vi.fn(() => obj);
    obj.set = vi.fn(() => obj);
    obj.delete = vi.fn(() => obj);
    obj.groupBy = vi.fn(() => obj);
    obj.orderBy = vi.fn(() => obj);
    obj.limit = vi.fn(() => obj);
    obj.offset = vi.fn(() => obj);
    obj.for = vi.fn().mockResolvedValue([]);
    obj.execute = vi.fn().mockResolvedValue([]);
    obj.transaction = vi.fn(async (cb: any) => cb(obj));
    // Promise-like: when awaited directly
    obj.then = (resolve: (v: any) => void) => Promise.resolve([]).then(resolve);
    return obj;
  };
  return { db: make() };
});

// ============================================================================
// getSeriesList
// ============================================================================

describe("getSeriesList", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
  });

  it("returns series list with joins", async () => {
    const mockRows = [
      { id: "series-1", name: "OW Series", status: "scheduled", courseId: "course-1", courseName: "OW Course" },
      { id: "series-2", name: "AOW Series", status: "in_progress", courseId: "course-2", courseName: "AOW Course" },
    ];
    (db.orderBy as Mock).mockResolvedValue(mockRows);

    const { getSeriesList } = await import("../../../../lib/db/training.server");
    const result = await getSeriesList("org-1");

    expect(result).toHaveLength(2);
    expect(db.select).toHaveBeenCalled();
    expect(db.from).toHaveBeenCalled();
    expect(db.innerJoin).toHaveBeenCalled();
    expect(db.where).toHaveBeenCalled();
    expect(db.orderBy).toHaveBeenCalled();
  });

  it("filters by courseId", async () => {
    (db.orderBy as Mock).mockResolvedValue([{ id: "series-1", courseId: "course-1" }]);

    const { getSeriesList } = await import("../../../../lib/db/training.server");
    await getSeriesList("org-1", { courseId: "course-1" });

    expect(db.where).toHaveBeenCalled();
  });

  it("filters by status", async () => {
    (db.orderBy as Mock).mockResolvedValue([]);

    const { getSeriesList } = await import("../../../../lib/db/training.server");
    await getSeriesList("org-1", { status: "scheduled" });

    expect(db.where).toHaveBeenCalled();
  });
});

// ============================================================================
// getSeriesById
// ============================================================================

describe("getSeriesById", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
  });

  it("returns series with ordered sessions", async () => {
    const seriesRow = { id: "series-1", name: "OW Series", courseId: "course-1" };
    const sessionRows = [
      { id: "sess-1", seriesIndex: 1 },
      { id: "sess-2", seriesIndex: 2 },
    ];

    // First .where() returns series, second .orderBy() returns sessions
    let callCount = 0;
    (db.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([seriesRow]);
      return db;
    });
    (db.orderBy as Mock).mockResolvedValue(sessionRows);

    const { getSeriesById } = await import("../../../../lib/db/training.server");
    const result = await getSeriesById("org-1", "series-1");

    expect(result).toBeDefined();
    expect(result?.id).toBe("series-1");
    expect(result?.sessions).toHaveLength(2);
    expect(result?.sessions[0].seriesIndex).toBe(1);
  });

  it("returns undefined when series not found", async () => {
    (db.where as Mock).mockResolvedValue([]);

    const { getSeriesById } = await import("../../../../lib/db/training.server");
    const result = await getSeriesById("org-1", "nonexistent");

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// createSeries
// ============================================================================

describe("createSeries", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
  });

  it("inserts series and returns it", async () => {
    const seriesRow = { id: "series-1", name: "OW Series", courseId: "course-1" };
    (db.returning as Mock).mockResolvedValue([seriesRow]);

    const { createSeries } = await import("../../../../lib/db/training.server");
    const result = await createSeries({
      organizationId: "org-1",
      courseId: "course-1",
      name: "OW Series",
    });

    expect(result).toEqual(seriesRow);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalled();
  });

  it("inserts child sessions atomically with 1-based seriesIndex", async () => {
    const seriesRow = { id: "series-1", name: "OW Series", courseId: "course-1" };
    (db.returning as Mock).mockResolvedValue([seriesRow]);

    const { createSeries } = await import("../../../../lib/db/training.server");
    await createSeries({
      organizationId: "org-1",
      courseId: "course-1",
      name: "OW Series",
      sessions: [
        { startDate: "2026-04-01", sessionType: "classroom" },
        { startDate: "2026-04-02", sessionType: "pool" },
        { startDate: "2026-04-03", sessionType: "open_water" },
      ],
    });

    // transaction used, insert called multiple times (series + 3 sessions)
    expect(db.transaction).toHaveBeenCalledTimes(1);
    // insert called for series + each session
    expect((db.insert as Mock).mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("creates series with no sessions when sessions array is empty", async () => {
    const seriesRow = { id: "series-1", name: "OW Series", courseId: "course-1" };
    (db.returning as Mock).mockResolvedValue([seriesRow]);

    const { createSeries } = await import("../../../../lib/db/training.server");
    await createSeries({
      organizationId: "org-1",
      courseId: "course-1",
      name: "OW Series",
      sessions: [],
    });

    // Only series insert, no session inserts
    expect((db.insert as Mock).mock.calls.length).toBe(1);
  });
});

// ============================================================================
// updateSeries
// ============================================================================

describe("updateSeries", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
    // Reset all mock implementations to chain defaults
    (db.select as Mock).mockReturnValue(db);
    (db.from as Mock).mockReturnValue(db);
    (db.where as Mock).mockReturnValue(db);
    (db.innerJoin as Mock).mockReturnValue(db);
    (db.leftJoin as Mock).mockReturnValue(db);
    (db.insert as Mock).mockReturnValue(db);
    (db.values as Mock).mockReturnValue(db);
    (db.update as Mock).mockReturnValue(db);
    (db.set as Mock).mockReturnValue(db);
    (db.delete as Mock).mockReturnValue(db);
    (db.orderBy as Mock).mockReturnValue(db);
    (db.limit as Mock).mockReturnValue(db);
  });

  it("updates series metadata", async () => {
    (db.where as Mock).mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "series-1", name: "Updated Name" }]) });

    const { updateSeries } = await import("../../../../lib/db/training.server");
    const result = await updateSeries("org-1", "series-1", { name: "Updated Name" });

    expect(result.name).toBe("Updated Name");
    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalled();
  });
});

// ============================================================================
// deleteSeries
// ============================================================================

describe("deleteSeries", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
  });

  it("deletes series when no enrollments exist", async () => {
    // Count query returns 0
    (db.where as Mock).mockResolvedValue([{ enrollmentCount: 0 }]);

    const { deleteSeries } = await import("../../../../lib/db/training.server");
    await deleteSeries("org-1", "series-1");

    expect(db.delete).toHaveBeenCalled();
  });

  it("throws when enrollments exist", async () => {
    // Count query returns 2
    (db.where as Mock).mockResolvedValue([{ enrollmentCount: 2 }]);

    const { deleteSeries } = await import("../../../../lib/db/training.server");
    await expect(deleteSeries("org-1", "series-1")).rejects.toThrow(
      "Cannot delete series with existing enrollments"
    );

    expect(db.delete).not.toHaveBeenCalled();
  });
});

// ============================================================================
// addSessionToSeries
// ============================================================================

describe("addSessionToSeries", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
  });

  it("appends session with seriesIndex = max + 1", async () => {
    let callCount = 0;
    (db.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([{ courseId: "course-1" }]); // series lookup
      return Promise.resolve([{ maxIndex: 2 }]); // max seriesIndex
    });

    (db.returning as Mock).mockResolvedValue([{ id: "sess-3", seriesIndex: 3 }]);

    const { addSessionToSeries } = await import("../../../../lib/db/training.server");
    const result = await addSessionToSeries("org-1", "series-1", {
      startDate: "2026-04-10",
      sessionType: "open_water",
    });

    expect(result.seriesIndex).toBe(3);
    expect(db.insert).toHaveBeenCalled();
  });

  it("uses seriesIndex = 1 when no sessions exist yet", async () => {
    let callCount = 0;
    (db.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([{ courseId: "course-1" }]);
      return Promise.resolve([{ maxIndex: null }]); // no sessions yet
    });

    (db.returning as Mock).mockResolvedValue([{ id: "sess-1", seriesIndex: 1 }]);

    const { addSessionToSeries } = await import("../../../../lib/db/training.server");
    const result = await addSessionToSeries("org-1", "series-1", { startDate: "2026-04-01" });

    expect(result.seriesIndex).toBe(1);
  });

  it("throws when series not found", async () => {
    (db.where as Mock).mockResolvedValue([]); // series not found

    const { addSessionToSeries } = await import("../../../../lib/db/training.server");
    await expect(
      addSessionToSeries("org-1", "nonexistent", { startDate: "2026-04-01" })
    ).rejects.toThrow("Series not found");
  });
});

// ============================================================================
// removeSessionFromSeries
// ============================================================================

describe("removeSessionFromSeries", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
  });

  it("deletes session and reindexes remaining sessions", async () => {
    let callCount = 0;
    (db.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([{ seriesId: "series-1", seriesIndex: 2 }]);
      return db; // subsequent delete and update
    });

    const { removeSessionFromSeries } = await import("../../../../lib/db/training.server");
    await removeSessionFromSeries("org-1", "sess-2");

    expect(db.delete).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it("throws when session not found", async () => {
    (db.where as Mock).mockResolvedValue([]);

    const { removeSessionFromSeries } = await import("../../../../lib/db/training.server");
    await expect(removeSessionFromSeries("org-1", "nonexistent")).rejects.toThrow(
      "Session not found or not part of a series"
    );
  });

  it("throws when session has no seriesId", async () => {
    (db.where as Mock).mockResolvedValue([{ seriesId: null, seriesIndex: 1 }]);

    const { removeSessionFromSeries } = await import("../../../../lib/db/training.server");
    await expect(removeSessionFromSeries("org-1", "sess-standalone")).rejects.toThrow(
      "Session not found or not part of a series"
    );
  });
});

// ============================================================================
// createSeriesEnrollment
// ============================================================================

describe("createSeriesEnrollment", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
  });

  it("creates enrollment when series has capacity", async () => {
    const forMock = vi.fn().mockResolvedValue([
      { id: "series-1", status: "scheduled", maxStudents: 10, enrolledCount: 3 },
    ]);
    let callCount = 0;
    (db.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { for: forMock }; // series FOR UPDATE
      return Promise.resolve([]); // no existing enrollment
    });

    (db.returning as Mock).mockResolvedValue([
      { id: "enroll-1", seriesId: "series-1", customerId: "cust-1" },
    ]);

    const { createSeriesEnrollment } = await import("../../../../lib/db/training.server");
    const result = await createSeriesEnrollment({
      organizationId: "org-1",
      seriesId: "series-1",
      sessionId: "sess-1",
      customerId: "cust-1",
    });

    expect(result.id).toBe("enroll-1");
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(forMock).toHaveBeenCalledWith("update");
  });

  it("throws when series not found", async () => {
    const forMock = vi.fn().mockResolvedValue([]);
    (db.where as Mock).mockReturnValue({ for: forMock });

    const { createSeriesEnrollment } = await import("../../../../lib/db/training.server");
    await expect(
      createSeriesEnrollment({
        organizationId: "org-1",
        seriesId: "nonexistent",
        sessionId: "sess-1",
        customerId: "cust-1",
      })
    ).rejects.toThrow("Series not found");

    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it("throws when series is cancelled", async () => {
    const forMock = vi.fn().mockResolvedValue([
      { id: "series-1", status: "cancelled", maxStudents: 10, enrolledCount: 0 },
    ]);
    (db.where as Mock).mockReturnValue({ for: forMock });

    const { createSeriesEnrollment } = await import("../../../../lib/db/training.server");
    await expect(
      createSeriesEnrollment({
        organizationId: "org-1",
        seriesId: "series-1",
        sessionId: "sess-1",
        customerId: "cust-1",
      })
    ).rejects.toThrow("Cannot enroll in a cancelled series");
  });

  it("throws when series is at capacity", async () => {
    const forMock = vi.fn().mockResolvedValue([
      { id: "series-1", status: "scheduled", maxStudents: 5, enrolledCount: 5 },
    ]);
    (db.where as Mock).mockReturnValue({ for: forMock });

    const { createSeriesEnrollment } = await import("../../../../lib/db/training.server");
    await expect(
      createSeriesEnrollment({
        organizationId: "org-1",
        seriesId: "series-1",
        sessionId: "sess-1",
        customerId: "cust-1",
      })
    ).rejects.toThrow(/full/i);
  });

  it("throws when customer already enrolled in series", async () => {
    const forMock = vi.fn().mockResolvedValue([
      { id: "series-1", status: "scheduled", maxStudents: 10, enrolledCount: 2 },
    ]);
    let callCount = 0;
    (db.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { for: forMock };
      return Promise.resolve([{ id: "existing-enroll" }]); // duplicate found
    });

    const { createSeriesEnrollment } = await import("../../../../lib/db/training.server");
    await expect(
      createSeriesEnrollment({
        organizationId: "org-1",
        seriesId: "series-1",
        sessionId: "sess-1",
        customerId: "cust-1",
      })
    ).rejects.toThrow("Customer is already enrolled in this series");
  });

  it("uses SELECT FOR UPDATE on series row", async () => {
    const forMock = vi.fn().mockResolvedValue([
      { id: "series-1", status: "scheduled", maxStudents: 10, enrolledCount: 0 },
    ]);
    let callCount = 0;
    (db.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { for: forMock };
      return Promise.resolve([]); // no duplicate
    });
    (db.returning as Mock).mockResolvedValue([{ id: "enroll-1" }]);

    const { createSeriesEnrollment } = await import("../../../../lib/db/training.server");
    await createSeriesEnrollment({
      organizationId: "org-1",
      seriesId: "series-1",
      sessionId: "sess-1",
      customerId: "cust-1",
    });

    expect(forMock).toHaveBeenCalledWith("update");
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it("increments series enrolledCount after enrollment", async () => {
    const forMock = vi.fn().mockResolvedValue([
      { id: "series-1", status: "scheduled", maxStudents: 10, enrolledCount: 2 },
    ]);
    let callCount = 0;
    (db.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { for: forMock };
      return Promise.resolve([]);
    });
    (db.returning as Mock).mockResolvedValue([{ id: "enroll-1" }]);

    const { createSeriesEnrollment } = await import("../../../../lib/db/training.server");
    await createSeriesEnrollment({
      organizationId: "org-1",
      seriesId: "series-1",
      sessionId: "sess-1",
      customerId: "cust-1",
    });

    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalled();
  });
});

// ============================================================================
// Modified getSessions — seriesId, seriesIndex, sessionType in select
// ============================================================================

describe("getSessions - series fields", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
    // Reset all mock implementations to chain defaults
    (db.select as Mock).mockReturnValue(db);
    (db.from as Mock).mockReturnValue(db);
    (db.where as Mock).mockReturnValue(db);
    (db.innerJoin as Mock).mockReturnValue(db);
    (db.leftJoin as Mock).mockReturnValue(db);
    (db.insert as Mock).mockReturnValue(db);
    (db.values as Mock).mockReturnValue(db);
    (db.update as Mock).mockReturnValue(db);
    (db.set as Mock).mockReturnValue(db);
    (db.delete as Mock).mockReturnValue(db);
    (db.orderBy as Mock).mockReturnValue(db);
    (db.limit as Mock).mockReturnValue(db);
  });

  it("includes seriesId, seriesIndex, sessionType in results", async () => {
    const mockRows = [
      { id: "sess-1", seriesId: "series-1", seriesIndex: 1, sessionType: "classroom" },
    ];
    (db.orderBy as Mock).mockResolvedValue(mockRows);

    const { getSessions } = await import("../../../../lib/db/training.server");
    const result = await getSessions("org-1");

    expect(result).toHaveLength(1);
    expect(db.select).toHaveBeenCalled();
  });

  it("filters by seriesId is available via getEnrollments", async () => {
    (db.orderBy as Mock).mockResolvedValue([]);

    const { getEnrollments } = await import("../../../../lib/db/training.server");
    await getEnrollments("org-1", { seriesId: "series-1" });

    expect(db.where).toHaveBeenCalled();
  });
});

// ============================================================================
// getSessionById — series fields and join
// ============================================================================

describe("getSessionById - series fields", () => {
  let db: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../../../../lib/db/index");
    db = mod.db as unknown as Record<string, any>;
  });

  it("includes seriesName via leftJoin on trainingSessionSeries", async () => {
    (db.where as Mock).mockResolvedValue([
      {
        id: "sess-1",
        seriesId: "series-1",
        seriesIndex: 2,
        sessionType: "pool",
        seriesName: "OW Series",
      },
    ]);

    const { getSessionById } = await import("../../../../lib/db/training.server");
    const result = await getSessionById("org-1", "sess-1");

    expect(result?.id).toBe("sess-1");
    // leftJoin called at least 3 times (agencies, levels, series)
    expect((db.leftJoin as Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
