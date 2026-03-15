/**
 * Skeleton Component Unit Tests
 *
 * Covers SkeletonLine, SkeletonCard, and SkeletonTable:
 * - Rendering without errors
 * - Width and count variants
 * - animate-pulse class presence
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SkeletonLine, SkeletonCard, SkeletonTable } from "../../../../../app/components/ui/Skeleton";

describe("SkeletonLine", () => {
  it("renders a div with animate-pulse class", () => {
    const { container } = render(<SkeletonLine />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass("animate-pulse");
  });

  it("applies bg-surface-inset class", () => {
    const { container } = render(<SkeletonLine />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("bg-surface-inset");
  });

  it("defaults to full width", () => {
    const { container } = render(<SkeletonLine />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("w-full");
  });

  it("applies w-3/4 class for width='3/4'", () => {
    const { container } = render(<SkeletonLine width="3/4" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("w-3/4");
  });

  it("applies w-1/2 class for width='1/2'", () => {
    const { container } = render(<SkeletonLine width="1/2" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("w-1/2");
  });

  it("applies w-1/4 class for width='1/4'", () => {
    const { container } = render(<SkeletonLine width="1/4" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("w-1/4");
  });

  it("applies custom className", () => {
    const { container } = render(<SkeletonLine className="my-custom" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("my-custom");
  });
});

describe("SkeletonCard", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders default 3 skeleton lines (plus header line)", () => {
    const { container } = render(<SkeletonCard lines={3} />);
    // The header line + 3 body lines = 4 total animated divs
    const lines = container.querySelectorAll(".animate-pulse");
    expect(lines.length).toBe(4);
  });

  it("renders the correct number of lines when overridden", () => {
    const { container } = render(<SkeletonCard lines={5} />);
    const lines = container.querySelectorAll(".animate-pulse");
    expect(lines.length).toBe(6); // 1 header + 5 body
  });

  it("applies custom className to outer wrapper", () => {
    const { container } = render(<SkeletonCard className="custom-card" />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("custom-card");
  });

  it("renders with bg-surface-raised and rounded-xl", () => {
    const { container } = render(<SkeletonCard />);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("bg-surface-raised");
    expect(card).toHaveClass("rounded-xl");
  });
});

describe("SkeletonTable", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkeletonTable />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders 5 row divs by default", () => {
    const { container } = render(<SkeletonTable rows={5} columns={1} />);
    // 1 header row + 5 body rows = 6 divs with border-b
    const rows = container.querySelectorAll(".border-b");
    expect(rows.length).toBe(6);
  });

  it("renders custom number of rows", () => {
    const { container } = render(<SkeletonTable rows={3} columns={1} />);
    const rows = container.querySelectorAll(".border-b");
    expect(rows.length).toBe(4); // 1 header + 3 rows
  });

  it("renders animate-pulse elements for columns", () => {
    const { container } = render(<SkeletonTable rows={1} columns={3} />);
    const pulseEls = container.querySelectorAll(".animate-pulse");
    // header: 3 cols + 1 row * 3 cols = 6
    expect(pulseEls.length).toBe(6);
  });

  it("applies custom className to outer wrapper", () => {
    const { container } = render(<SkeletonTable className="my-table" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("my-table");
  });
});
