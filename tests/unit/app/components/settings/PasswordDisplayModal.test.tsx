/**
 * PasswordDisplayModal Component Unit Tests
 *
 * Tests password display, clipboard copy, Close button,
 * Escape key listener, and ARIA dialog attributes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PasswordDisplayModal } from "../../../../../app/components/settings/PasswordDisplayModal";

const defaultProps = {
  password: "Tr0ub4dor&3",
  onClose: vi.fn(),
};

describe("PasswordDisplayModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("content", () => {
    it("renders the password inside a code element", () => {
      render(<PasswordDisplayModal {...defaultProps} />);

      const code = document.querySelector("code");
      expect(code).toBeInTheDocument();
      expect(code?.textContent).toBe("Tr0ub4dor&3");
    });

    it("renders 'Copy to Clipboard' button", () => {
      render(<PasswordDisplayModal {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /copy.*clipboard/i }),
      ).toBeInTheDocument();
    });

    it("renders 'Close' button", () => {
      render(<PasswordDisplayModal {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /close/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Close button", () => {
    it("calls onClose when Close button is clicked", () => {
      const onClose = vi.fn();
      render(<PasswordDisplayModal {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByRole("button", { name: /close password display/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("ARIA attributes", () => {
    it("has role='dialog'", () => {
      render(<PasswordDisplayModal {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal='true'", () => {
      render(<PasswordDisplayModal {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });
  });

  describe("Escape key handler", () => {
    it("calls onClose when Escape key is pressed", () => {
      const onClose = vi.fn();
      render(<PasswordDisplayModal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose for other keys", () => {
      const onClose = vi.fn();
      render(<PasswordDisplayModal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "a" });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("copy to clipboard", () => {
    it("calls navigator.clipboard.writeText with the password", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
        configurable: true,
      });

      render(<PasswordDisplayModal {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /copy.*clipboard/i }));
      });

      expect(writeText).toHaveBeenCalledWith("Tr0ub4dor&3");
    });

    it("changes button text to 'Copied!' after clicking copy", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        writable: true,
        configurable: true,
      });

      render(<PasswordDisplayModal {...defaultProps} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /copy.*clipboard/i }));
      });

      expect(screen.getByText(/copied!/i)).toBeInTheDocument();
    });
  });
});
