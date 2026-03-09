/**
 * Tests for DS-rf2e: Agency dropdown should only show agencies with active classes
 *
 * Tests that the agency list is derived dynamically from courses that have
 * upcoming training sessions, rather than showing all agencies.
 */

import { describe, it, expect } from "vitest";
import { extractActiveAgencies } from "../../../../app/routes/site/courses/index";

describe("DS-rf2e: Agency dropdown filtering", () => {
  describe("extractActiveAgencies", () => {
    it("returns unique agencies from the courses list", () => {
      const courses = [
        { agencyName: "PADI" },
        { agencyName: "SSI" },
        { agencyName: "PADI" },
      ];

      const agencies = extractActiveAgencies(
        courses as Array<{ agencyName: string | null }>
      );

      expect(agencies).toEqual(["PADI", "SSI"]);
    });

    it("excludes null agency names", () => {
      const courses = [
        { agencyName: "PADI" },
        { agencyName: null },
        { agencyName: "SSI" },
      ];

      const agencies = extractActiveAgencies(
        courses as Array<{ agencyName: string | null }>
      );

      expect(agencies).toEqual(["PADI", "SSI"]);
    });

    it("returns empty array when no courses have agencies", () => {
      const courses = [{ agencyName: null }, { agencyName: null }];

      const agencies = extractActiveAgencies(
        courses as Array<{ agencyName: string | null }>
      );

      expect(agencies).toEqual([]);
    });

    it("returns empty array when no courses exist", () => {
      const agencies = extractActiveAgencies([]);

      expect(agencies).toEqual([]);
    });

    it("returns agencies sorted alphabetically", () => {
      const courses = [
        { agencyName: "SSI" },
        { agencyName: "NAUI" },
        { agencyName: "PADI" },
      ];

      const agencies = extractActiveAgencies(
        courses as Array<{ agencyName: string | null }>
      );

      expect(agencies).toEqual(["NAUI", "PADI", "SSI"]);
    });

    it("does not include agencies from courses without upcoming sessions when filtered", () => {
      // Only courses passed to extractActiveAgencies should contribute agencies
      // If a course has no upcoming sessions, it should not be in the list at all
      const coursesWithSessions = [{ agencyName: "PADI" }];

      // GUE course has no sessions — it shouldn't even be in the input
      const agencies = extractActiveAgencies(
        coursesWithSessions as Array<{ agencyName: string | null }>
      );

      expect(agencies).not.toContain("GUE");
      expect(agencies).toEqual(["PADI"]);
    });
  });
});
