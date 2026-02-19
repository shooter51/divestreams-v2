/**
 * Card Component Unit Tests
 *
 * Tests the Card, CardHeader, and ClickableCard components including:
 * - Card: children rendering, padding variants, className
 * - CardHeader: title, description, action rendering
 * - ClickableCard: click handler, keyboard navigation (Enter/Space), selected state
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Card, CardHeader, ClickableCard } from "../../../../../app/components/ui/Card";

describe("Card Component", () => {
  describe("Children Rendering", () => {
    it("renders children content", () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("renders complex children", () => {
      render(
        <Card>
          <h2>Title</h2>
          <p>Description</p>
        </Card>
      );
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
    });
  });

  describe("Padding Variants", () => {
    it("renders sm padding with p-4 class", () => {
      const { container } = render(<Card padding="sm">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("p-4");
    });

    it("renders md padding with p-6 class", () => {
      const { container } = render(<Card padding="md">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("p-6");
    });

    it("renders lg padding with p-8 class", () => {
      const { container } = render(<Card padding="lg">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("p-8");
    });

    it("defaults to md padding when no padding prop provided", () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("p-6");
    });
  });

  describe("Base Classes", () => {
    it("always renders with base structural classes", () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("bg-surface-raised");
      expect(card).toHaveClass("rounded-xl");
      expect(card).toHaveClass("shadow-sm");
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      const { container } = render(<Card className="my-card">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("my-card");
    });

    it("preserves base classes alongside custom className", () => {
      const { container } = render(<Card className="extra">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("extra");
      expect(card).toHaveClass("bg-surface-raised");
    });
  });
});

describe("CardHeader Component", () => {
  describe("Title Rendering", () => {
    it("renders the title text", () => {
      render(<CardHeader title="Card Title" />);
      expect(screen.getByText("Card Title")).toBeInTheDocument();
    });

    it("renders title in an h2 element", () => {
      render(<CardHeader title="My Title" />);
      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("My Title");
    });
  });

  describe("Description Rendering", () => {
    it("renders description when provided", () => {
      render(<CardHeader title="Title" description="Some description" />);
      expect(screen.getByText("Some description")).toBeInTheDocument();
    });

    it("does not render description element when not provided", () => {
      const { container } = render(<CardHeader title="Title" />);
      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs.length).toBe(0);
    });
  });

  describe("Action Rendering", () => {
    it("renders action content when provided", () => {
      render(<CardHeader title="Title" action={<button>Edit</button>} />);
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("does not render action wrapper when no action provided", () => {
      const { container } = render(<CardHeader title="Title" />);
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(0);
    });

    it("renders both description and action together", () => {
      render(
        <CardHeader
          title="Title"
          description="Description text"
          action={<button>Action</button>}
        />
      );
      expect(screen.getByText("Description text")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    });
  });

  describe("Layout Classes", () => {
    it("renders with flex layout classes", () => {
      const { container } = render(<CardHeader title="Title" />);
      const header = container.firstChild as HTMLElement;
      expect(header).toHaveClass("flex");
      expect(header).toHaveClass("justify-between");
      expect(header).toHaveClass("items-start");
      expect(header).toHaveClass("mb-4");
    });
  });
});

describe("ClickableCard Component", () => {
  describe("Children Rendering", () => {
    it("renders children content", () => {
      render(<ClickableCard onClick={() => {}}>Clickable content</ClickableCard>);
      expect(screen.getByText("Clickable content")).toBeInTheDocument();
    });
  });

  describe("Click Handling", () => {
    it("calls onClick when clicked", () => {
      const handleClick = vi.fn();
      render(<ClickableCard onClick={handleClick}>Click me</ClickableCard>);
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not throw when no onClick provided and card is clicked", () => {
      expect(() => {
        render(<ClickableCard>No handler</ClickableCard>);
        fireEvent.click(screen.getByRole("button"));
      }).not.toThrow();
    });
  });

  describe("Keyboard Navigation", () => {
    it("calls onClick when Enter key is pressed", () => {
      const handleClick = vi.fn();
      render(<ClickableCard onClick={handleClick}>Press Enter</ClickableCard>);
      const card = screen.getByRole("button");
      fireEvent.keyDown(card, { key: "Enter" });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("calls onClick when Space key is pressed", () => {
      const handleClick = vi.fn();
      render(<ClickableCard onClick={handleClick}>Press Space</ClickableCard>);
      const card = screen.getByRole("button");
      fireEvent.keyDown(card, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick for other key presses", () => {
      const handleClick = vi.fn();
      render(<ClickableCard onClick={handleClick}>Key press</ClickableCard>);
      const card = screen.getByRole("button");
      fireEvent.keyDown(card, { key: "Tab" });
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("has tabIndex 0 for keyboard focusability", () => {
      render(<ClickableCard>Focusable</ClickableCard>);
      const card = screen.getByRole("button");
      expect(card).toHaveAttribute("tabIndex", "0");
    });
  });

  describe("Selected State", () => {
    it("applies ring classes when selected is true", () => {
      const { container } = render(
        <ClickableCard selected={true} onClick={() => {}}>Selected</ClickableCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("ring-2");
      expect(card).toHaveClass("ring-brand");
    });

    it("does not apply ring classes when selected is false", () => {
      const { container } = render(
        <ClickableCard selected={false} onClick={() => {}}>Not selected</ClickableCard>
      );
      const card = container.firstChild as HTMLElement;
      // Should not have the always-on ring classes from selected state
      // (hover ring is conditional, not testable without interaction)
      expect(card.className).not.toMatch(/(?<!\S)ring-2(?!\S)/);
    });

    it("defaults to not selected", () => {
      const { container } = render(<ClickableCard>Default state</ClickableCard>);
      const card = container.firstChild as HTMLElement;
      // No static ring-2 class without selected
      const hasStaticRing = card.className.includes("ring-2") && !card.className.includes("hover:ring-2");
      expect(hasStaticRing).toBe(false);
    });
  });

  describe("Base Classes", () => {
    it("always renders with base structural classes", () => {
      const { container } = render(<ClickableCard>Content</ClickableCard>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("bg-surface-raised");
      expect(card).toHaveClass("rounded-xl");
      expect(card).toHaveClass("shadow-sm");
      expect(card).toHaveClass("cursor-pointer");
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      const { container } = render(
        <ClickableCard className="my-clickable-card">Content</ClickableCard>
      );
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("my-clickable-card");
    });
  });

  describe("Role", () => {
    it("has role='button'", () => {
      render(<ClickableCard>Content</ClickableCard>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });
});
