/**
 * Unit Tests for Admin Organizations Page (KAN-670)
 *
 * Verifies that hardcoded Tailwind color classes (bg-white, text-gray-800,
 * bg-gray-100) have been replaced with semantic design tokens.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock react-router hooks before importing the component
vi.mock("react-router", () => ({
  useLoaderData: vi.fn(),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  useFetcher: vi.fn(() => ({ submit: vi.fn() })),
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

import { useLoaderData } from "react-router";
import AdminOrganizationsPage from "../../../../../app/routes/admin/index";

const mockOrgs = [
  {
    id: "org-1",
    slug: "oceanblue",
    name: "Ocean Blue Diving",
    logo: null,
    createdAt: "2025-01-01",
    memberCount: 3,
    ownerEmail: "owner@oceanblue.com",
    subscriptionStatus: "active",
    subscriptionPlan: "Premium",
    tenantUrl: "https://oceanblue.divestreams.com/tenant",
  },
  {
    id: "org-2",
    slug: "deepdive",
    name: "Deep Dive Center",
    logo: "https://example.com/logo.png",
    createdAt: "2025-01-10",
    memberCount: 1,
    ownerEmail: "admin@deepdive.com",
    subscriptionStatus: "free",
    subscriptionPlan: "free",
    tenantUrl: "https://deepdive.divestreams.com/tenant",
  },
];

describe("AdminOrganizationsPage - Semantic Token Migration (KAN-670)", () => {
  beforeEach(() => {
    vi.mocked(useLoaderData).mockReturnValue({
      organizations: mockOrgs,
      search: "",
      error: null,
    });
  });

  describe("table container uses semantic tokens", () => {
    it("uses bg-surface-raised instead of bg-white for the table wrapper", () => {
      const { container } = render(<AdminOrganizationsPage />);
      const tableWrapper = container.querySelector(".bg-surface-raised");
      expect(tableWrapper).toBeInTheDocument();
      // Ensure no hardcoded bg-white
      expect(container.querySelector(".bg-white")).not.toBeInTheDocument();
    });

    it("uses bg-surface-inset instead of bg-gray-100 for thead", () => {
      const { container } = render(<AdminOrganizationsPage />);
      const thead = container.querySelector("thead");
      expect(thead).toHaveClass("bg-surface-inset");
      expect(thead).not.toHaveClass("bg-gray-100");
    });
  });

  describe("table headers use semantic tokens", () => {
    it("uses text-foreground-muted instead of text-gray-800 for th elements", () => {
      const { container } = render(<AdminOrganizationsPage />);
      const thElements = container.querySelectorAll("th");
      expect(thElements.length).toBeGreaterThan(0);

      thElements.forEach((th) => {
        expect(th).toHaveClass("text-foreground-muted");
        expect(th).not.toHaveClass("text-gray-800");
        expect(th).not.toHaveClass("text-gray-600");
        expect(th).not.toHaveClass("text-gray-500");
      });
    });
  });

  describe("table body uses semantic tokens", () => {
    it("uses text-foreground for org name cells", () => {
      render(<AdminOrganizationsPage />);
      // Find org name cells - they contain the org name text
      const nameCell = screen.getByText("Ocean Blue Diving").closest("td");
      expect(nameCell).toHaveClass("text-foreground");
    });

    it("uses text-foreground-muted for owner email cells", () => {
      render(<AdminOrganizationsPage />);
      const emailCell = screen.getByText("owner@oceanblue.com").closest("td");
      expect(emailCell).toHaveClass("text-foreground-muted");
    });

    it("uses text-foreground-muted for member count cells", () => {
      render(<AdminOrganizationsPage />);
      // Member count "3" for first org
      const memberCell = screen.getByText("3").closest("td");
      expect(memberCell).toHaveClass("text-foreground-muted");
    });

    it("uses text-foreground-muted for date cells", () => {
      render(<AdminOrganizationsPage />);
      const dateCell = screen.getByText("2025-01-01").closest("td");
      expect(dateCell).toHaveClass("text-foreground-muted");
    });
  });

  describe("no hardcoded gray classes remain", () => {
    it("does not contain any hardcoded bg-gray-* classes", () => {
      const { container } = render(<AdminOrganizationsPage />);
      const html = container.innerHTML;
      expect(html).not.toMatch(/\bbg-gray-\d+\b/);
    });

    it("does not contain any hardcoded text-gray-* classes", () => {
      const { container } = render(<AdminOrganizationsPage />);
      const html = container.innerHTML;
      expect(html).not.toMatch(/\btext-gray-\d+\b/);
    });

    it("does not contain bg-white class", () => {
      const { container } = render(<AdminOrganizationsPage />);
      const html = container.innerHTML;
      expect(html).not.toMatch(/\bbg-white\b/);
    });
  });

  describe("status badge uses semantic tokens", () => {
    it("uses semantic status colors for active status", () => {
      render(<AdminOrganizationsPage />);
      const activeBadge = screen.getByText("active");
      expect(activeBadge).toHaveClass("bg-success-muted", "text-success");
    });

    it("uses semantic status colors for free status", () => {
      render(<AdminOrganizationsPage />);
      const freeBadges = screen.getAllByText("free");
      // Both plan and status badges for the free org use surface-inset tokens
      freeBadges.forEach((badge) => {
        expect(badge).toHaveClass("bg-surface-inset", "text-foreground-muted");
      });
    });
  });

  describe("plan badge uses semantic tokens", () => {
    it("uses semantic info colors for non-free plans", () => {
      render(<AdminOrganizationsPage />);
      const premiumBadge = screen.getByText("Premium");
      expect(premiumBadge).toHaveClass("bg-info-muted", "text-info");
    });

    it("uses semantic surface colors for free plan", () => {
      render(<AdminOrganizationsPage />);
      // Both plan and status badges say "free" - get the plan one
      const freePlanBadges = screen.getAllByText("free");
      // The plan badge comes first in the row
      const planBadge = freePlanBadges[0];
      expect(planBadge).toHaveClass("bg-surface-inset", "text-foreground-muted");
    });
  });

  describe("organizations render correctly", () => {
    it("renders all organization names", () => {
      render(<AdminOrganizationsPage />);
      expect(screen.getByText("Ocean Blue Diving")).toBeInTheDocument();
      expect(screen.getByText("Deep Dive Center")).toBeInTheDocument();
    });

    it("renders organization slugs as links", () => {
      render(<AdminOrganizationsPage />);
      const oceanblueLink = screen.getByText("oceanblue");
      expect(oceanblueLink.tagName).toBe("A");
      expect(oceanblueLink).toHaveClass("text-brand");
    });

    it("renders org count with semantic token", () => {
      render(<AdminOrganizationsPage />);
      const countText = screen.getByText("2 total");
      expect(countText).toHaveClass("text-foreground-muted");
    });

    it("renders empty state with semantic token when no orgs", () => {
      vi.mocked(useLoaderData).mockReturnValue({
        organizations: [],
        search: "",
        error: null,
      });
      render(<AdminOrganizationsPage />);
      const emptyCell = screen.getByText("No organizations found");
      expect(emptyCell).toHaveClass("text-foreground-muted");
    });

    it("renders error with semantic danger tokens", () => {
      vi.mocked(useLoaderData).mockReturnValue({
        organizations: [],
        search: "",
        error: "Database error occurred",
      });
      render(<AdminOrganizationsPage />);
      const errorDiv = screen.getByText("Database error occurred").closest("div");
      expect(errorDiv).toHaveClass("bg-danger-muted", "border-danger", "text-danger");
    });
  });
});
