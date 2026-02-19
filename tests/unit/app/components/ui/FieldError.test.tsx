/**
 * FieldError Component Unit Tests
 *
 * Tests the FieldError and RequiredMark components including:
 * - FieldError returns null when no children
 * - FieldError renders error text
 * - FieldError applies custom className
 * - RequiredMark renders an asterisk
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldError, RequiredMark } from "../../../../../app/components/ui/FieldError";

describe("FieldError Component", () => {
  describe("No Children Rendering", () => {
    it("renders nothing when children is undefined", () => {
      const { container } = render(<FieldError>{undefined}</FieldError>);
      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when children is null", () => {
      const { container } = render(<FieldError>{null}</FieldError>);
      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when children is an empty string", () => {
      const { container } = render(<FieldError>{""}</FieldError>);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Error Text Rendering", () => {
    it("renders the error text when children is provided", () => {
      render(<FieldError>This field is required</FieldError>);
      expect(screen.getByText("This field is required")).toBeInTheDocument();
    });

    it("renders as a paragraph element", () => {
      const { container } = render(<FieldError>Error text</FieldError>);
      expect(container.firstChild?.nodeName).toBe("P");
    });

    it("renders complex children content", () => {
      render(
        <FieldError>
          <span>Formatted</span> error text
        </FieldError>
      );
      expect(screen.getByText("Formatted")).toBeInTheDocument();
    });
  });

  describe("Base Classes", () => {
    it("renders with text-danger and text-sm classes", () => {
      const { container } = render(<FieldError>Error</FieldError>);
      const paragraph = container.firstChild as HTMLElement;
      expect(paragraph).toHaveClass("text-danger");
      expect(paragraph).toHaveClass("text-sm");
      expect(paragraph).toHaveClass("mt-1");
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      const { container } = render(
        <FieldError className="my-field-error">Error</FieldError>
      );
      const paragraph = container.firstChild as HTMLElement;
      expect(paragraph).toHaveClass("my-field-error");
    });

    it("preserves base classes alongside custom className", () => {
      const { container } = render(
        <FieldError className="extra-class">Error</FieldError>
      );
      const paragraph = container.firstChild as HTMLElement;
      expect(paragraph).toHaveClass("extra-class");
      expect(paragraph).toHaveClass("text-danger");
    });
  });
});

describe("RequiredMark Component", () => {
  it("renders an asterisk character", () => {
    render(<RequiredMark />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders as a span element", () => {
    const { container } = render(<RequiredMark />);
    expect(container.firstChild?.nodeName).toBe("SPAN");
  });

  it("applies the text-danger class to the asterisk", () => {
    const { container } = render(<RequiredMark />);
    const span = container.firstChild as HTMLElement;
    expect(span).toHaveClass("text-danger");
  });
});
