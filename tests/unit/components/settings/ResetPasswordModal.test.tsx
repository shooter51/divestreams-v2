import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResetPasswordModal } from "../../../../app/components/settings/ResetPasswordModal";

describe("ResetPasswordModal", () => {
  it("should render with user information", () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ResetPasswordModal
        user={{ id: "123", name: "John Doe", email: "john@example.com" }}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText(/Reset Password for John Doe/i)).toBeInTheDocument();
  });

  it("should show three method options", () => {
    render(
      <ResetPasswordModal
        user={{ id: "123", name: "Test", email: "test@example.com" }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/Auto-Generate/i)).toBeInTheDocument();
    expect(screen.getByText(/Manual Entry/i)).toBeInTheDocument();
    expect(screen.getByText(/Email Reset Link/i)).toBeInTheDocument();
  });

  it("should call onSubmit with correct data", () => {
    const onSubmit = vi.fn();

    render(
      <ResetPasswordModal
        user={{ id: "123", name: "Test", email: "test@example.com" }}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Reset Password/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      userId: "123",
      method: "auto_generated",
    });
  });
});
