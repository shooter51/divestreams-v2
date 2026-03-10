/**
 * useKeyboardScanner Hook Unit Tests
 *
 * Tests USB HID / Bluetooth keyboard-emulation barcode scanner behaviour:
 * - Enter suffix triggers scan
 * - Tab suffix triggers scan
 * - Configurable maxDelay threshold
 * - Minimum length enforcement
 * - Prefix character stripping
 * - Sequences arriving too slowly are ignored
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardScanner } from "../../../../app/hooks/useKeyboardScanner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fire a synthetic keydown event on document */
function pressKey(key: string, options?: Partial<KeyboardEventInit>) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, ...options });
  document.dispatchEvent(event);
}

/** Simulate a sequence of key presses with a fixed inter-key delay (ms) */
async function typeSequence(chars: string, delay = 10, suffix = "Enter") {
  for (const ch of chars) {
    act(() => pressKey(ch));
    await new Promise((r) => setTimeout(r, delay));
  }
  act(() => pressKey(suffix));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useKeyboardScanner", () => {
  describe("Enter suffix", () => {
    it("fires onScan when Enter is pressed after rapid keystrokes", async () => {
      const onScan = vi.fn();
      renderHook(() => useKeyboardScanner({ onScan }));

      // Simulate fast USB scanner: chars then Enter
      for (const ch of "12345678") {
        act(() => pressKey(ch));
        act(() => vi.advanceTimersByTime(10));
      }
      act(() => pressKey("Enter"));

      expect(onScan).toHaveBeenCalledWith("12345678");
    });
  });

  describe("Tab suffix", () => {
    it("fires onScan when Tab is pressed after rapid keystrokes", async () => {
      const onScan = vi.fn();
      renderHook(() => useKeyboardScanner({ onScan }));

      for (const ch of "ABCD1234") {
        act(() => pressKey(ch));
        act(() => vi.advanceTimersByTime(10));
      }
      act(() => pressKey("Tab"));

      expect(onScan).toHaveBeenCalledWith("ABCD1234");
    });
  });

  describe("minLength enforcement", () => {
    it("does not fire onScan when buffer is shorter than minLength", () => {
      const onScan = vi.fn();
      renderHook(() => useKeyboardScanner({ onScan, minLength: 4 }));

      for (const ch of "AB") {
        act(() => pressKey(ch));
        act(() => vi.advanceTimersByTime(10));
      }
      act(() => pressKey("Enter"));

      expect(onScan).not.toHaveBeenCalled();
    });

    it("fires onScan when buffer meets minLength exactly", () => {
      const onScan = vi.fn();
      renderHook(() => useKeyboardScanner({ onScan, minLength: 4 }));

      for (const ch of "1234") {
        act(() => pressKey(ch));
        act(() => vi.advanceTimersByTime(10));
      }
      act(() => pressKey("Enter"));

      expect(onScan).toHaveBeenCalledWith("1234");
    });
  });

  describe("maxDelay threshold", () => {
    it("resets buffer and does NOT fire onScan when inter-key delay exceeds maxDelay", () => {
      const onScan = vi.fn();
      renderHook(() => useKeyboardScanner({ onScan, maxDelay: 100 }));

      // First char
      act(() => pressKey("1"));
      // Exceed maxDelay — buffer should reset
      act(() => vi.advanceTimersByTime(150));
      // Continue — these chars form a new (short) sequence, not enough length
      act(() => pressKey("2"));
      act(() => vi.advanceTimersByTime(10));
      act(() => pressKey("Enter"));

      // onScan should NOT fire because buffer reset and "2" alone is too short
      expect(onScan).not.toHaveBeenCalled();
    });

    it("respects a custom maxDelay of 100ms", () => {
      const onScan = vi.fn();
      renderHook(() => useKeyboardScanner({ onScan, maxDelay: 100 }));

      // All chars within 90ms of each other — should complete fine
      for (const ch of "123456") {
        act(() => pressKey(ch));
        act(() => vi.advanceTimersByTime(90));
      }
      act(() => pressKey("Enter"));

      expect(onScan).toHaveBeenCalledWith("123456");
    });
  });

  describe("prefix stripping", () => {
    it("strips a configured prefix character before firing onScan", () => {
      const onScan = vi.fn();
      renderHook(() => useKeyboardScanner({ onScan, prefix: "%" }));

      for (const ch of "%HELLO123") {
        act(() => pressKey(ch));
        act(() => vi.advanceTimersByTime(10));
      }
      act(() => pressKey("Enter"));

      // Leading "%" should be stripped
      expect(onScan).toHaveBeenCalledWith("HELLO123");
    });

    it("does not modify barcode when no prefix is configured", () => {
      const onScan = vi.fn();
      renderHook(() => useKeyboardScanner({ onScan }));

      for (const ch of "HELLO123") {
        act(() => pressKey(ch));
        act(() => vi.advanceTimersByTime(10));
      }
      act(() => pressKey("Enter"));

      expect(onScan).toHaveBeenCalledWith("HELLO123");
    });
  });

  describe("disabled state", () => {
    it("does not fire onScan when enabled is false", () => {
      const onScan = vi.fn();
      renderHook(() => useKeyboardScanner({ onScan, enabled: false }));

      for (const ch of "12345678") {
        act(() => pressKey(ch));
        act(() => vi.advanceTimersByTime(10));
      }
      act(() => pressKey("Enter"));

      expect(onScan).not.toHaveBeenCalled();
    });
  });

  describe("totalTimeout buffer reset", () => {
    it("resets buffer after totalTimeout if no suffix received", () => {
      const onScan = vi.fn();
      renderHook(() => useKeyboardScanner({ onScan, totalTimeout: 500 }));

      for (const ch of "1234") {
        act(() => pressKey(ch));
        act(() => vi.advanceTimersByTime(10));
      }
      // No Enter — let totalTimeout expire
      act(() => vi.advanceTimersByTime(600));

      // Now type a second short sequence
      for (const ch of "AB") {
        act(() => pressKey(ch));
        act(() => vi.advanceTimersByTime(10));
      }
      act(() => pressKey("Enter"));

      // Should not fire because "AB" is too short (minLength default 4)
      expect(onScan).not.toHaveBeenCalled();
    });
  });
});
