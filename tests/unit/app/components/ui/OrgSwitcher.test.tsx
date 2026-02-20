/**
 * OrgSwitcher Component Unit Tests
 *
 * Tests org display, dropdown toggle, current-org check icon,
 * avatar (initial vs logo), and overlay-click to close.
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrgSwitcher } from "../../../../../app/components/ui/OrgSwitcher";

const singleOrg = {
  id: "org-1",
  name: "Deep Blue Divers",
  slug: "deep-blue",
  logo: null,
};

const orgs = [
  { id: "org-1", name: "Deep Blue Divers", slug: "deep-blue", logo: null },
  { id: "org-2", name: "Reef Explorers", slug: "reef-exp", logo: null },
  { id: "org-3", name: "Ocean Ventures", slug: "ocean-v", logo: null },
];

describe("OrgSwitcher", () => {
  describe("single org – no dropdown", () => {
    it("shows org name when user has only one org", () => {
      render(<OrgSwitcher currentOrg={singleOrg} userOrgs={[singleOrg]} />);

      expect(screen.getByText("Deep Blue Divers")).toBeInTheDocument();
    });

    it("does NOT render a trigger button when there is only one org", () => {
      render(<OrgSwitcher currentOrg={singleOrg} userOrgs={[singleOrg]} />);

      // There should be no interactive button (just a static display)
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("multiple orgs – dropdown", () => {
    it("renders a trigger button when there are multiple orgs", () => {
      render(<OrgSwitcher currentOrg={orgs[0]} userOrgs={orgs} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("does not show dropdown list before trigger is clicked", () => {
      render(<OrgSwitcher currentOrg={orgs[0]} userOrgs={orgs} />);

      expect(screen.queryByText("Reef Explorers")).not.toBeInTheDocument();
    });

    it("clicking trigger opens dropdown with all org names", () => {
      render(<OrgSwitcher currentOrg={orgs[0]} userOrgs={orgs} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("Reef Explorers")).toBeInTheDocument();
      expect(screen.getByText("Ocean Ventures")).toBeInTheDocument();
    });

    it("clicking overlay closes the dropdown", () => {
      render(<OrgSwitcher currentOrg={orgs[0]} userOrgs={orgs} />);

      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByText("Reef Explorers")).toBeInTheDocument();

      // The overlay is a fixed-position div rendered behind the menu
      const overlay = document.querySelector(".fixed.inset-0.z-10") as HTMLElement;
      expect(overlay).toBeInTheDocument();
      fireEvent.click(overlay);

      expect(screen.queryByText("Reef Explorers")).not.toBeInTheDocument();
    });

    it("shows 'Switch Organization' label in dropdown header", () => {
      render(<OrgSwitcher currentOrg={orgs[0]} userOrgs={orgs} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("Switch Organization")).toBeInTheDocument();
    });
  });

  describe("current org check icon", () => {
    it("renders a check icon (svg path) only for the current org in dropdown", () => {
      render(<OrgSwitcher currentOrg={orgs[0]} userOrgs={orgs} />);

      fireEvent.click(screen.getByRole("button"));

      // The check icon SVG contains a specific path for the checkmark (M5 13l4 4L19 7)
      const svgPaths = document
        .querySelectorAll("svg path") as NodeListOf<SVGPathElement>;

      const checkPaths = Array.from(svgPaths).filter((p) =>
        p.getAttribute("d")?.includes("M5 13l4 4L19 7"),
      );

      // Exactly one check icon – for the current org only
      expect(checkPaths).toHaveLength(1);
    });
  });

  describe("org avatar", () => {
    it("shows org initial when no logo URL is provided", () => {
      render(<OrgSwitcher currentOrg={singleOrg} userOrgs={[singleOrg]} />);

      // "Deep Blue Divers" → initial "D"
      expect(screen.getByText("D")).toBeInTheDocument();
    });

    it("shows an img element when logo URL is provided", () => {
      const orgWithLogo = {
        id: "org-logo",
        name: "Splash Divers",
        slug: "splash",
        logo: "https://example.com/logo.png",
      };

      render(
        <OrgSwitcher
          currentOrg={orgWithLogo}
          userOrgs={[orgWithLogo]}
        />,
      );

      const img = screen.getByRole("img", { name: "Splash Divers" });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/logo.png");
    });

    it("shows initials for all orgs without logos in dropdown", () => {
      render(<OrgSwitcher currentOrg={orgs[0]} userOrgs={orgs} />);

      fireEvent.click(screen.getByRole("button"));

      // Initials: D (Deep Blue Divers), R (Reef Explorers), O (Ocean Ventures)
      // Multiple instances may exist (trigger + dropdown), getAllByText is fine
      expect(screen.getAllByText("D").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("R").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("O").length).toBeGreaterThanOrEqual(1);
    });
  });
});
