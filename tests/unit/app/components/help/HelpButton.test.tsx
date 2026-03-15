/**
 * HelpButton Component Unit Tests
 *
 * Tests rendering, ARIA attributes, and click behaviour for the floating
 * help action button.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HelpButton } from "../../../../../app/components/help/HelpButton";

describe("HelpButton", () => {
  const defaultProps = {
    onClick: vi.fn(),
    isOpen: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders a button element", () => {
      render(<HelpButton {...defaultProps} />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders the question-mark icon when closed", () => {
      render(<HelpButton {...defaultProps} isOpen={false} />);
      const btn = screen.getByRole("button");
      // The SVG for the question mark path contains 'M8.228'
      expect(btn.querySelector("svg")).toBeInTheDocument();
    });

    it("renders the close icon when open", () => {
      render(<HelpButton {...defaultProps} isOpen={true} />);
      const btn = screen.getByRole("button");
      expect(btn.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("aria attributes", () => {
    it("has aria-label='Open help' when closed", () => {
      render(<HelpButton {...defaultProps} isOpen={false} />);
      expect(screen.getByRole("button", { name: /open help/i })).toBeInTheDocument();
    });

    it("has aria-label='Close help' when open", () => {
      render(<HelpButton {...defaultProps} isOpen={true} />);
      expect(screen.getByRole("button", { name: /close help/i })).toBeInTheDocument();
    });

    it("has aria-expanded=false when closed", () => {
      render(<HelpButton {...defaultProps} isOpen={false} />);
      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    });

    it("has aria-expanded=true when open", () => {
      render(<HelpButton {...defaultProps} isOpen={true} />);
      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    });

    it("has aria-haspopup='dialog'", () => {
      render(<HelpButton {...defaultProps} />);
      expect(screen.getByRole("button")).toHaveAttribute("aria-haspopup", "dialog");
    });
  });

  describe("interaction", () => {
    it("calls onClick when clicked", () => {
      const onClick = vi.fn();
      render(<HelpButton {...defaultProps} onClick={onClick} />);
      fireEvent.click(screen.getByRole("button"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
