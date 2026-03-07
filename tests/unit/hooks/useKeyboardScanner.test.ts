import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardScanner } from "../../../app/hooks/useKeyboardScanner";

function fireKeyDown(key: string, target?: Partial<HTMLElement>) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true });
  if (target) {
    Object.defineProperty(event, "target", { value: target });
  }
  document.dispatchEvent(event);
}

function simulateScan(barcode: string, delay = 10) {
  vi.useFakeTimers();
  const now = Date.now();

  for (let i = 0; i < barcode.length; i++) {
    vi.setSystemTime(now + i * delay);
    fireKeyDown(barcode[i]);
  }

  // Press Enter after last character
  vi.setSystemTime(now + barcode.length * delay);
  fireKeyDown("Enter");

  vi.useRealTimers();
}

describe("useKeyboardScanner", () => {
  let onScan: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onScan = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onScan when rapid keystrokes followed by Enter", () => {
    renderHook(() => useKeyboardScanner({ onScan }));
    simulateScan("1234567890");
    expect(onScan).toHaveBeenCalledWith("1234567890");
  });

  it("does not call onScan for short barcodes (< minLength)", () => {
    renderHook(() => useKeyboardScanner({ onScan, minLength: 4 }));
    simulateScan("123"); // only 3 chars
    expect(onScan).not.toHaveBeenCalled();
  });

  it("does not call onScan for slow typing", () => {
    renderHook(() => useKeyboardScanner({ onScan }));
    simulateScan("1234567890", 100); // 100ms between keys = human typing
    expect(onScan).not.toHaveBeenCalled();
  });

  it("does not call onScan when totalTimeout exceeded", () => {
    renderHook(() => useKeyboardScanner({ onScan, totalTimeout: 200 }));
    simulateScan("1234567890", 30); // 10 chars * 30ms = 300ms > 200ms timeout
    expect(onScan).not.toHaveBeenCalled();
  });

  it("ignores input when target is an INPUT element", () => {
    renderHook(() => useKeyboardScanner({ onScan }));

    vi.useFakeTimers();
    const now = Date.now();
    const barcode = "1234567890";
    for (let i = 0; i < barcode.length; i++) {
      vi.setSystemTime(now + i * 10);
      fireKeyDown(barcode[i], { tagName: "INPUT" } as HTMLElement);
    }
    vi.setSystemTime(now + barcode.length * 10);
    fireKeyDown("Enter", { tagName: "INPUT" } as HTMLElement);
    vi.useRealTimers();

    expect(onScan).not.toHaveBeenCalled();
  });

  it("ignores input when target is a TEXTAREA element", () => {
    renderHook(() => useKeyboardScanner({ onScan }));

    vi.useFakeTimers();
    const now = Date.now();
    const barcode = "ABCDEF";
    for (let i = 0; i < barcode.length; i++) {
      vi.setSystemTime(now + i * 10);
      fireKeyDown(barcode[i], { tagName: "TEXTAREA" } as HTMLElement);
    }
    vi.setSystemTime(now + barcode.length * 10);
    fireKeyDown("Enter", { tagName: "TEXTAREA" } as HTMLElement);
    vi.useRealTimers();

    expect(onScan).not.toHaveBeenCalled();
  });

  it("ignores input when target is a SELECT element", () => {
    renderHook(() => useKeyboardScanner({ onScan }));

    vi.useFakeTimers();
    const now = Date.now();
    const barcode = "ABCDEF";
    for (let i = 0; i < barcode.length; i++) {
      vi.setSystemTime(now + i * 10);
      fireKeyDown(barcode[i], { tagName: "SELECT" } as HTMLElement);
    }
    vi.setSystemTime(now + barcode.length * 10);
    fireKeyDown("Enter", { tagName: "SELECT" } as HTMLElement);
    vi.useRealTimers();

    expect(onScan).not.toHaveBeenCalled();
  });

  it("ignores input when target is contentEditable", () => {
    renderHook(() => useKeyboardScanner({ onScan }));

    vi.useFakeTimers();
    const now = Date.now();
    const barcode = "ABCDEF";
    for (let i = 0; i < barcode.length; i++) {
      vi.setSystemTime(now + i * 10);
      fireKeyDown(barcode[i], { tagName: "DIV", isContentEditable: true } as unknown as HTMLElement);
    }
    vi.setSystemTime(now + barcode.length * 10);
    fireKeyDown("Enter", { tagName: "DIV", isContentEditable: true } as unknown as HTMLElement);
    vi.useRealTimers();

    expect(onScan).not.toHaveBeenCalled();
  });

  it("ignores non-printable keys (Shift, Control, etc.)", () => {
    renderHook(() => useKeyboardScanner({ onScan }));

    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    fireKeyDown("Shift");
    vi.setSystemTime(now + 10);
    fireKeyDown("1");
    vi.setSystemTime(now + 20);
    fireKeyDown("2");
    vi.setSystemTime(now + 30);
    fireKeyDown("3");
    vi.setSystemTime(now + 40);
    fireKeyDown("4");
    vi.setSystemTime(now + 50);
    fireKeyDown("Enter");
    vi.useRealTimers();

    // Only "1234" should be in buffer (Shift ignored)
    expect(onScan).toHaveBeenCalledWith("1234");
  });

  it("does not fire when disabled", () => {
    renderHook(() => useKeyboardScanner({ onScan, enabled: false }));
    simulateScan("1234567890");
    expect(onScan).not.toHaveBeenCalled();
  });

  it("resets buffer on slow keystroke gap", () => {
    renderHook(() => useKeyboardScanner({ onScan, maxDelay: 50 }));

    vi.useFakeTimers();
    const now = Date.now();

    // Type "AB" then wait > maxDelay, then type "CDEF" + Enter
    vi.setSystemTime(now);
    fireKeyDown("A");
    vi.setSystemTime(now + 10);
    fireKeyDown("B");
    // Gap of 100ms > maxDelay
    vi.setSystemTime(now + 110);
    fireKeyDown("C");
    vi.setSystemTime(now + 120);
    fireKeyDown("D");
    vi.setSystemTime(now + 130);
    fireKeyDown("E");
    vi.setSystemTime(now + 140);
    fireKeyDown("F");
    vi.setSystemTime(now + 150);
    fireKeyDown("Enter");
    vi.useRealTimers();

    // Should only have "CDEF" (buffer reset after gap)
    expect(onScan).toHaveBeenCalledWith("CDEF");
  });

  it("handles multiple sequential scans", () => {
    renderHook(() => useKeyboardScanner({ onScan }));

    simulateScan("FIRST123");
    expect(onScan).toHaveBeenCalledWith("FIRST123");

    simulateScan("SECOND456");
    expect(onScan).toHaveBeenCalledWith("SECOND456");
    expect(onScan).toHaveBeenCalledTimes(2);
  });

  it("cleans up listener on unmount", () => {
    const spy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useKeyboardScanner({ onScan }));
    unmount();
    expect(spy).toHaveBeenCalledWith("keydown", expect.any(Function));
    spy.mockRestore();
  });

  it("respects custom minLength", () => {
    renderHook(() => useKeyboardScanner({ onScan, minLength: 8 }));

    simulateScan("SHORT"); // 5 chars < 8
    expect(onScan).not.toHaveBeenCalled();

    simulateScan("LONGENOUGH"); // 10 chars >= 8
    expect(onScan).toHaveBeenCalledWith("LONGENOUGH");
  });

  it("Enter with empty buffer does not fire onScan", () => {
    renderHook(() => useKeyboardScanner({ onScan }));
    fireKeyDown("Enter");
    expect(onScan).not.toHaveBeenCalled();
  });
});
