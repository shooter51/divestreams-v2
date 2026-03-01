/**
 * StatCard Component Unit Tests
 *
 * Tests the StatCard and StatRow components including:
 * - StatCard: title and value rendering
 * - StatCard: icon rendering
 * - StatCard: positive trend indicator
 * - StatCard: negative trend indicator
 * - StatRow: label and value rendering
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard, StatRow } from "../../../../../app/components/ui/StatCard";

describe("StatCard Component", () => {
  describe("Title and Value Rendering", () => {
    it("renders the title text", () => {
      render(<StatCard title="Total Bookings" value={42} />);
      expect(screen.getByText("Total Bookings")).toBeInTheDocument();
    });

    it("renders the numeric value", () => {
      render(<StatCard title="Revenue" value={1500} />);
      expect(screen.getByText("1500")).toBeInTheDocument();
    });

    it("renders the string value", () => {
      render(<StatCard title="Status" value="Active" />);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders value as a paragraph element", () => {
      const { container } = render(<StatCard title="Count" value={10} />);
      const paragraphs = container.querySelectorAll("p");
      const valueParagraph = Array.from(paragraphs).find((p) => p.textContent === "10");
      expect(valueParagraph).toBeInTheDocument();
    });
  });

  describe("Icon Rendering", () => {
    it("renders the icon when provided", () => {
      render(<StatCard title="Divers" value={5} icon="🤿" />);
      expect(screen.getByText("🤿")).toBeInTheDocument();
    });

    it("does not render icon element when not provided", () => {
      const { container } = render(<StatCard title="Revenue" value={100} />);
      const spans = container.querySelectorAll("span");
      // No icon span should exist
      const iconSpan = Array.from(spans).find((s) => s.className.includes("text-2xl"));
      expect(iconSpan).toBeUndefined();
    });
  });

  describe("Positive Trend", () => {
    it("renders positive trend indicator with upward arrow", () => {
      render(
        <StatCard
          title="Revenue"
          value={1000}
          icon="💰"
          trend={{ value: 12, isPositive: true }}
        />
      );
      expect(screen.getByText(/↑/)).toBeInTheDocument();
    });

    it("renders positive trend with correct percentage value", () => {
      render(
        <StatCard
          title="Revenue"
          value={1000}
          icon="💰"
          trend={{ value: 12, isPositive: true }}
        />
      );
      expect(screen.getByText(/↑ 12%/)).toBeInTheDocument();
    });

    it("applies text-success class for positive trends", () => {
      render(
        <StatCard
          title="Revenue"
          value={1000}
          icon="💰"
          trend={{ value: 5, isPositive: true }}
        />
      );
      const trendSpan = screen.getByText(/↑/);
      expect(trendSpan).toHaveClass("text-success");
    });
  });

  describe("Negative Trend", () => {
    it("renders negative trend indicator with downward arrow", () => {
      render(
        <StatCard
          title="Revenue"
          value={800}
          icon="💰"
          trend={{ value: 8, isPositive: false }}
        />
      );
      expect(screen.getByText(/↓/)).toBeInTheDocument();
    });

    it("renders negative trend with correct percentage value", () => {
      render(
        <StatCard
          title="Revenue"
          value={800}
          icon="💰"
          trend={{ value: 8, isPositive: false }}
        />
      );
      expect(screen.getByText(/↓ 8%/)).toBeInTheDocument();
    });

    it("applies text-danger class for negative trends", () => {
      render(
        <StatCard
          title="Revenue"
          value={800}
          icon="💰"
          trend={{ value: 8, isPositive: false }}
        />
      );
      const trendSpan = screen.getByText(/↓/);
      expect(trendSpan).toHaveClass("text-danger");
    });

    it("renders absolute value for negative trend (no double negative)", () => {
      render(
        <StatCard
          title="Revenue"
          value={800}
          icon="💰"
          trend={{ value: -15, isPositive: false }}
        />
      );
      // Math.abs(-15) === 15
      expect(screen.getByText(/↓ 15%/)).toBeInTheDocument();
    });
  });

  describe("No Trend", () => {
    it("does not render trend indicator when trend is not provided", () => {
      render(<StatCard title="Count" value={10} icon="📊" />);
      expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
      expect(screen.queryByText(/↓/)).not.toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className to the card", () => {
      const { container } = render(
        <StatCard title="Title" value={0} className="my-stat-card" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("my-stat-card");
    });

    it("preserves base classes alongside custom className", () => {
      const { container } = render(
        <StatCard title="Title" value={0} className="extra" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("extra");
      expect(card).toHaveClass("bg-surface-raised");
    });
  });

  describe("Base Classes", () => {
    it("renders with base structural classes", () => {
      const { container } = render(<StatCard title="Title" value={0} />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("bg-surface-raised");
      expect(card).toHaveClass("rounded-xl");
      expect(card).toHaveClass("shadow-sm");
    });
  });
});

describe("StatRow Component", () => {
  describe("Label and Value Rendering", () => {
    it("renders the label text", () => {
      render(<StatRow label="Total Dives" value={150} />);
      expect(screen.getByText("Total Dives")).toBeInTheDocument();
    });

    it("renders the numeric value", () => {
      render(<StatRow label="Depth" value={30} />);
      expect(screen.getByText("30")).toBeInTheDocument();
    });

    it("renders the string value", () => {
      render(<StatRow label="Status" value="Active" />);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders label and value in the same row", () => {
      const { container } = render(<StatRow label="Bookings" value={5} />);
      const row = container.firstChild as HTMLElement;
      expect(row).toHaveClass("flex");
      expect(row).toHaveClass("justify-between");
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      const { container } = render(
        <StatRow label="Label" value="Value" className="my-stat-row" />
      );
      const row = container.firstChild as HTMLElement;
      expect(row).toHaveClass("my-stat-row");
    });
  });

  describe("Base Classes", () => {
    it("renders with base text-sm class", () => {
      const { container } = render(<StatRow label="Label" value="Value" />);
      const row = container.firstChild as HTMLElement;
      expect(row).toHaveClass("text-sm");
    });
  });
});
