/**
 * Button Component Unit Tests
 *
 * Tests the Button and LinkButton components including:
 * - Default rendering
 * - All variant styles
 * - All size styles
 * - Loading state behavior
 * - Disabled state behavior
 * - Click handler
 * - LinkButton renders as an anchor element
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, LinkButton } from "../../../../../app/components/ui/Button";

vi.mock("react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

describe("Button Component", () => {
  describe("Default Rendering", () => {
    it("renders children content", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText("Click me")).toBeInTheDocument();
    });

    it("renders as a button element", () => {
      render(<Button>Button</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("applies default primary variant class", () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-brand");
    });

    it("applies default md size class", () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("px-4");
      expect(button).toHaveClass("py-2");
    });

    it("applies base structural classes", () => {
      render(<Button>Base</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("rounded-lg");
      expect(button).toHaveClass("font-medium");
      expect(button).toHaveClass("transition-colors");
    });
  });

  describe("Variants", () => {
    it("renders primary variant with correct classes", () => {
      render(<Button variant="primary">Primary</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-brand");
      expect(button).toHaveClass("text-white");
    });

    it("renders secondary variant with correct classes", () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-surface");
      expect(button).toHaveClass("text-foreground");
      expect(button).toHaveClass("border");
    });

    it("renders danger variant with correct classes", () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-danger");
      expect(button).toHaveClass("text-white");
    });

    it("renders success variant with correct classes", () => {
      render(<Button variant="success">Success</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-success");
      expect(button).toHaveClass("text-white");
    });

    it("renders ghost variant with correct classes", () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("text-foreground-muted");
    });
  });

  describe("Sizes", () => {
    it("renders sm size with correct classes", () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("px-3");
      expect(button).toHaveClass("py-1.5");
      expect(button).toHaveClass("text-sm");
    });

    it("renders md size with correct classes", () => {
      render(<Button size="md">Medium</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("px-4");
      expect(button).toHaveClass("py-2");
    });

    it("renders lg size with correct classes", () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("px-6");
      expect(button).toHaveClass("py-3");
      expect(button).toHaveClass("text-lg");
    });
  });

  describe("Loading State", () => {
    it("shows 'Loading...' text when loading is true", () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(screen.queryByText("Submit")).not.toBeInTheDocument();
    });

    it("disables the button when loading is true", () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("is not disabled when loading is false", () => {
      render(<Button loading={false}>Submit</Button>);
      expect(screen.getByRole("button")).not.toBeDisabled();
    });
  });

  describe("Disabled State", () => {
    it("disables the button when disabled prop is true", () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("is not disabled by default", () => {
      render(<Button>Enabled</Button>);
      expect(screen.getByRole("button")).not.toBeDisabled();
    });

    it("is disabled when both disabled and loading are true", () => {
      render(<Button disabled loading>Both</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("Click Handler", () => {
    it("calls onClick handler when clicked", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Click me</Button>);
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("does not call onClick when loading", () => {
      const handleClick = vi.fn();
      render(<Button loading onClick={handleClick}>Click me</Button>);
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      render(<Button className="my-custom-class">Custom</Button>);
      expect(screen.getByRole("button")).toHaveClass("my-custom-class");
    });

    it("preserves variant classes alongside custom className", () => {
      render(<Button variant="primary" className="extra">Primary Custom</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("extra");
      expect(button).toHaveClass("bg-brand");
    });
  });

  describe("Additional Props", () => {
    it("passes through additional HTML button attributes", () => {
      render(<Button type="submit" data-testid="submit-btn">Submit</Button>);
      const button = screen.getByTestId("submit-btn");
      expect(button).toHaveAttribute("type", "submit");
    });
  });
});

describe("LinkButton Component", () => {
  it("renders as an anchor element", () => {
    render(<LinkButton to="/some-path">Go to Page</LinkButton>);
    const link = screen.getByRole("link", { name: "Go to Page" });
    expect(link).toBeInTheDocument();
  });

  it("renders with the correct href", () => {
    render(<LinkButton to="/some-path">Go to Page</LinkButton>);
    const link = screen.getByRole("link", { name: "Go to Page" });
    expect(link).toHaveAttribute("href", "/some-path");
  });

  it("renders children content", () => {
    render(<LinkButton to="/path">Link Text</LinkButton>);
    expect(screen.getByText("Link Text")).toBeInTheDocument();
  });

  it("applies default primary variant classes", () => {
    render(<LinkButton to="/path">Primary Link</LinkButton>);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("bg-brand");
    expect(link).toHaveClass("text-white");
  });

  it("renders secondary variant with correct classes", () => {
    render(<LinkButton to="/path" variant="secondary">Secondary Link</LinkButton>);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("bg-surface");
  });

  it("renders danger variant with correct classes", () => {
    render(<LinkButton to="/path" variant="danger">Danger Link</LinkButton>);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("bg-danger");
  });

  it("renders sm size with correct classes", () => {
    render(<LinkButton to="/path" size="sm">Small Link</LinkButton>);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("px-3");
    expect(link).toHaveClass("text-sm");
  });

  it("renders lg size with correct classes", () => {
    render(<LinkButton to="/path" size="lg">Large Link</LinkButton>);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("px-6");
    expect(link).toHaveClass("text-lg");
  });

  it("applies custom className", () => {
    render(<LinkButton to="/path" className="my-link-class">Custom Link</LinkButton>);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("my-link-class");
  });

  it("applies base structural classes", () => {
    render(<LinkButton to="/path">Structured Link</LinkButton>);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("rounded-lg");
    expect(link).toHaveClass("font-medium");
    expect(link).toHaveClass("transition-colors");
    expect(link).toHaveClass("inline-block");
  });
});
