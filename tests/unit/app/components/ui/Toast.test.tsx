/**
 * Toast Component Unit Tests
 *
 * Tests the Toast notification component including:
 * - Visual rendering for all types
 * - Auto-dismiss behavior
 * - Manual dismiss functionality
 * - Accessibility (ARIA attributes, reduced motion, touch targets)
 * - Multiple toast stacking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ToastContainer, type Toast } from "../../../../../app/components/ui/Toast";

describe("Toast Component", () => {
  const mockOnDismiss = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("Toast Type Rendering", () => {
    it("renders success toast with correct styling and icon", () => {
      const toast: Toast = {
        id: "toast-1",
        message: "Operation successful",
        type: "success",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastElement = screen.getByRole("status");
      expect(toastElement).toBeInTheDocument();
      expect(toastElement).toHaveClass("bg-success-muted", "border-success", "text-success");
      expect(screen.getByText("✓")).toBeInTheDocument();
      expect(screen.getByText("Operation successful")).toBeInTheDocument();
    });

    it("renders error toast with correct styling and icon", () => {
      const toast: Toast = {
        id: "toast-2",
        message: "Operation failed",
        type: "error",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastElement = screen.getByRole("alert");
      expect(toastElement).toBeInTheDocument();
      expect(toastElement).toHaveClass("bg-danger-muted", "border-danger", "text-danger");
      expect(screen.getByText("✕")).toBeInTheDocument();
      expect(screen.getByText("Operation failed")).toBeInTheDocument();
    });

    it("renders warning toast with correct styling and icon", () => {
      const toast: Toast = {
        id: "toast-3",
        message: "Warning message",
        type: "warning",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastElement = screen.getByRole("alert");
      expect(toastElement).toBeInTheDocument();
      expect(toastElement).toHaveClass("bg-warning-muted", "border-warning", "text-warning");
      expect(screen.getByText("⚠")).toBeInTheDocument();
      expect(screen.getByText("Warning message")).toBeInTheDocument();
    });

    it("renders info toast with correct styling and icon", () => {
      const toast: Toast = {
        id: "toast-4",
        message: "Information message",
        type: "info",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastElement = screen.getByRole("status");
      expect(toastElement).toBeInTheDocument();
      expect(toastElement).toHaveClass("bg-brand-muted", "border-brand", "text-brand");
      expect(screen.getByText("ℹ")).toBeInTheDocument();
      expect(screen.getByText("Information message")).toBeInTheDocument();
    });
  });

  describe("Auto-Dismiss Behavior", () => {
    it("auto-dismisses after default 5 seconds", async () => {
      const toast: Toast = {
        id: "toast-auto",
        message: "Auto dismiss test",
        type: "success",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      expect(screen.getByText("Auto dismiss test")).toBeInTheDocument();

      // Fast-forward to just before dismiss
      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(mockOnDismiss).not.toHaveBeenCalled();

      // Fast-forward past dismiss time (5000ms + 300ms animation)
      await act(async () => {
        vi.advanceTimersByTime(301);
        await Promise.resolve();
      });

      expect(mockOnDismiss).toHaveBeenCalledWith("toast-auto");
    });

    it("respects custom duration", async () => {
      const toast: Toast = {
        id: "toast-custom",
        message: "Custom duration test",
        type: "info",
        duration: 2000,
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      // Fast-forward to custom duration + animation
      await act(async () => {
        vi.advanceTimersByTime(2300);
        await Promise.resolve();
      });

      expect(mockOnDismiss).toHaveBeenCalledWith("toast-custom");
    });

    it("cleans up timers on unmount", () => {
      const toast: Toast = {
        id: "toast-cleanup",
        message: "Cleanup test",
        type: "success",
      };

      const { unmount } = render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      // Unmount before auto-dismiss
      unmount();

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should not call onDismiss after unmount
      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe("Manual Dismiss", () => {
    it("dismisses toast when dismiss button is clicked", async () => {
      const toast: Toast = {
        id: "toast-manual",
        message: "Manual dismiss test",
        type: "success",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByRole("button", { name: /dismiss notification/i });

      // Use fireEvent instead of userEvent when working with fake timers
      act(() => {
        fireEvent.click(dismissButton);
      });

      // Should trigger exit animation, then dismiss after 300ms
      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      expect(mockOnDismiss).toHaveBeenCalledWith("toast-manual");
    });

    it("dismiss button has accessible label", () => {
      const toast: Toast = {
        id: "toast-a11y",
        message: "Accessibility test",
        type: "info",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByRole("button", { name: /dismiss notification/i });
      expect(dismissButton).toHaveAttribute("aria-label", "Dismiss notification");
    });
  });

  describe("Multiple Toasts (Stacking)", () => {
    it("renders multiple toasts simultaneously", () => {
      const toasts: Toast[] = [
        { id: "toast-1", message: "First toast", type: "success" },
        { id: "toast-2", message: "Second toast", type: "error" },
        { id: "toast-3", message: "Third toast", type: "info" },
      ];

      render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);

      expect(screen.getByText("First toast")).toBeInTheDocument();
      expect(screen.getByText("Second toast")).toBeInTheDocument();
      expect(screen.getByText("Third toast")).toBeInTheDocument();
    });

    it("dismisses specific toast without affecting others", async () => {
      const toasts: Toast[] = [
        { id: "toast-1", message: "First toast", type: "success" },
        { id: "toast-2", message: "Second toast", type: "info" },
      ];

      render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);

      // Click dismiss on first toast - use fireEvent with fake timers
      const buttons = screen.getAllByRole("button", { name: /dismiss notification/i });

      act(() => {
        fireEvent.click(buttons[0]);
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      expect(mockOnDismiss).toHaveBeenCalledWith("toast-1");

      // Second toast should still be visible
      expect(screen.getByText("Second toast")).toBeInTheDocument();
    });
  });

  describe("Accessibility (WCAG 2.1)", () => {
    it("uses role='alert' for error toasts (assertive)", () => {
      const toast: Toast = {
        id: "toast-error-aria",
        message: "Error occurred",
        type: "error",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastElement = screen.getByRole("alert");
      expect(toastElement).toHaveAttribute("aria-live", "assertive");
      expect(toastElement).toHaveAttribute("aria-atomic", "true");
    });

    it("uses role='alert' for warning toasts (assertive)", () => {
      const toast: Toast = {
        id: "toast-warning-aria",
        message: "Warning message",
        type: "warning",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastElement = screen.getByRole("alert");
      expect(toastElement).toHaveAttribute("aria-live", "assertive");
      expect(toastElement).toHaveAttribute("aria-atomic", "true");
    });

    it("uses role='status' for success toasts (polite)", () => {
      const toast: Toast = {
        id: "toast-success-aria",
        message: "Success message",
        type: "success",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastElement = screen.getByRole("status");
      expect(toastElement).toHaveAttribute("aria-live", "polite");
      expect(toastElement).toHaveAttribute("aria-atomic", "true");
    });

    it("uses role='status' for info toasts (polite)", () => {
      const toast: Toast = {
        id: "toast-info-aria",
        message: "Info message",
        type: "info",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastElement = screen.getByRole("status");
      expect(toastElement).toHaveAttribute("aria-live", "polite");
      expect(toastElement).toHaveAttribute("aria-atomic", "true");
    });

    it("dismiss button meets minimum touch target size (44x44px)", () => {
      const toast: Toast = {
        id: "toast-touch",
        message: "Touch target test",
        type: "success",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByRole("button", { name: /dismiss notification/i });

      // Check that button has min-h-[44px] and min-w-[44px] classes
      expect(dismissButton).toHaveClass("min-h-[44px]", "min-w-[44px]");
    });
  });

  describe("Reduced Motion Support (WCAG 2.3.3)", () => {
    it("disables animations when prefers-reduced-motion is active", () => {
      // Mock prefers-reduced-motion: reduce
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const toast: Toast = {
        id: "toast-reduced-motion",
        message: "Reduced motion test",
        type: "success",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastElement = screen.getByRole("status");

      // Should not have transition classes when reduced motion is preferred
      expect(toastElement).not.toHaveClass("transition-all", "duration-300");
    });
  });

  describe("ToastContainer", () => {
    it("renders nothing when toasts array is empty", () => {
      const { container } = render(<ToastContainer toasts={[]} onDismiss={mockOnDismiss} />);
      expect(container.firstChild).toBeNull();
    });

    it("container has correct positioning classes", () => {
      const toast: Toast = {
        id: "toast-position",
        message: "Position test",
        type: "info",
      };

      const { container } = render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastContainer = container.firstChild as HTMLElement;
      expect(toastContainer).toHaveClass(
        "fixed",
        "top-4",
        "right-4",
        "z-50",
        "flex",
        "flex-col",
        "items-end"
      );
    });

    it("container has correct ARIA attributes", () => {
      const toast: Toast = {
        id: "toast-container-aria",
        message: "Container ARIA test",
        type: "success",
      };

      const { container } = render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      const toastContainer = container.firstChild as HTMLElement;
      expect(toastContainer).toHaveAttribute("aria-live", "polite");
      expect(toastContainer).toHaveAttribute("aria-atomic", "true");
    });
  });

  describe("Edge Cases", () => {
    it("handles very long message text", () => {
      const longMessage = "This is a very long message that should still be displayed correctly in the toast notification without breaking the layout or causing overflow issues".repeat(2);

      const toast: Toast = {
        id: "toast-long",
        message: longMessage,
        type: "info",
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it("handles toast with zero duration (should use default)", async () => {
      const toast: Toast = {
        id: "toast-zero-duration",
        message: "Zero duration test",
        type: "success",
        duration: 0,
      };

      render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

      // Should use default duration (5000ms) when duration is 0
      await act(async () => {
        vi.advanceTimersByTime(5300);
        await Promise.resolve();
      });

      expect(mockOnDismiss).toHaveBeenCalledWith("toast-zero-duration");
    });

    it("handles rapid toast creation", () => {
      const toasts: Toast[] = Array.from({ length: 10 }, (_, i) => ({
        id: `toast-rapid-${i}`,
        message: `Toast ${i + 1}`,
        type: "success" as const,
      }));

      render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);

      toasts.forEach((toast) => {
        expect(screen.getByText(toast.message)).toBeInTheDocument();
      });
    });
  });
});
