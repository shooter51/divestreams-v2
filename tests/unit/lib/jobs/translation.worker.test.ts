import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTranslateText = vi.fn();
const mockUpsertContentTranslation = vi.fn();
const mockDbSelect = vi.fn();

vi.mock("../../../../lib/translation/bedrock.server", () => ({
  translateText: mockTranslateText,
}));

vi.mock("../../../../lib/db/translations.server", () => ({
  upsertContentTranslation: mockUpsertContentTranslation,
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockDbSelect,
        }),
      }),
    }),
  },
}));

vi.mock("../../../../lib/db/schema/translations", () => ({
  contentTranslations: {
    organizationId: "organizationId",
    entityType: "entityType",
    entityId: "entityId",
    locale: "locale",
    field: "field",
    source: "source",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

// Use class syntax so it can be used as a constructor
vi.mock("bullmq", () => {
  class MockWorker {
    _processor: (job: { data: unknown }) => Promise<void>;
    constructor(
      _queue: string,
      processor: (job: { data: unknown }) => Promise<void>
    ) {
      this._processor = processor;
    }
    on = vi.fn();
    close = vi.fn();
  }
  return { Worker: MockWorker };
});

vi.mock("../../../../lib/jobs/index", () => ({
  QUEUES: { TRANSLATION: "translation" },
}));

vi.mock("../../../../lib/logger", () => ({
  jobLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

interface WorkerWithProcessor {
  _processor: (job: { data: unknown }) => Promise<void>;
}

describe("translation worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("translates all fields and calls upsertContentTranslation", async () => {
    // No existing manual translation
    mockDbSelect.mockResolvedValue([]);
    mockTranslateText.mockResolvedValue("Texto traducido");

    const { createTranslationWorker } = await import(
      "../../../../lib/jobs/translation.worker"
    );

    const worker = createTranslationWorker({} as never) as unknown as WorkerWithProcessor;

    await worker._processor({
      data: {
        orgId: "org-1",
        entityType: "tour",
        entityId: "tour-1",
        targetLocale: "es",
        fields: [
          { field: "name", text: "Ocean Adventure" },
          { field: "description", text: "A great tour" },
        ],
      },
    });

    expect(mockTranslateText).toHaveBeenCalledTimes(2);
    expect(mockUpsertContentTranslation).toHaveBeenCalledTimes(2);
    expect(mockUpsertContentTranslation).toHaveBeenCalledWith(
      "org-1",
      "tour",
      "tour-1",
      "es",
      "name",
      "Texto traducido",
      "auto"
    );
  });

  it("skips fields with empty text", async () => {
    mockDbSelect.mockResolvedValue([]);
    mockTranslateText.mockResolvedValue("Traducido");

    const { createTranslationWorker } = await import(
      "../../../../lib/jobs/translation.worker"
    );

    const worker = createTranslationWorker({} as never) as unknown as WorkerWithProcessor;

    await worker._processor({
      data: {
        orgId: "org-1",
        entityType: "tour",
        entityId: "tour-1",
        targetLocale: "es",
        fields: [
          { field: "name", text: "Real Name" },
          { field: "description", text: "" },
        ],
      },
    });

    expect(mockTranslateText).toHaveBeenCalledTimes(1);
    expect(mockUpsertContentTranslation).toHaveBeenCalledTimes(1);
  });

  it("skips fields that have an existing manual translation", async () => {
    mockDbSelect
      .mockResolvedValueOnce([{ source: "manual" }])
      .mockResolvedValueOnce([]);

    mockTranslateText.mockResolvedValue("Auto traducido");

    const { createTranslationWorker } = await import(
      "../../../../lib/jobs/translation.worker"
    );

    const worker = createTranslationWorker({} as never) as unknown as WorkerWithProcessor;

    await worker._processor({
      data: {
        orgId: "org-1",
        entityType: "tour",
        entityId: "tour-1",
        targetLocale: "es",
        fields: [
          { field: "name", text: "Tour Name" },
          { field: "description", text: "Tour Description" },
        ],
      },
    });

    // Only description translated (name has manual override)
    expect(mockTranslateText).toHaveBeenCalledTimes(1);
    expect(mockUpsertContentTranslation).toHaveBeenCalledTimes(1);
    expect(mockUpsertContentTranslation).toHaveBeenCalledWith(
      "org-1",
      "tour",
      "tour-1",
      "es",
      "description",
      "Auto traducido",
      "auto"
    );
  });
});
