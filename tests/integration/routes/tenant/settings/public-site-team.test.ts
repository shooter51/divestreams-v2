import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
}));

vi.mock("../../../../../lib/db/team.server", () => ({
  getAllTeamMembers: vi.fn(),
  createTeamMember: vi.fn(),
  updateTeamMember: vi.fn(),
  deleteTeamMember: vi.fn(),
  reorderTeamMembers: vi.fn(),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getAllTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  reorderTeamMembers,
} from "../../../../../lib/db/team.server";
import { loader, action } from "../../../../../app/routes/tenant/settings/public-site.team";

describe("tenant/settings/public-site.team route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo", customDomain: null },
    membership: { role: "owner" },
    subscription: null,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20 },
    usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("requires organization context", async () => {
      (getAllTeamMembers as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/team");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("returns team members", async () => {
      const mockMembers = [
        {
          id: "member-1",
          name: "John Smith",
          role: "Lead Instructor",
          bio: "20 years experience",
          certifications: ["PADI Course Director"],
          specialties: ["Technical Diving"],
          isPublic: true,
        },
        {
          id: "member-2",
          name: "Jane Doe",
          role: "Instructor",
          bio: null,
          certifications: [],
          specialties: [],
          isPublic: true,
        },
      ];
      (getAllTeamMembers as Mock).mockResolvedValue(mockMembers);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/team");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.teamMembers).toEqual(mockMembers);
      expect(result.teamMembers).toHaveLength(2);
    });

    it("returns empty array when no team members exist", async () => {
      (getAllTeamMembers as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/team");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result.teamMembers).toEqual([]);
    });
  });

  describe("action", () => {
    describe("create intent", () => {
      it("creates a team member with parsed certifications and specialties", async () => {
        (createTeamMember as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "create");
        formData.append("name", "John Smith");
        formData.append("role", "Lead Instructor");
        formData.append("bio", "20 years of diving experience");
        formData.append("email", "john@example.com");
        formData.append("phone", "+1-555-1234");
        formData.append("imageUrl", "https://example.com/john.jpg");
        formData.append("certifications", "PADI Course Director, TDI Advanced Trimix");
        formData.append("specialties", "Technical Diving, Underwater Photography");
        formData.append("yearsExperience", "20");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/team", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(createTeamMember).toHaveBeenCalledWith("org-uuid", {
          name: "John Smith",
          role: "Lead Instructor",
          bio: "20 years of diving experience",
          email: "john@example.com",
          phone: "+1-555-1234",
          imageUrl: "https://example.com/john.jpg",
          certifications: ["PADI Course Director", "TDI Advanced Trimix"],
          specialties: ["Technical Diving", "Underwater Photography"],
          yearsExperience: 20,
          isPublic: true,
          status: "active",
          displayOrder: 0,
        });
        expect(result).toEqual({ success: true, message: "Team member added successfully" });
      });

      it("handles empty certifications and specialties", async () => {
        (createTeamMember as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "create");
        formData.append("name", "Jane Doe");
        formData.append("role", "Instructor");
        formData.append("certifications", "");
        formData.append("specialties", "");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/team", {
          method: "POST",
          body: formData,
        });
        await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(createTeamMember).toHaveBeenCalledWith("org-uuid", expect.objectContaining({
          certifications: [],
          specialties: [],
          yearsExperience: null,
        }));
      });
    });

    describe("update intent", () => {
      it("updates a team member with memberId", async () => {
        (updateTeamMember as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "update");
        formData.append("memberId", "member-1");
        formData.append("name", "John Smith Updated");
        formData.append("role", "Senior Instructor");
        formData.append("bio", "Updated bio");
        formData.append("certifications", "PADI Master Instructor");
        formData.append("specialties", "Cave Diving");
        formData.append("isPublic", "true");
        formData.append("yearsExperience", "25");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/team", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(updateTeamMember).toHaveBeenCalledWith("org-uuid", "member-1", {
          name: "John Smith Updated",
          role: "Senior Instructor",
          bio: "Updated bio",
          email: null,
          phone: null,
          imageUrl: null,
          certifications: ["PADI Master Instructor"],
          specialties: ["Cave Diving"],
          yearsExperience: 25,
          isPublic: true,
        });
        expect(result).toEqual({ success: true, message: "Team member updated successfully" });
      });
    });

    describe("delete intent", () => {
      it("deletes a team member by memberId", async () => {
        (deleteTeamMember as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "delete");
        formData.append("memberId", "member-1");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/team", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(deleteTeamMember).toHaveBeenCalledWith("org-uuid", "member-1");
        expect(result).toEqual({ success: true, message: "Team member deleted successfully" });
      });
    });

    describe("reorder intent", () => {
      it("reorders team members by parsing order string", async () => {
        (reorderTeamMembers as Mock).mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append("intent", "reorder");
        formData.append("order", "member-3,member-1,member-2");

        const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/team", {
          method: "POST",
          body: formData,
        });
        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

        expect(reorderTeamMembers).toHaveBeenCalledWith("org-uuid", ["member-3", "member-1", "member-2"]);
        expect(result).toEqual({ success: true, message: "Team members reordered successfully" });
      });
    });

    it("returns null for unknown intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/tenant/settings/public-site/team", {
        method: "POST",
        body: formData,
      });
      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as any);

      expect(result).toBeNull();
    });
  });
});
