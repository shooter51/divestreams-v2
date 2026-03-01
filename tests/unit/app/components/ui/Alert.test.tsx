/**
 * Alert Component Unit Tests
 *
 * Tests the Alert component including:
 * - Rendering children content
 * - All 4 variant styles (success, error, warning, info)
 * - Custom className application
 * - Default variant fallback
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert } from "../../../../../app/components/ui/Alert";

describe("Alert Component", () => {
  describe("Children Rendering", () => {
    it("renders children content", () => {
      render(<Alert>This is an alert message</Alert>);
      expect(screen.getByText("This is an alert message")).toBeInTheDocument();
    });

    it("renders complex children", () => {
      render(
        <Alert>
          <strong>Bold text</strong>
          <span>Normal text</span>
        </Alert>
      );
      expect(screen.getByText("Bold text")).toBeInTheDocument();
      expect(screen.getByText("Normal text")).toBeInTheDocument();
    });
  });

  describe("Variant Classes", () => {
    it("renders success variant with correct classes", () => {
      const { container } = render(<Alert variant="success">Success alert</Alert>);
      const alertDiv = container.firstChild as HTMLElement;
      expect(alertDiv).toHaveClass("bg-success-muted");
      expect(alertDiv).toHaveClass("text-success");
      expect(alertDiv).toHaveClass("border-success");
    });

    it("renders error variant with correct classes", () => {
      const { container } = render(<Alert variant="error">Error alert</Alert>);
      const alertDiv = container.firstChild as HTMLElement;
      expect(alertDiv).toHaveClass("bg-danger-muted");
      expect(alertDiv).toHaveClass("text-danger");
      expect(alertDiv).toHaveClass("border-danger");
    });

    it("renders warning variant with correct classes", () => {
      const { container } = render(<Alert variant="warning">Warning alert</Alert>);
      const alertDiv = container.firstChild as HTMLElement;
      expect(alertDiv).toHaveClass("bg-warning-muted");
      expect(alertDiv).toHaveClass("text-warning");
      expect(alertDiv).toHaveClass("border-warning");
    });

    it("renders info variant with correct classes", () => {
      const { container } = render(<Alert variant="info">Info alert</Alert>);
      const alertDiv = container.firstChild as HTMLElement;
      expect(alertDiv).toHaveClass("bg-brand-muted");
      expect(alertDiv).toHaveClass("text-brand");
      expect(alertDiv).toHaveClass("border-brand");
    });
  });

  describe("Default Variant", () => {
    it("defaults to info variant when no variant is provided", () => {
      const { container } = render(<Alert>Default alert</Alert>);
      const alertDiv = container.firstChild as HTMLElement;
      expect(alertDiv).toHaveClass("bg-brand-muted");
      expect(alertDiv).toHaveClass("text-brand");
      expect(alertDiv).toHaveClass("border-brand");
    });
  });

  describe("Custom className", () => {
    it("applies custom className alongside variant classes", () => {
      const { container } = render(
        <Alert variant="info" className="my-custom-class">
          Alert with custom class
        </Alert>
      );
      const alertDiv = container.firstChild as HTMLElement;
      expect(alertDiv).toHaveClass("my-custom-class");
      expect(alertDiv).toHaveClass("bg-brand-muted");
    });

    it("applies multiple custom classes", () => {
      const { container } = render(
        <Alert className="class-one class-two">Alert</Alert>
      );
      const alertDiv = container.firstChild as HTMLElement;
      expect(alertDiv).toHaveClass("class-one");
      expect(alertDiv).toHaveClass("class-two");
    });
  });

  describe("Base Classes", () => {
    it("always renders with base structural classes", () => {
      const { container } = render(<Alert>Base classes alert</Alert>);
      const alertDiv = container.firstChild as HTMLElement;
      expect(alertDiv).toHaveClass("p-4");
      expect(alertDiv).toHaveClass("rounded-lg");
      expect(alertDiv).toHaveClass("border");
    });
  });
});
