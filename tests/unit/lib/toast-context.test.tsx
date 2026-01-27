/**
 * Toast Context Unit Tests
 *
 * Tests the ToastProvider and useToast hook including:
 * - Toast state management (showToast, dismissToast)
 * - Multiple toast handling
 * - Unique ID generation
 * - Error handling for hook usage outside provider
 * - Callback functionality
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../../../lib/toast-context";
import type { ReactNode } from "react";

describe("Toast Context", () => {
  describe("ToastProvider", () => {
    it("renders children correctly", () => {
      render(
        <ToastProvider>
          <div>Test Child</div>
        </ToastProvider>
      );

      expect(screen.getByText("Test Child")).toBeInTheDocument();
    });

    it("provides toast context to children", () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast("Test", "info")}>Show Toast</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders ToastContainer with toasts when showToast is called", () => {
      const TestComponent = () => {
        const { showToast } = useToast();
        return <button onClick={() => showToast("Test toast", "info")}>Show Toast</button>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      // Click button to show toast
      const button = screen.getByRole("button");
      act(() => {
        button.click();
      });

      // ToastContainer should now be visible with the toast
      expect(screen.getByText("Test toast")).toBeInTheDocument();

      // Container should have aria-live attribute
      const container = screen.getByRole("status").closest('[aria-live="polite"]');
      expect(container).toBeInTheDocument();
    });
  });

  describe("useToast hook", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );

    it("throws error when used outside ToastProvider", () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        renderHook(() => useToast());
      }).toThrow("useToast must be used within a ToastProvider");

      console.error = originalError;
    });

    it("showToast adds a toast to the list", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast("Test message", "success");
      });

      // Toast should be visible in the document
      expect(screen.getByText("Test message")).toBeInTheDocument();
    });

    it("showToast generates unique IDs for each toast", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast("First toast", "success");
        result.current.showToast("Second toast", "info");
      });

      // Both toasts should be visible
      expect(screen.getByText("First toast")).toBeInTheDocument();
      expect(screen.getByText("Second toast")).toBeInTheDocument();

      // Check that they are both rendered (they use status role)
      const statusToasts = screen.getAllByRole("status");
      expect(statusToasts).toHaveLength(2);
    });

    it("showToast uses default type 'info' when not specified", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast("Default type test");
      });

      // Should render with info styling (role="status")
      const toastElement = screen.getByRole("status");
      expect(toastElement).toHaveClass("bg-brand-muted", "border-brand", "text-brand");
    });

    it("showToast accepts custom duration", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast("Custom duration", "success", 10000);
      });

      expect(screen.getByText("Custom duration")).toBeInTheDocument();
      // Duration is passed to the Toast component, which is tested in Toast.test.tsx
    });

    it("dismissToast removes a specific toast", async () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      // Add two toasts
      act(() => {
        result.current.showToast("Toast 1", "success");
        result.current.showToast("Toast 2", "info");
      });

      expect(screen.getByText("Toast 1")).toBeInTheDocument();
      expect(screen.getByText("Toast 2")).toBeInTheDocument();

      // Dismiss the first toast by clicking its dismiss button
      const dismissButtons = screen.getAllByRole("button", { name: /dismiss notification/i });
      act(() => {
        dismissButtons[0].click();
      });

      // First toast should start exit animation, second should still be visible
      expect(screen.getByText("Toast 2")).toBeInTheDocument();
    });

    it("handles multiple toasts correctly", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      // Add 5 toasts
      act(() => {
        for (let i = 1; i <= 5; i++) {
          result.current.showToast(`Toast ${i}`, "info");
        }
      });

      // All 5 should be visible
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Toast ${i}`)).toBeInTheDocument();
      }

      const toasts = screen.getAllByRole("status");
      expect(toasts).toHaveLength(5);
    });

    it("showToast callback is memoized", () => {
      const { result, rerender } = renderHook(() => useToast(), { wrapper });

      const firstShowToast = result.current.showToast;

      // Rerender the hook
      rerender();

      const secondShowToast = result.current.showToast;

      // Callbacks should be the same reference (memoized with useCallback)
      expect(firstShowToast).toBe(secondShowToast);
    });

    it("dismissToast callback is memoized", () => {
      const { result, rerender } = renderHook(() => useToast(), { wrapper });

      const firstDismissToast = result.current.dismissToast;

      // Rerender the hook
      rerender();

      const secondDismissToast = result.current.dismissToast;

      // Callbacks should be the same reference (memoized with useCallback)
      expect(firstDismissToast).toBe(secondDismissToast);
    });
  });

  describe("Toast State Management", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );

    it("manages toast state independently", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      // Add first toast
      act(() => {
        result.current.showToast("Toast A", "success");
      });

      expect(screen.getByText("Toast A")).toBeInTheDocument();

      // Add second toast
      act(() => {
        result.current.showToast("Toast B", "error");
      });

      expect(screen.getByText("Toast A")).toBeInTheDocument();
      expect(screen.getByText("Toast B")).toBeInTheDocument();

      // Dismiss first toast
      const dismissButtons = screen.getAllByRole("button", { name: /dismiss notification/i });
      act(() => {
        dismissButtons[0].click();
      });

      // Second toast should still be visible
      expect(screen.getByText("Toast B")).toBeInTheDocument();
    });

    it("handles rapid toast creation and dismissal", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      // Rapidly add 10 toasts
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.showToast(`Rapid toast ${i}`, "info");
        }
      });

      const toasts = screen.getAllByRole("status");
      expect(toasts.length).toBe(10);

      // Rapidly dismiss all toasts
      const dismissButtons = screen.getAllByRole("button", { name: /dismiss notification/i });
      act(() => {
        dismissButtons.forEach((button) => button.click());
      });

      // All toasts should enter exit animation (still in DOM but fading out)
      // After animation completes, they would be removed
    });
  });

  describe("Edge Cases", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );

    it("handles empty message", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      act(() => {
        result.current.showToast("", "info");
      });

      // Should still render toast with empty message
      const toasts = screen.getAllByRole("status");
      expect(toasts.length).toBe(1);
    });

    it("handles very long messages", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      const longMessage = "This is a very long message ".repeat(20);

      act(() => {
        result.current.showToast(longMessage, "info");
      });

      // Use a function matcher to handle long text that might be broken up
      expect(
        screen.getByText((_content, element) => {
          return element?.textContent === longMessage;
        })
      ).toBeInTheDocument();
    });

    it("handles special characters in messages", () => {
      const { result } = renderHook(() => useToast(), { wrapper });

      const specialMessage = "Test <script>alert('xss')</script> & special chars: café, 日本語, emoji 🎉";

      act(() => {
        result.current.showToast(specialMessage, "info");
      });

      expect(screen.getByText(specialMessage)).toBeInTheDocument();
    });
  });
});
