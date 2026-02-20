import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock setup
// ============================================================================

const mockSelectResult = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateReturning = vi.fn();

const buildSelectChain = () => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockImplementation(() => mockSelectResult()),
    }),
  }),
});

const buildInsertChain = () => ({
  values: vi.fn().mockReturnValue({
    returning: mockInsertReturning,
  }),
});

const buildUpdateChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: mockUpdateReturning,
    }),
  }),
});

let selectChain = buildSelectChain();
let insertChain = buildInsertChain();
let updateChain = buildUpdateChain();

vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
  },
}));

vi.mock("../../../../lib/db/schema/onboarding", () => ({
  onboardingProgress: {
    userId: "userId",
    completedTasks: "completedTasks",
    dismissed: "dismissed",
    dismissedAt: "dismissedAt",
    currentSection: "currentSection",
    tourCompleted: "tourCompleted",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
}));

describe("onboarding.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain = buildSelectChain();
    insertChain = buildInsertChain();
    updateChain = buildUpdateChain();
  });

  describe("getOnboardingProgress", () => {
    it("returns null when no progress found", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { getOnboardingProgress } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await getOnboardingProgress("user-1");
      expect(result).toBeNull();
    });

    it("returns existing progress", async () => {
      const mockProgress = {
        userId: "user-1",
        completedTasks: ["task-1"],
        dismissed: false,
      };
      mockSelectResult.mockResolvedValue([mockProgress]);

      const { getOnboardingProgress } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await getOnboardingProgress("user-1");
      expect(result).toEqual(mockProgress);
    });
  });

  describe("getOrCreateOnboardingProgress", () => {
    it("returns existing progress if found", async () => {
      const mockProgress = { userId: "user-1", completedTasks: [] };
      mockSelectResult.mockResolvedValue([mockProgress]);

      const { getOrCreateOnboardingProgress } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await getOrCreateOnboardingProgress("user-1");
      expect(result).toEqual(mockProgress);
    });

    it("creates new progress if none exists", async () => {
      const newProgress = { userId: "user-1", completedTasks: [] };
      mockSelectResult.mockResolvedValue([]);
      mockInsertReturning.mockResolvedValue([newProgress]);

      const { getOrCreateOnboardingProgress } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await getOrCreateOnboardingProgress("user-1");
      expect(result).toEqual(newProgress);
    });
  });

  describe("markTaskComplete", () => {
    it("adds task to completed list", async () => {
      const existing = { userId: "user-1", completedTasks: ["task-1"] };
      const updated = { userId: "user-1", completedTasks: ["task-1", "task-2"] };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { markTaskComplete } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await markTaskComplete("user-1", "task-2");
      expect(result).toEqual(updated);
    });

    it("does not duplicate task if already completed", async () => {
      const existing = { userId: "user-1", completedTasks: ["task-1"] };
      const updated = { userId: "user-1", completedTasks: ["task-1"] };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { markTaskComplete } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await markTaskComplete("user-1", "task-1");
      expect(result.completedTasks).toEqual(["task-1"]);
    });

    it("handles null completedTasks", async () => {
      const existing = { userId: "user-1", completedTasks: null };
      const updated = { userId: "user-1", completedTasks: ["task-1"] };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { markTaskComplete } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await markTaskComplete("user-1", "task-1");
      expect(result).toEqual(updated);
    });
  });

  describe("markTaskIncomplete", () => {
    it("removes task from completed list", async () => {
      const existing = { userId: "user-1", completedTasks: ["task-1", "task-2"] };
      const updated = { userId: "user-1", completedTasks: ["task-1"] };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { markTaskIncomplete } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await markTaskIncomplete("user-1", "task-2");
      expect(result).toEqual(updated);
    });
  });

  describe("dismissOnboarding", () => {
    it("sets dismissed to true", async () => {
      const existing = { userId: "user-1", dismissed: false };
      const updated = { userId: "user-1", dismissed: true, dismissedAt: new Date() };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { dismissOnboarding } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await dismissOnboarding("user-1");
      expect(result.dismissed).toBe(true);
    });
  });

  describe("undismissOnboarding", () => {
    it("sets dismissed to false", async () => {
      const updated = { userId: "user-1", dismissed: false, dismissedAt: null };
      mockUpdateReturning.mockResolvedValue([updated]);

      const { undismissOnboarding } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await undismissOnboarding("user-1");
      expect(result.dismissed).toBe(false);
      expect(result.dismissedAt).toBeNull();
    });
  });

  describe("markTourCompleted", () => {
    it("sets tourCompleted to true", async () => {
      const existing = { userId: "user-1", tourCompleted: false };
      const updated = { userId: "user-1", tourCompleted: true };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { markTourCompleted } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await markTourCompleted("user-1");
      expect(result.tourCompleted).toBe(true);
    });
  });

  describe("updateCurrentSection", () => {
    it("updates current section", async () => {
      const existing = { userId: "user-1", currentSection: null };
      const updated = { userId: "user-1", currentSection: "dashboard" };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { updateCurrentSection } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await updateCurrentSection("user-1", "dashboard");
      expect(result.currentSection).toBe("dashboard");
    });

    it("allows setting section to null", async () => {
      const existing = { userId: "user-1", currentSection: "dashboard" };
      const updated = { userId: "user-1", currentSection: null };
      mockSelectResult.mockResolvedValue([existing]);
      mockUpdateReturning.mockResolvedValue([updated]);

      const { updateCurrentSection } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await updateCurrentSection("user-1", null);
      expect(result.currentSection).toBeNull();
    });
  });

  describe("resetOnboardingProgress", () => {
    it("resets all progress fields", async () => {
      const updated = {
        userId: "user-1",
        completedTasks: [],
        dismissed: false,
        dismissedAt: null,
        currentSection: null,
        tourCompleted: false,
      };
      mockUpdateReturning.mockResolvedValue([updated]);

      const { resetOnboardingProgress } = await import(
        "../../../../lib/db/onboarding.server"
      );
      const result = await resetOnboardingProgress("user-1");
      expect(result.completedTasks).toEqual([]);
      expect(result.dismissed).toBe(false);
      expect(result.currentSection).toBeNull();
      expect(result.tourCompleted).toBe(false);
    });
  });
});
