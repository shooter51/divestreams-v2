/**
 * ConfirmModal Component Unit Tests
 * DS-lu26: Reusable confirmation dialog replacing window.confirm().
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmModal } from "../../../../../app/components/ui/ConfirmModal";

const defaultProps = {
  isOpen: true,
  title: "Delete item?",
  message: "This cannot be undone.",
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("ConfirmModal", () => {
  describe("visibility", () => {
    it("renders nothing when isOpen is false", () => {
      const { container } = render(
        <ConfirmModal {...defaultProps} isOpen={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders dialog when isOpen is true", () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("content", () => {
    it("renders the title", () => {
      render(<ConfirmModal {...defaultProps} title="Confirm deletion" />);
      expect(screen.getByText("Confirm deletion")).toBeInTheDocument();
    });

    it("renders the message", () => {
      render(<ConfirmModal {...defaultProps} message="Are you sure?" />);
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    });

    it("renders default confirm label", () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    });

    it("renders default cancel label", () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("renders custom confirm label", () => {
      render(<ConfirmModal {...defaultProps} confirmLabel="Delete" />);
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    });

    it("renders custom cancel label", () => {
      render(<ConfirmModal {...defaultProps} cancelLabel="Go back" />);
      expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("calls onConfirm when confirm button is clicked", () => {
      const onConfirm = vi.fn();
      render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when cancel button is clicked", () => {
      const onCancel = vi.fn();
      render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when backdrop is clicked", () => {
      const onCancel = vi.fn();
      render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
      fireEvent.click(screen.getByTestId("modal-backdrop"));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("does not call onCancel when dialog content is clicked", () => {
      const onCancel = vi.fn();
      render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole("dialog"));
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe("danger variant", () => {
    it("confirm button has danger styling when danger=true", () => {
      render(<ConfirmModal {...defaultProps} danger confirmLabel="Delete" />);
      const btn = screen.getByRole("button", { name: "Delete" });
      expect(btn.className).toMatch(/bg-danger/);
    });

    it("confirm button does not have danger styling by default", () => {
      render(<ConfirmModal {...defaultProps} confirmLabel="Confirm" />);
      const btn = screen.getByRole("button", { name: "Confirm" });
      expect(btn.className).not.toMatch(/bg-danger/);
    });
  });

  describe("accessibility", () => {
    it("has role=dialog on the modal container", () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal=true", () => {
      render(<ConfirmModal {...defaultProps} />);
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("has aria-labelledby pointing to the title", () => {
      render(<ConfirmModal {...defaultProps} title="My Title" />);
      const dialog = screen.getByRole("dialog");
      const labelledBy = dialog.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      const titleEl = document.getElementById(labelledBy!);
      expect(titleEl?.textContent).toBe("My Title");
    });
  });
});
