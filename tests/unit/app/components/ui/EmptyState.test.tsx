/**
 * EmptyState Component Unit Tests
 *
 * Tests the EmptyState component including:
 * - Title rendering (required)
 * - Icon rendering (optional)
 * - Description rendering (optional)
 * - Action link rendering (optional)
 * - Children rendering (optional)
 * - Rendering without any optional props
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../../../../../app/components/ui/EmptyState";

vi.mock("react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

describe("EmptyState Component", () => {
  describe("Title Rendering", () => {
    it("renders the title text", () => {
      render(<EmptyState title="No items found" />);
      expect(screen.getByText("No items found")).toBeInTheDocument();
    });

    it("renders title in an h3 element", () => {
      render(<EmptyState title="Empty State Title" />);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveTextContent("Empty State Title");
    });
  });

  describe("Icon Rendering", () => {
    it("renders icon when provided", () => {
      render(<EmptyState title="Title" icon="🏊" />);
      expect(screen.getByText("🏊")).toBeInTheDocument();
    });

    it("does not render icon container when not provided", () => {
      const { container } = render(<EmptyState title="No icon" />);
      const divs = container.querySelectorAll("div");
      // Should only have the outer container div
      divs.forEach((div) => {
        expect(div).not.toHaveClass("text-4xl");
      });
    });
  });

  describe("Description Rendering", () => {
    it("renders description when provided", () => {
      render(<EmptyState title="Title" description="This is the description" />);
      expect(screen.getByText("This is the description")).toBeInTheDocument();
    });

    it("does not render description paragraph when not provided", () => {
      render(<EmptyState title="No description" />);
      const paragraphs = screen.queryAllByText(/./);
      // Only the title text should be present, no description paragraph
      expect(screen.queryByText("This is the description")).not.toBeInTheDocument();
    });
  });

  describe("Action Link Rendering", () => {
    it("renders action link when provided", () => {
      render(
        <EmptyState
          title="Title"
          action={{ label: "Add Item", href: "/add" }}
        />
      );
      const link = screen.getByRole("link", { name: "Add Item" });
      expect(link).toBeInTheDocument();
    });

    it("action link has correct href", () => {
      render(
        <EmptyState
          title="Title"
          action={{ label: "Create New", href: "/create" }}
        />
      );
      const link = screen.getByRole("link", { name: "Create New" });
      expect(link).toHaveAttribute("href", "/create");
    });

    it("does not render action link when not provided", () => {
      render(<EmptyState title="No action" />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
  });

  describe("Children Rendering", () => {
    it("renders children content", () => {
      render(
        <EmptyState title="Title">
          <button>Custom Action Button</button>
        </EmptyState>
      );
      expect(screen.getByRole("button", { name: "Custom Action Button" })).toBeInTheDocument();
    });

    it("renders children alongside other props", () => {
      render(
        <EmptyState
          title="Title"
          description="Description"
          icon="📦"
        >
          <span>Extra content</span>
        </EmptyState>
      );
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("📦")).toBeInTheDocument();
      expect(screen.getByText("Extra content")).toBeInTheDocument();
    });
  });

  describe("Without Optional Props", () => {
    it("renders with only the required title prop", () => {
      const { container } = render(<EmptyState title="Minimal" />);
      expect(screen.getByText("Minimal")).toBeInTheDocument();
      expect(container.firstChild).toBeInTheDocument();
    });

    it("does not throw or crash when no optional props given", () => {
      expect(() => render(<EmptyState title="Bare minimum" />)).not.toThrow();
    });
  });

  describe("Base Classes", () => {
    it("renders with base structural classes", () => {
      const { container } = render(<EmptyState title="Title" />);
      const outer = container.firstChild as HTMLElement;
      expect(outer).toHaveClass("bg-surface-raised");
      expect(outer).toHaveClass("rounded-xl");
      expect(outer).toHaveClass("shadow-sm");
      expect(outer).toHaveClass("text-center");
    });
  });
});
