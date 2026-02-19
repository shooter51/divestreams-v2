/**
 * Badge Component Unit Tests
 *
 * Tests the Badge family of components including:
 * - Badge: all variants, sizes, children, className
 * - StatusBadge: status-to-variant/label mapping
 * - ConditionBadge: condition-to-variant mapping
 * - DifficultyBadge: difficulty-to-variant mapping
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, StatusBadge, ConditionBadge, DifficultyBadge } from "../../../../../app/components/ui/Badge";

describe("Badge Component", () => {
  describe("Children Rendering", () => {
    it("renders children text content", () => {
      render(<Badge>Active</Badge>);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders as a span element", () => {
      const { container } = render(<Badge>Label</Badge>);
      expect(container.firstChild?.nodeName).toBe("SPAN");
    });
  });

  describe("Variants", () => {
    it("renders default variant with correct classes", () => {
      render(<Badge variant="default">Default</Badge>);
      const badge = screen.getByText("Default");
      expect(badge).toHaveClass("bg-surface-overlay");
      expect(badge).toHaveClass("text-foreground");
    });

    it("renders success variant with correct classes", () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText("Success");
      expect(badge).toHaveClass("bg-success-muted");
      expect(badge).toHaveClass("text-success");
    });

    it("renders warning variant with correct classes", () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText("Warning");
      expect(badge).toHaveClass("bg-warning-muted");
      expect(badge).toHaveClass("text-warning");
    });

    it("renders error variant with correct classes", () => {
      render(<Badge variant="error">Error</Badge>);
      const badge = screen.getByText("Error");
      expect(badge).toHaveClass("bg-danger-muted");
      expect(badge).toHaveClass("text-danger");
    });

    it("renders info variant with correct classes", () => {
      render(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText("Info");
      expect(badge).toHaveClass("bg-brand-muted");
      expect(badge).toHaveClass("text-brand");
    });

    it("renders accent variant with correct classes", () => {
      render(<Badge variant="accent">Accent</Badge>);
      const badge = screen.getByText("Accent");
      expect(badge).toHaveClass("bg-accent-muted");
      expect(badge).toHaveClass("text-accent");
    });

    it("defaults to default variant when no variant specified", () => {
      render(<Badge>No Variant</Badge>);
      const badge = screen.getByText("No Variant");
      expect(badge).toHaveClass("bg-surface-overlay");
    });
  });

  describe("Sizes", () => {
    it("renders sm size with correct classes", () => {
      render(<Badge size="sm">Small</Badge>);
      const badge = screen.getByText("Small");
      expect(badge).toHaveClass("text-xs");
      expect(badge).toHaveClass("px-2");
      expect(badge).toHaveClass("py-1");
    });

    it("renders md size with correct classes", () => {
      render(<Badge size="md">Medium</Badge>);
      const badge = screen.getByText("Medium");
      expect(badge).toHaveClass("text-sm");
      expect(badge).toHaveClass("px-3");
      expect(badge).toHaveClass("py-1");
    });

    it("defaults to sm size when no size specified", () => {
      render(<Badge>Default Size</Badge>);
      const badge = screen.getByText("Default Size");
      expect(badge).toHaveClass("text-xs");
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      render(<Badge className="my-custom-badge">Custom</Badge>);
      const badge = screen.getByText("Custom");
      expect(badge).toHaveClass("my-custom-badge");
    });

    it("preserves variant classes alongside custom className", () => {
      render(<Badge variant="success" className="extra-class">Custom Success</Badge>);
      const badge = screen.getByText("Custom Success");
      expect(badge).toHaveClass("extra-class");
      expect(badge).toHaveClass("bg-success-muted");
    });
  });

  describe("Base Classes", () => {
    it("always renders with rounded-full and inline-flex classes", () => {
      render(<Badge>Base</Badge>);
      const badge = screen.getByText("Base");
      expect(badge).toHaveClass("rounded-full");
      expect(badge).toHaveClass("inline-flex");
      expect(badge).toHaveClass("items-center");
    });
  });
});

describe("StatusBadge Component", () => {
  it("renders 'pending' status with warning variant and 'Pending' label", () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByText("Pending");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-warning-muted");
    expect(badge).toHaveClass("text-warning");
  });

  it("renders 'confirmed' status with success variant and 'Confirmed' label", () => {
    render(<StatusBadge status="confirmed" />);
    const badge = screen.getByText("Confirmed");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-success-muted");
    expect(badge).toHaveClass("text-success");
  });

  it("renders 'cancelled' status with error variant and 'Cancelled' label", () => {
    render(<StatusBadge status="cancelled" />);
    const badge = screen.getByText("Cancelled");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-danger-muted");
    expect(badge).toHaveClass("text-danger");
  });

  it("renders 'paid' status with success variant and 'Paid' label", () => {
    render(<StatusBadge status="paid" />);
    const badge = screen.getByText("Paid");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-success-muted");
  });

  it("renders 'active' status with success variant and 'Active' label", () => {
    render(<StatusBadge status="active" />);
    const badge = screen.getByText("Active");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-success-muted");
  });

  it("renders 'overdue' status with error variant and 'Overdue' label", () => {
    render(<StatusBadge status="overdue" />);
    const badge = screen.getByText("Overdue");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-danger-muted");
  });

  it("renders 'in_progress' status with warning variant and 'In Progress' label", () => {
    render(<StatusBadge status="in_progress" />);
    const badge = screen.getByText("In Progress");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-warning-muted");
  });

  it("renders 'completed' status with default variant and 'Completed' label", () => {
    render(<StatusBadge status="completed" />);
    const badge = screen.getByText("Completed");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-surface-overlay");
  });

  it("accepts size prop", () => {
    render(<StatusBadge status="pending" size="md" />);
    const badge = screen.getByText("Pending");
    expect(badge).toHaveClass("text-sm");
  });

  it("accepts className prop", () => {
    render(<StatusBadge status="pending" className="extra-class" />);
    const badge = screen.getByText("Pending");
    expect(badge).toHaveClass("extra-class");
  });
});

describe("ConditionBadge Component", () => {
  it("renders 'excellent' condition with success variant", () => {
    render(<ConditionBadge condition="excellent" />);
    const badge = screen.getByText("excellent");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-success-muted");
    expect(badge).toHaveClass("text-success");
  });

  it("renders 'good' condition with info variant", () => {
    render(<ConditionBadge condition="good" />);
    const badge = screen.getByText("good");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-brand-muted");
    expect(badge).toHaveClass("text-brand");
  });

  it("renders 'fair' condition with warning variant", () => {
    render(<ConditionBadge condition="fair" />);
    const badge = screen.getByText("fair");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-warning-muted");
    expect(badge).toHaveClass("text-warning");
  });

  it("renders 'poor' condition with error variant", () => {
    render(<ConditionBadge condition="poor" />);
    const badge = screen.getByText("poor");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-danger-muted");
    expect(badge).toHaveClass("text-danger");
  });

  it("renders unknown condition with default variant", () => {
    render(<ConditionBadge condition="unknown" />);
    const badge = screen.getByText("unknown");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-surface-overlay");
  });
});

describe("DifficultyBadge Component", () => {
  it("renders 'beginner' difficulty with success variant", () => {
    render(<DifficultyBadge difficulty="beginner" />);
    const badge = screen.getByText("beginner");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-success-muted");
    expect(badge).toHaveClass("text-success");
  });

  it("renders 'intermediate' difficulty with info variant", () => {
    render(<DifficultyBadge difficulty="intermediate" />);
    const badge = screen.getByText("intermediate");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-brand-muted");
    expect(badge).toHaveClass("text-brand");
  });

  it("renders 'advanced' difficulty with warning variant", () => {
    render(<DifficultyBadge difficulty="advanced" />);
    const badge = screen.getByText("advanced");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-warning-muted");
    expect(badge).toHaveClass("text-warning");
  });

  it("renders 'expert' difficulty with error variant", () => {
    render(<DifficultyBadge difficulty="expert" />);
    const badge = screen.getByText("expert");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-danger-muted");
    expect(badge).toHaveClass("text-danger");
  });

  it("renders unknown difficulty with default variant", () => {
    render(<DifficultyBadge difficulty="unknown" />);
    const badge = screen.getByText("unknown");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-surface-overlay");
  });
});
