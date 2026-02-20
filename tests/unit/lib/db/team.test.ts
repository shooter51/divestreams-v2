import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock setup
// ============================================================================

const mockSelectResult = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateReturning = vi.fn();
const mockDeleteReturning = vi.fn();

const buildSelectChain = () => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockImplementation(() => mockSelectResult()),
      limit: vi.fn().mockImplementation(() => mockSelectResult()),
    }),
    orderBy: vi.fn().mockImplementation(() => mockSelectResult()),
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

const buildDeleteChain = () => ({
  where: vi.fn().mockReturnValue({
    returning: mockDeleteReturning,
  }),
});

let selectChain = buildSelectChain();
let insertChain = buildInsertChain();
let updateChain = buildUpdateChain();
let deleteChain = buildDeleteChain();

vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
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
    isPublic: "isPublic",
    status: "status",
    displayOrder: "displayOrder",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  desc: vi.fn((a) => ({ desc: a })),
  asc: vi.fn((a) => ({ asc: a })),
}));

describe("team.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain = buildSelectChain();
    insertChain = buildInsertChain();
    updateChain = buildUpdateChain();
    deleteChain = buildDeleteChain();
  });

  describe("getPublicTeamMembers", () => {
    it("returns empty array when no public members", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { getPublicTeamMembers } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await getPublicTeamMembers("org-1");
      expect(result).toEqual([]);
    });

    it("returns public active members", async () => {
      const members = [
        { id: "m-1", name: "John", isPublic: true, status: "active" },
        { id: "m-2", name: "Jane", isPublic: true, status: "active" },
      ];
      mockSelectResult.mockResolvedValue(members);

      const { getPublicTeamMembers } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await getPublicTeamMembers("org-1");
      expect(result).toEqual(members);
      expect(result).toHaveLength(2);
    });
  });

  describe("getPublicTeamMember", () => {
    it("returns null when member not found", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { getPublicTeamMember } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await getPublicTeamMember("org-1", "m-999");
      expect(result).toBeNull();
    });

    it("returns member when found", async () => {
      const member = { id: "m-1", name: "John", isPublic: true, status: "active" };
      mockSelectResult.mockResolvedValue([member]);

      const { getPublicTeamMember } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await getPublicTeamMember("org-1", "m-1");
      expect(result).toEqual(member);
    });
  });

  describe("getAllTeamMembers", () => {
    it("returns all members including inactive", async () => {
      const members = [
        { id: "m-1", name: "John", status: "active" },
        { id: "m-2", name: "Jane", status: "inactive" },
      ];
      mockSelectResult.mockResolvedValue(members);

      const { getAllTeamMembers } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await getAllTeamMembers("org-1");
      expect(result).toEqual(members);
      expect(result).toHaveLength(2);
    });
  });

  describe("getTeamMemberById", () => {
    it("returns null when member not found", async () => {
      mockSelectResult.mockResolvedValue([]);

      const { getTeamMemberById } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await getTeamMemberById("org-1", "m-999");
      expect(result).toBeNull();
    });

    it("returns member when found", async () => {
      const member = { id: "m-1", name: "John" };
      mockSelectResult.mockResolvedValue([member]);

      const { getTeamMemberById } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await getTeamMemberById("org-1", "m-1");
      expect(result).toEqual(member);
    });
  });

  describe("createTeamMember", () => {
    it("creates and returns team member", async () => {
      const newMember = { id: "m-1", organizationId: "org-1", name: "John" };
      mockInsertReturning.mockResolvedValue([newMember]);

      const { createTeamMember } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await createTeamMember("org-1", {
        name: "John",
        role: "Instructor",
      } as unknown);
      expect(result).toEqual(newMember);
    });
  });

  describe("updateTeamMember", () => {
    it("updates and returns member", async () => {
      const updated = { id: "m-1", name: "John Updated" };
      mockUpdateReturning.mockResolvedValue([updated]);

      const { updateTeamMember } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await updateTeamMember("org-1", "m-1", { name: "John Updated" });
      expect(result).toEqual(updated);
    });

    it("returns null when member not found", async () => {
      mockUpdateReturning.mockResolvedValue([]);

      const { updateTeamMember } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await updateTeamMember("org-1", "m-999", { name: "Nope" });
      expect(result).toBeNull();
    });
  });

  describe("deleteTeamMember", () => {
    it("returns true when member deleted", async () => {
      mockDeleteReturning.mockResolvedValue([{ id: "m-1" }]);

      const { deleteTeamMember } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await deleteTeamMember("org-1", "m-1");
      expect(result).toBe(true);
    });

    it("returns false when member not found", async () => {
      mockDeleteReturning.mockResolvedValue([]);

      const { deleteTeamMember } = await import(
        "../../../../lib/db/team.server"
      );
      const result = await deleteTeamMember("org-1", "m-999");
      expect(result).toBe(false);
    });
  });

  describe("reorderTeamMembers", () => {
    it("updates display order for each member", async () => {
      mockUpdateReturning.mockResolvedValue([]);

      const { reorderTeamMembers } = await import(
        "../../../../lib/db/team.server"
      );
      await reorderTeamMembers("org-1", ["m-3", "m-1", "m-2"]);
      // Should call update for each member ID
      const { db } = await import("../../../../lib/db/index");
      expect(db.update).toHaveBeenCalledTimes(3);
    });

    it("handles empty array", async () => {
      const { reorderTeamMembers } = await import(
        "../../../../lib/db/team.server"
      );
      await reorderTeamMembers("org-1", []);
      const { db } = await import("../../../../lib/db/index");
      expect(db.update).not.toHaveBeenCalled();
    });
  });
});
