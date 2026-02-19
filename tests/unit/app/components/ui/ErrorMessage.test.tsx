/**
 * ErrorMessage Component Unit Tests
 *
 * Tests the ErrorMessage component including:
 * - Returns null when no error prop
 * - Returns null when error is null
 * - Renders error text with role="alert"
 * - Applies custom className
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorMessage } from "../../../../../app/components/ui/ErrorMessage";

describe("ErrorMessage Component", () => {
  describe("No Error Rendering", () => {
    it("renders nothing when error prop is undefined", () => {
      const { container } = render(<ErrorMessage />);
      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when error prop is null", () => {
      const { container } = render(<ErrorMessage error={null} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when error is an empty string", () => {
      const { container } = render(<ErrorMessage error="" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Error Rendering", () => {
    it("renders the error text when error is a non-empty string", () => {
      render(<ErrorMessage error="Something went wrong" />);
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("renders with role='alert'", () => {
      render(<ErrorMessage error="An error occurred" />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("renders a long error message correctly", () => {
      const longError = "This is a very detailed error message that explains what went wrong in detail.";
      render(<ErrorMessage error={longError} />);
      expect(screen.getByText(longError)).toBeInTheDocument();
    });
  });

  describe("Custom className", () => {
    it("applies custom className to the alert container", () => {
      render(<ErrorMessage error="Error" className="my-error-class" />);
      const alertDiv = screen.getByRole("alert");
      expect(alertDiv).toHaveClass("my-error-class");
    });

    it("preserves base classes alongside custom className", () => {
      render(<ErrorMessage error="Error" className="extra-class" />);
      const alertDiv = screen.getByRole("alert");
      expect(alertDiv).toHaveClass("extra-class");
      expect(alertDiv).toHaveClass("text-sm");
    });

    it("does not apply className when rendering null", () => {
      const { container } = render(<ErrorMessage className="my-class" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Base Classes", () => {
    it("renders with base structural classes when error is present", () => {
      render(<ErrorMessage error="Error message" />);
      const alertDiv = screen.getByRole("alert");
      expect(alertDiv).toHaveClass("p-3");
      expect(alertDiv).toHaveClass("rounded-lg");
      expect(alertDiv).toHaveClass("text-sm");
    });
  });

  describe("Icon Rendering", () => {
    it("renders an SVG icon when error is present", () => {
      render(<ErrorMessage error="Error with icon" />);
      const alertDiv = screen.getByRole("alert");
      const svg = alertDiv.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });
});
