/**
 * ChangePasswordForm Component Unit Tests
 *
 * Tests the button-to-form reveal flow, client-side validation
 * (length, match, same-as-current), cancel behaviour, and
 * successful form submission via fetcher.submit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangePasswordForm } from "../../../../../app/components/settings/ChangePasswordForm";

const mockSubmit = vi.fn();

vi.mock("react-router", () => ({
  useFetcher: () => ({ state: "idle", data: null, submit: mockSubmit }),
}));

const defaultProps = {
  userId: "user-abc-123",
};

// Helper: open the form modal
function openForm() {
  fireEvent.click(screen.getByRole("button", { name: /change password/i }));
}

// Helper: fill in the password fields and submit
function fillAndSubmit({
  current = "oldPassword1",
  next = "newPassword1",
  confirm = "newPassword1",
}: {
  current?: string;
  next?: string;
  confirm?: string;
} = {}) {
  fireEvent.change(screen.getByLabelText("Current Password"), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText("New Password"), {
    target: { value: next },
  });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), {
    target: { value: confirm },
  });
  fireEvent.click(screen.getByRole("button", { name: /^change password$/i }));
}

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("renders 'Change Password' button initially", () => {
      render(<ChangePasswordForm {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /change password/i }),
      ).toBeInTheDocument();
    });

    it("does not render the form initially", () => {
      render(<ChangePasswordForm {...defaultProps} />);

      expect(screen.queryByLabelText("Current Password")).not.toBeInTheDocument();
    });
  });

  describe("showing the form", () => {
    it("clicking the button reveals the form modal", () => {
      render(<ChangePasswordForm {...defaultProps} />);

      openForm();

      expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("shows error when new password is fewer than 8 characters", () => {
      render(<ChangePasswordForm {...defaultProps} />);
      openForm();

      fillAndSubmit({ next: "short", confirm: "short" });

      expect(
        screen.getByText(/at least 8 characters/i),
      ).toBeInTheDocument();
    });

    it("does not submit when new password is too short", () => {
      render(<ChangePasswordForm {...defaultProps} />);
      openForm();

      fillAndSubmit({ next: "short", confirm: "short" });

      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it("shows error when passwords do not match", () => {
      render(<ChangePasswordForm {...defaultProps} />);
      openForm();

      fillAndSubmit({ next: "newPassword1", confirm: "differentPass1" });

      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });

    it("does not submit when passwords do not match", () => {
      render(<ChangePasswordForm {...defaultProps} />);
      openForm();

      fillAndSubmit({ next: "newPassword1", confirm: "differentPass1" });

      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it("shows error when new password equals current password", () => {
      render(<ChangePasswordForm {...defaultProps} />);
      openForm();

      fillAndSubmit({
        current: "samePassword1",
        next: "samePassword1",
        confirm: "samePassword1",
      });

      expect(screen.getByText(/different from current/i)).toBeInTheDocument();
    });

    it("does not submit when new password equals current password", () => {
      render(<ChangePasswordForm {...defaultProps} />);
      openForm();

      fillAndSubmit({
        current: "samePassword1",
        next: "samePassword1",
        confirm: "samePassword1",
      });

      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe("Cancel button", () => {
    it("hides the form when Cancel is clicked", () => {
      render(<ChangePasswordForm {...defaultProps} />);
      openForm();

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(screen.queryByLabelText("Current Password")).not.toBeInTheDocument();
    });

    it("resets field values when Cancel is clicked", () => {
      render(<ChangePasswordForm {...defaultProps} />);
      openForm();

      fireEvent.change(screen.getByLabelText("Current Password"), {
        target: { value: "someValue" },
      });
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      // Re-open and verify the field is cleared
      openForm();
      const currentInput = screen.getByLabelText("Current Password") as HTMLInputElement;
      expect(currentInput.value).toBe("");
    });
  });

  describe("valid submission", () => {
    it("calls fetcher.submit with correct FormData on valid input", () => {
      render(<ChangePasswordForm {...defaultProps} />);
      openForm();

      fillAndSubmit({
        current: "oldPassword1",
        next: "newPassword1",
        confirm: "newPassword1",
      });

      expect(mockSubmit).toHaveBeenCalledTimes(1);

      // Verify FormData contains expected fields
      const [formData, options] = mockSubmit.mock.calls[0];
      expect(options.method).toBe("post");
      expect(formData.get("intent")).toBe("change-password");
      expect(formData.get("userId")).toBe("user-abc-123");
      expect(formData.get("currentPassword")).toBe("oldPassword1");
      expect(formData.get("newPassword")).toBe("newPassword1");
    });
  });
});
