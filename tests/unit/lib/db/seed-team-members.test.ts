import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock setup
// ============================================================================

const mockSelectResult = vi.fn();
const mockInsertReturning = vi.fn();
const mockDeleteReturning = vi.fn();

const buildSelectChain = () => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockImplementation(() => mockSelectResult()),
    }),
  }),
});

const buildSelectOrgChain = () => ({
  from: vi.fn().mockImplementation(() => mockSelectResult()),
});

const buildInsertChain = () => ({
  values: vi.fn().mockReturnValue({
    returning: mockInsertReturning,
  }),
});

const buildDeleteChain = () => ({
  where: vi.fn().mockReturnValue({
    returning: mockDeleteReturning,
  }),
});

let selectChain = buildSelectChain();
let insertChain = buildInsertChain();
let deleteChain = buildDeleteChain();
let selectOrgChain = buildSelectOrgChain();

// Track which table is being selected from
let selectCallCount = 0;

vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn((...args: unknown[]) => {
      selectCallCount++;
      // If selecting { id: ... } it's the org query
      if (args.length > 0) return selectOrgChain;
      return selectChain;
    }),
    insert: vi.fn(() => insertChain),
    delete: vi.fn(() => deleteChain),
  },
}));

vi.mock("../../../../lib/db/schema/team", () => ({
  teamMembers: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    role: "role",
    bio: "bio",
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    id: "id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
}));

describe("seed-team-members.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectChain = buildSelectChain();
    insertChain = buildInsertChain();
    deleteChain = buildDeleteChain();
    selectOrgChain = buildSelectOrgChain();
  });

  describe("seedTeamMembers", () => {
    it("inserts sample team members when none exist", async () => {
      mockSelectResult.mockResolvedValue([]);
      const inserted = [
        { id: "m-1", name: "John Smith" },
        { id: "m-2", name: "Maria Garcia" },
        { id: "m-3", name: "David Chen" },
      ];
      mockInsertReturning.mockResolvedValue(inserted);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { seedTeamMembers } = await import(
        "../../../../lib/db/seed-team-members.server"
      );
      const result = await seedTeamMembers("org-1");
      expect(result).toEqual(inserted);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Seeding team members for organization org-1..."
      );
      consoleSpy.mockRestore();
    });

    it("skips seeding when team members already exist", async () => {
      mockSelectResult.mockResolvedValue([{ id: "existing-1" }]);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { seedTeamMembers } = await import(
        "../../../../lib/db/seed-team-members.server"
      );
      const result = await seedTeamMembers("org-1");
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Team members already exist for this organization, skipping..."
      );
      consoleSpy.mockRestore();
    });
  });

  describe("seedTeamMembersForAllOrgs", () => {
    it("seeds team members for all organizations", async () => {
      // First call returns orgs, subsequent calls return empty (no existing members)
      let callIdx = 0;
      mockSelectResult.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return [{ id: "org-1" }, { id: "org-2" }]; // orgs
        return []; // no existing members
      });
      mockInsertReturning.mockResolvedValue([{ id: "m-1" }]);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { seedTeamMembersForAllOrgs } = await import(
        "../../../../lib/db/seed-team-members.server"
      );
      await seedTeamMembersForAllOrgs();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Seeding team members for all organizations..."
      );
      consoleSpy.mockRestore();
    });
  });

  describe("clearTeamMembers", () => {
    it("deletes all team members for organization", async () => {
      const deleted = [{ id: "m-1" }, { id: "m-2" }];
      mockDeleteReturning.mockResolvedValue(deleted);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { clearTeamMembers } = await import(
        "../../../../lib/db/seed-team-members.server"
      );
      const result = await clearTeamMembers("org-1");
      expect(result).toEqual(deleted);
      expect(consoleSpy).toHaveBeenCalledWith("Deleted 2 team members");
      consoleSpy.mockRestore();
    });

    it("returns empty array when no members to delete", async () => {
      mockDeleteReturning.mockResolvedValue([]);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { clearTeamMembers } = await import(
        "../../../../lib/db/seed-team-members.server"
      );
      const result = await clearTeamMembers("org-1");
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("Deleted 0 team members");
      consoleSpy.mockRestore();
    });
  });
});
