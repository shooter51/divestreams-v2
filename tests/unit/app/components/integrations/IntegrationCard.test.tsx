/**
 * IntegrationCard Component Unit Tests
 *
 * Covers:
 * - Renders name, description, features
 * - Connect button shown when available
 * - Upgrade prompt shown when not available
 * - Custom labels
 * - onConnect callback
 * - Custom actions slot
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntegrationCard } from "../../../../../app/components/integrations/IntegrationCard";

vi.mock("react-router", () => ({
  Link: ({ to, children, ...props }: Record<string, unknown>) => (
    <a href={String(to)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../../../../app/components/integrations/Icons", () => ({
  Icons: new Proxy(
    {
      Check: ({ className }: { className?: string }) => (
        <span data-testid="check-icon" className={className} />
      ),
    },
    {
      get: (target, prop) => {
        if (prop in target) return target[prop as keyof typeof target];
        return ({ className }: { className?: string }) => (
          <span data-testid="icon" className={className} />
        );
      },
    }
  ),
}));

const baseProps = {
  name: "Stripe",
  description: "Accept payments online",
  icon: "CreditCard",
  features: ["Online payments", "Card processing"],
  available: true,
  onConnect: vi.fn(),
};

describe("IntegrationCard", () => {
  describe("Content rendering", () => {
    it("renders the integration name", () => {
      render(<IntegrationCard {...baseProps} />);
      expect(screen.getByText("Stripe")).toBeInTheDocument();
    });

    it("renders the integration description", () => {
      render(<IntegrationCard {...baseProps} />);
      expect(screen.getByText("Accept payments online")).toBeInTheDocument();
    });

    it("renders all feature items", () => {
      render(<IntegrationCard {...baseProps} />);
      expect(screen.getByText("Online payments")).toBeInTheDocument();
      expect(screen.getByText("Card processing")).toBeInTheDocument();
    });
  });

  describe("Available state", () => {
    it("shows the connect button when available is true", () => {
      render(<IntegrationCard {...baseProps} available={true} />);
      expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    });

    it("uses custom connectLabel", () => {
      render(<IntegrationCard {...baseProps} connectLabel="Set up now" />);
      expect(screen.getByRole("button", { name: "Set up now" })).toBeInTheDocument();
    });

    it("calls onConnect when connect button is clicked", () => {
      const handleConnect = vi.fn();
      render(<IntegrationCard {...baseProps} onConnect={handleConnect} />);
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
      expect(handleConnect).toHaveBeenCalledTimes(1);
    });

    it("does not apply opacity-60 when available", () => {
      const { container } = render(<IntegrationCard {...baseProps} available={true} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).not.toContain("opacity-60");
    });
  });

  describe("Unavailable state", () => {
    it("shows upgrade link when available is false", () => {
      render(<IntegrationCard {...baseProps} available={false} upgradeLabel="Upgrade plan" />);
      expect(screen.getByText("Upgrade plan")).toBeInTheDocument();
    });

    it("does not show the connect button when unavailable", () => {
      render(<IntegrationCard {...baseProps} available={false} />);
      expect(screen.queryByRole("button", { name: "Connect" })).not.toBeInTheDocument();
    });

    it("shows requiresPlanLabel when provided", () => {
      render(
        <IntegrationCard
          {...baseProps}
          available={false}
          requiresPlanLabel="Requires Professional plan"
          upgradeLabel="Upgrade"
        />
      );
      expect(screen.getByText("Requires Professional plan")).toBeInTheDocument();
    });

    it("falls back to notAvailableLabel when requiresPlanLabel is not provided", () => {
      render(
        <IntegrationCard
          {...baseProps}
          available={false}
          notAvailableLabel="Not on your plan"
        />
      );
      expect(screen.getByText("Not on your plan")).toBeInTheDocument();
    });

    it("applies opacity-60 when unavailable", () => {
      const { container } = render(<IntegrationCard {...baseProps} available={false} />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("opacity-60");
    });

    it("links to billing page", () => {
      render(<IntegrationCard {...baseProps} available={false} upgradeLabel="Upgrade" />);
      const link = screen.getByRole("link", { name: "Upgrade" });
      expect(link).toHaveAttribute("href", "/tenant/settings/billing");
    });
  });

  describe("Custom actions slot", () => {
    it("renders custom actions instead of connect button when provided", () => {
      render(
        <IntegrationCard
          {...baseProps}
          actions={<button>Custom action</button>}
        />
      );
      expect(screen.getByRole("button", { name: "Custom action" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Connect" })).not.toBeInTheDocument();
    });
  });
});
