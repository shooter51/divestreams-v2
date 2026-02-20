/**
 * Toast Notification Flow Integration Tests
 *
 * Tests the integration between ToastProvider, useToast, and Toast components.
 *
 * Note: Full Router navigation flow (useNotification hook) is tested in E2E tests.
 * These integration tests focus on component integration without Router complexity.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "../../../lib/toast-context";
import { redirectWithNotification } from "../../../lib/use-notification";

describe("Toast Notification Component Integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("ToastProvider + useToast + Toast Integration", () => {
    it("displays toast when showToast is called from a component", () => {
      const TestComponent = () => {
        const { showToast } = useToast();

        return (
          <button onClick={() => showToast("Integration test message", "success")}>
            Show Toast
          </button>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      const button = screen.getByRole("button");
      act(() => {
        fireEvent.click(button);
      });

      expect(screen.getByText("Integration test message")).toBeInTheDocument();
    });

    it("displays multiple toasts from different components", () => {
      const Component1 = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast("Toast 1", "success")}>Button 1</button>;
      };

      const Component2 = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast("Toast 2", "error")}>Button 2</button>;
      };

      render(
        <ToastProvider>
          <Component1 />
          <Component2 />
        </ToastProvider>
      );

      // Click both buttons
      const buttons = screen.getAllByRole("button");
      act(() => {
        fireEvent.click(buttons[0]);
        fireEvent.click(buttons[1]);
      });

      // Both toasts should be visible
      expect(screen.getByText("Toast 1")).toBeInTheDocument();
      expect(screen.getByText("Toast 2")).toBeInTheDocument();
    });

    it("auto-dismisses toasts after specified duration", async () => {
      const TestComponent = () => {
        const { showToast } = useToast();

        return (
          <button onClick={() => showToast("Auto dismiss test", "info", 2000)}>
            Show Toast
          </button>
        );
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      // Show toast
      const button = screen.getByRole("button");
      act(() => {
        fireEvent.click(button);
      });

      expect(screen.getByText("Auto dismiss test")).toBeInTheDocument();

      // Fast-forward to custom duration + animation time
      await act(async () => {
        vi.advanceTimersByTime(2300);
        await Promise.resolve();
      });

      // Toast should be dismissed
      expect(screen.queryByText("Auto dismiss test")).not.toBeInTheDocument();
    });

    it("manually dismisses toast when dismiss button clicked", async () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast("Manual dismiss", "warning")}>Show</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      // Show toast
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /show/i }));
      });

      expect(screen.getByText("Manual dismiss")).toBeInTheDocument();

      // Click dismiss button
      const dismissButton = screen.getByRole("button", { name: /dismiss notification/i });

      await act(async () => {
        fireEvent.click(dismissButton);
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      // Toast should be dismissed
      expect(screen.queryByText("Manual dismiss")).not.toBeInTheDocument();
    });

    it("dismisses specific toast without affecting others", async () => {
      const TestComponent = () => {
        const { showToast } = useToast();

        const showBoth = () => {
          showToast("Toast A", "success");
          showToast("Toast B", "info");
        };

        return <button onClick={showBoth}>Show Both</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      // Show both toasts
      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(screen.getByText("Toast A")).toBeInTheDocument();
      expect(screen.getByText("Toast B")).toBeInTheDocument();

      // Dismiss first toast
      const dismissButtons = screen.getAllByRole("button", { name: /dismiss notification/i });

      await act(async () => {
        fireEvent.click(dismissButtons[0]);
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      // Second toast should still be visible
      expect(screen.getByText("Toast B")).toBeInTheDocument();
    });
  });

  describe("Toast Types and Styling Integration", () => {
    it("renders success toast with correct styling and icon", () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast("Success", "success")}>Show</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      const toast = screen.getByRole("status");
      expect(toast).toHaveClass("bg-success-muted", "text-success");
      expect(toast.textContent).toContain("✓");
    });

    it("renders error toast with alert role and styling", () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast("Error", "error")}>Show</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      const toast = screen.getByRole("alert");
      expect(toast).toHaveClass("bg-danger-muted", "text-danger");
      expect(toast.textContent).toContain("✕");
      expect(toast).toHaveAttribute("aria-live", "assertive");
    });

    it("renders warning toast with alert role", () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast("Warning", "warning")}>Show</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      const toast = screen.getByRole("alert");
      expect(toast).toHaveClass("bg-warning-muted", "text-warning");
      expect(toast.textContent).toContain("⚠");
    });

    it("renders info toast with status role", () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast("Info", "info")}>Show</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      const toast = screen.getByRole("status");
      expect(toast).toHaveClass("bg-brand-muted", "text-brand");
      expect(toast.textContent).toContain("ℹ");
      expect(toast).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("Helper Function Integration", () => {
    it("redirectWithNotification creates URL compatible with expected format", () => {
      // Test that helper function output matches expected pattern
      const result = redirectWithNotification("/tours", "Tour created successfully", "success");

      expect(result).toContain("/tours");
      expect(result).toContain("?success=");
      expect(result).toContain("Tour+created+successfully");
    });

    it("redirectWithNotification handles all notification types", () => {
      const types = ["success", "error", "warning", "info"] as const;

      types.forEach((type) => {
        const result = redirectWithNotification("/test", "Test message", type);

        expect(result).toContain("/test");
        expect(result).toContain(`${type}=`);
      });
    });

    it("redirectWithNotification preserves existing query parameters", () => {
      const result = redirectWithNotification("/search?q=test&page=2", "Search done", "success");

      expect(result).toContain("q=test");
      expect(result).toContain("page=2");
      expect(result).toContain("success=Search+done");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("simulates form submission with success feedback", () => {
      const FormComponent = () => {
        const { showToast } = useToast();

        const handleSubmit = () => {
          // Simulate successful form submission
          showToast("Customer has been successfully created", "success");
        };

        return (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <input type="text" placeholder="Customer name" />
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(
        <ToastProvider>
          <FormComponent />
        </ToastProvider>
      );

      // Submit form
      const form = screen.getByRole("button", { name: /submit/i }).closest("form");
      act(() => {
        fireEvent.submit(form!);
      });

      // Success toast should be shown
      expect(screen.getByText("Customer has been successfully created")).toBeInTheDocument();
    });

    it("simulates error handling with error feedback", () => {
      const Component = () => {
        const { showToast } = useToast();

        const handleError = () => {
          showToast("A discount code with this code already exists", "error");
        };

        return <button onClick={handleError}>Trigger Error</button>;
      };

      render(
        <ToastProvider>
          <Component />
        </ToastProvider>
      );

      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(screen.getByText("A discount code with this code already exists")).toBeInTheDocument();

      // Should use alert role for errors
      const toast = screen.getByRole("alert");
      expect(toast).toBeInTheDocument();
    });

    it("simulates multiple operations showing sequential toasts", () => {
      const Component = () => {
        const { showToast } = useToast();

        return (
          <div>
            <button onClick={() => showToast("Operation 1 complete", "success")}>Op 1</button>
            <button onClick={() => showToast("Operation 2 complete", "success")}>Op 2</button>
            <button onClick={() => showToast("Operation 3 complete", "success")}>Op 3</button>
          </div>
        );
      };

      render(
        <ToastProvider>
          <Component />
        </ToastProvider>
      );

      const buttons = screen.getAllByRole("button");

      // Trigger all three operations
      act(() => {
        buttons.forEach((button) => fireEvent.click(button));
      });

      // All toasts should be visible
      expect(screen.getByText("Operation 1 complete")).toBeInTheDocument();
      expect(screen.getByText("Operation 2 complete")).toBeInTheDocument();
      expect(screen.getByText("Operation 3 complete")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid toast creation", () => {
      const Component = () => {
        const { showToast } = useToast();

        const showMany = () => {
          for (let i = 0; i < 10; i++) {
            showToast(`Toast ${i}`, "info");
          }
        };

        return <button onClick={showMany}>Show Many</button>;
      };

      render(
        <ToastProvider>
          <Component />
        </ToastProvider>
      );

      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      // All toasts should be rendered
      for (let i = 0; i < 10; i++) {
        expect(screen.getByText(`Toast ${i}`)).toBeInTheDocument();
      }
    });

    it("handles empty toast message", () => {
      const Component = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast("", "info")}>Show Empty</button>;
      };

      render(
        <ToastProvider>
          <Component />
        </ToastProvider>
      );

      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      // Should render toast without crashing
      const toasts = screen.getAllByRole("status");
      expect(toasts.length).toBeGreaterThan(0);
    });

    it("handles very long toast message", () => {
      const longMessage = "A".repeat(500);

      const Component = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast(longMessage, "info")}>Show Long</button>;
      };

      render(
        <ToastProvider>
          <Component />
        </ToastProvider>
      );

      act(() => {
        fireEvent.click(screen.getByRole("button"));
      });

      // Should render without crashing - toast should be visible
      const toast = screen.getByRole("status");
      expect(toast).toBeInTheDocument();
      expect(toast.textContent).toContain("AAAA");
    });
  });
});
