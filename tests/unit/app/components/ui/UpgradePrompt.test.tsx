/**
 * UpgradePrompt Component Unit Tests
 *
 * Tests the UpgradePrompt and PremiumGate components including:
 * - Banner variant: feature message and Upgrade Now link
 * - Inline variant: feature message and Upgrade link
 * - Overlay variant: Premium Feature heading and Upgrade to Premium link
 * - Count/limit message format
 * - PremiumGate shows overlay when not premium
 * - PremiumGate hides overlay when premium
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpgradePrompt, PremiumGate } from "../../../../../app/components/ui/UpgradePrompt";

vi.mock("react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

describe("UpgradePrompt Component", () => {
  describe("Banner Variant (default)", () => {
    it("renders feature message for banner variant", () => {
      render(<UpgradePrompt feature="Advanced Reports" variant="banner" />);
      expect(screen.getByText("Advanced Reports is a Premium feature")).toBeInTheDocument();
    });

    it("renders 'Upgrade Now' link for banner variant", () => {
      render(<UpgradePrompt feature="Advanced Reports" variant="banner" />);
      const upgradeLink = screen.getByRole("link", { name: /Upgrade Now/i });
      expect(upgradeLink).toBeInTheDocument();
    });

    it("'Upgrade Now' link points to the billing settings page", () => {
      render(<UpgradePrompt feature="Reports" variant="banner" />);
      const upgradeLink = screen.getByRole("link", { name: /Upgrade Now/i });
      expect(upgradeLink).toHaveAttribute("href", "/tenant/settings/billing");
    });

    it("renders 'Upgrade to Premium to unlock unlimited access' subtitle", () => {
      render(<UpgradePrompt feature="Reports" variant="banner" />);
      expect(
        screen.getByText("Upgrade to Premium to unlock unlimited access")
      ).toBeInTheDocument();
    });

    it("uses banner variant by default when no variant specified", () => {
      render(<UpgradePrompt feature="Custom Branding" />);
      // Banner variant shows "Upgrade Now" link
      expect(screen.getByRole("link", { name: /Upgrade Now/i })).toBeInTheDocument();
    });
  });

  describe("Inline Variant", () => {
    it("renders feature message for inline variant", () => {
      render(<UpgradePrompt feature="Email Templates" variant="inline" />);
      expect(screen.getByText("Email Templates is a Premium feature")).toBeInTheDocument();
    });

    it("renders 'Upgrade' link for inline variant", () => {
      render(<UpgradePrompt feature="Email Templates" variant="inline" />);
      const upgradeLink = screen.getByRole("link", { name: /Upgrade/i });
      expect(upgradeLink).toBeInTheDocument();
    });

    it("'Upgrade' link points to the billing settings page", () => {
      render(<UpgradePrompt feature="Email Templates" variant="inline" />);
      const upgradeLink = screen.getByRole("link", { name: /Upgrade/i });
      expect(upgradeLink).toHaveAttribute("href", "/tenant/settings/billing");
    });

    it("renders with warning styling classes", () => {
      const { container } = render(
        <UpgradePrompt feature="Email Templates" variant="inline" />
      );
      const promptDiv = container.firstChild as HTMLElement;
      expect(promptDiv).toHaveClass("bg-warning-muted");
    });
  });

  describe("Overlay Variant", () => {
    it("renders 'Premium Feature' heading for overlay variant", () => {
      render(<UpgradePrompt feature="API Access" variant="overlay" />);
      expect(screen.getByRole("heading", { name: "Premium Feature" })).toBeInTheDocument();
    });

    it("renders feature message for overlay variant", () => {
      render(<UpgradePrompt feature="API Access" variant="overlay" />);
      expect(screen.getByText("API Access is a Premium feature")).toBeInTheDocument();
    });

    it("renders 'Upgrade to Premium' link for overlay variant", () => {
      render(<UpgradePrompt feature="API Access" variant="overlay" />);
      const upgradeLink = screen.getByRole("link", { name: /Upgrade to Premium/i });
      expect(upgradeLink).toBeInTheDocument();
    });

    it("'Upgrade to Premium' link points to the billing settings page", () => {
      render(<UpgradePrompt feature="API Access" variant="overlay" />);
      const upgradeLink = screen.getByRole("link", { name: /Upgrade to Premium/i });
      expect(upgradeLink).toHaveAttribute("href", "/tenant/settings/billing");
    });

    it("renders subtitle text about upgrading plan", () => {
      render(<UpgradePrompt feature="API Access" variant="overlay" />);
      expect(
        screen.getByText("Upgrade your plan to unlock this feature and more")
      ).toBeInTheDocument();
    });
  });

  describe("Count and Limit Message", () => {
    it("renders count/limit message when both currentCount and limit are provided", () => {
      render(
        <UpgradePrompt
          feature="boats"
          currentCount={3}
          limit={3}
          variant="banner"
        />
      );
      expect(
        screen.getByText("You've reached 3/3 boats on the Free plan")
      ).toBeInTheDocument();
    });

    it("renders count/limit message in inline variant", () => {
      render(
        <UpgradePrompt
          feature="staff members"
          currentCount={5}
          limit={5}
          variant="inline"
        />
      );
      expect(
        screen.getByText("You've reached 5/5 staff members on the Free plan")
      ).toBeInTheDocument();
    });

    it("renders count/limit message in overlay variant", () => {
      render(
        <UpgradePrompt
          feature="bookings"
          currentCount={10}
          limit={10}
          variant="overlay"
        />
      );
      expect(
        screen.getByText("You've reached 10/10 bookings on the Free plan")
      ).toBeInTheDocument();
    });

    it("renders generic premium message when no count/limit provided", () => {
      render(<UpgradePrompt feature="Analytics" variant="banner" />);
      expect(screen.getByText("Analytics is a Premium feature")).toBeInTheDocument();
    });

    it("renders generic premium message when only currentCount is provided (no limit)", () => {
      render(<UpgradePrompt feature="Reports" currentCount={2} variant="banner" />);
      expect(screen.getByText("Reports is a Premium feature")).toBeInTheDocument();
    });
  });
});

describe("PremiumGate Component", () => {
  describe("When Not Premium", () => {
    it("renders children content", () => {
      render(
        <PremiumGate feature="Advanced Reports" isPremium={false}>
          <div>Premium content here</div>
        </PremiumGate>
      );
      expect(screen.getByText("Premium content here")).toBeInTheDocument();
    });

    it("renders the overlay prompt when isPremium is false", () => {
      render(
        <PremiumGate feature="Advanced Reports" isPremium={false}>
          <div>Content</div>
        </PremiumGate>
      );
      // Overlay renders "Premium Feature" heading
      expect(screen.getByRole("heading", { name: "Premium Feature" })).toBeInTheDocument();
    });

    it("renders the feature message in the overlay when not premium", () => {
      render(
        <PremiumGate feature="API Access" isPremium={false}>
          <div>Gated content</div>
        </PremiumGate>
      );
      expect(screen.getByText("API Access is a Premium feature")).toBeInTheDocument();
    });

    it("renders count/limit message in overlay when not premium and count/limit provided", () => {
      render(
        <PremiumGate
          feature="trips"
          currentCount={5}
          limit={5}
          isPremium={false}
        >
          <div>Trip list</div>
        </PremiumGate>
      );
      expect(
        screen.getByText("You've reached 5/5 trips on the Free plan")
      ).toBeInTheDocument();
    });

    it("renders 'Upgrade to Premium' link in the overlay", () => {
      render(
        <PremiumGate feature="Reports" isPremium={false}>
          <div>Content</div>
        </PremiumGate>
      );
      expect(
        screen.getByRole("link", { name: /Upgrade to Premium/i })
      ).toBeInTheDocument();
    });
  });

  describe("When Premium", () => {
    it("renders children content", () => {
      render(
        <PremiumGate feature="Advanced Reports" isPremium={true}>
          <div>Premium content accessible</div>
        </PremiumGate>
      );
      expect(screen.getByText("Premium content accessible")).toBeInTheDocument();
    });

    it("does not render overlay when isPremium is true", () => {
      render(
        <PremiumGate feature="Advanced Reports" isPremium={true}>
          <div>Content</div>
        </PremiumGate>
      );
      expect(
        screen.queryByRole("heading", { name: "Premium Feature" })
      ).not.toBeInTheDocument();
    });

    it("does not render 'Upgrade to Premium' link when isPremium is true", () => {
      render(
        <PremiumGate feature="Reports" isPremium={true}>
          <div>Content</div>
        </PremiumGate>
      );
      expect(
        screen.queryByRole("link", { name: /Upgrade to Premium/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Wrapper Structure", () => {
    it("wraps content in a relative-positioned div", () => {
      const { container } = render(
        <PremiumGate feature="Feature" isPremium={true}>
          <div>Content</div>
        </PremiumGate>
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("relative");
    });
  });
});
