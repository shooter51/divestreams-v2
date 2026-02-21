/**
 * UpgradeModal Component Unit Tests
 *
 * Tests conditional rendering, feature/limit info display,
 * "View Plans" link, "Maybe Later" button, Escape key handler,
 * and ARIA dialog attributes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UpgradeModal } from "../../../../app/components/upgrade-modal";

vi.mock("react-router", () => ({
  Link: ({ to, children, ...props }: Record<string, unknown>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../../../lib/plan-features", () => ({
  FEATURE_UPGRADE_INFO: {
    testFeature: {
      title: "Test Feature",
      description: "Test description",
      requiredPlan: "Premium",
    },
  },
  LIMIT_LABELS: { maxProducts: "Products" },
}));

const baseProps = {
  onClose: vi.fn(),
};

describe("UpgradeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("returns null when no feature and no limitType", () => {
    it("renders nothing when both feature and limitType are null/undefined", () => {
      const { container } = render(
        <UpgradeModal {...baseProps} feature={null} limitType={null} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when both are undefined", () => {
      const { container } = render(<UpgradeModal {...baseProps} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("feature upgrade info", () => {
    it("renders feature title when a valid feature key is provided", () => {
      render(
        <UpgradeModal
          {...baseProps}
          feature={"testFeature" as unknown}
          limitType={null}
        />,
      );

      expect(screen.getByText("Test Feature")).toBeInTheDocument();
    });

    it("renders feature description", () => {
      render(
        <UpgradeModal
          {...baseProps}
          feature={"testFeature" as unknown}
          limitType={null}
        />,
      );

      expect(screen.getByText("Test description")).toBeInTheDocument();
    });

    it("renders the required plan name", () => {
      render(
        <UpgradeModal
          {...baseProps}
          feature={"testFeature" as unknown}
          limitType={null}
        />,
      );

      expect(screen.getByText(/Upgrade to Premium/i)).toBeInTheDocument();
    });
  });

  describe("limit info", () => {
    it("renders limit title based on limitType label", () => {
      render(
        <UpgradeModal {...baseProps} feature={null} limitType="maxProducts" />,
      );

      expect(screen.getByText("Products Limit Reached")).toBeInTheDocument();
    });

    it("renders a description that mentions the limit label", () => {
      render(
        <UpgradeModal {...baseProps} feature={null} limitType="maxProducts" />,
      );

      // The description contains "products" in lowercase
      expect(
        screen.getByText(/you've reached your plan's limit for products/i),
      ).toBeInTheDocument();
    });

    it("renders 'Upgrade to a higher plan' for limit-based modals", () => {
      render(
        <UpgradeModal {...baseProps} feature={null} limitType="maxProducts" />,
      );

      expect(screen.getByText(/a higher plan/i)).toBeInTheDocument();
    });
  });

  describe("'View Plans' link", () => {
    it("renders a 'View Plans' link pointing to /tenant/settings/billing", () => {
      render(
        <UpgradeModal
          {...baseProps}
          feature={"testFeature" as unknown}
          limitType={null}
        />,
      );

      const link = screen.getByRole("link", { name: /view plans/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/tenant/settings/billing");
    });
  });

  describe("'Maybe Later' button", () => {
    it("renders 'Maybe Later' button", () => {
      render(
        <UpgradeModal
          {...baseProps}
          feature={"testFeature" as unknown}
          limitType={null}
        />,
      );

      expect(
        screen.getByRole("button", { name: /maybe later/i }),
      ).toBeInTheDocument();
    });

    it("calls onClose when 'Maybe Later' is clicked", () => {
      const onClose = vi.fn();
      render(
        <UpgradeModal
          {...baseProps}
          onClose={onClose}
          feature={"testFeature" as unknown}
          limitType={null}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /maybe later/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Escape key handler", () => {
    it("calls onClose when Escape key is pressed", () => {
      const onClose = vi.fn();
      render(
        <UpgradeModal
          {...baseProps}
          onClose={onClose}
          feature={"testFeature" as unknown}
          limitType={null}
        />,
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose for other keys", () => {
      const onClose = vi.fn();
      render(
        <UpgradeModal
          {...baseProps}
          onClose={onClose}
          feature={"testFeature" as unknown}
          limitType={null}
        />,
      );

      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "Tab" });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("ARIA attributes", () => {
    it("has role='dialog'", () => {
      render(
        <UpgradeModal
          {...baseProps}
          feature={"testFeature" as unknown}
          limitType={null}
        />,
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal='true'", () => {
      render(
        <UpgradeModal
          {...baseProps}
          feature={"testFeature" as unknown}
          limitType={null}
        />,
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });
  });
});
