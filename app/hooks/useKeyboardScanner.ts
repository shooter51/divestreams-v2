import { useEffect, useRef, useCallback } from "react";

interface UseKeyboardScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxDelay?: number;
  totalTimeout?: number;
  prefix?: string;
}

/**
 * Detects USB HID barcode scanner input (keyboard emulation).
 *
 * USB barcode scanners type characters rapidly (< 50ms between keystrokes)
 * followed by Enter. This hook buffers rapid keystrokes and fires onScan
 * when Enter is pressed, if the buffer meets the minimum length and was
 * typed within the total timeout window.
 *
 * Ignores input when focus is in a text field to avoid conflicts.
 */
export function useKeyboardScanner({
  onScan,
  enabled = true,
  minLength = 4,
  maxDelay = 50,
  totalTimeout = 500,
  prefix,
}: UseKeyboardScannerOptions) {
  const bufferRef = useRef("");
  const lastKeystrokeRef = useRef(0);
  const startTimeRef = useRef(0);

  const resetBuffer = useCallback(() => {
    bufferRef.current = "";
    lastKeystrokeRef.current = 0;
    startTimeRef.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when focus is in a text input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const now = Date.now();

      if (e.key === "Enter" || e.key === "Tab") {
        const buffer = bufferRef.current;
        const elapsed = lastKeystrokeRef.current - startTimeRef.current;

        if (buffer.length >= minLength && elapsed <= totalTimeout) {
          e.preventDefault();
          const result = prefix && buffer.startsWith(prefix) ? buffer.slice(prefix.length) : buffer;
          onScan(result);
        }
        resetBuffer();
        return;
      }

      // Only buffer printable single characters
      if (e.key.length !== 1) return;

      // If too much time since last keystroke, start fresh
      if (
        lastKeystrokeRef.current > 0 &&
        now - lastKeystrokeRef.current > maxDelay
      ) {
        resetBuffer();
      }

      if (bufferRef.current === "") {
        startTimeRef.current = now;
      }

      bufferRef.current += e.key;
      lastKeystrokeRef.current = now;
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      resetBuffer();
    };
  }, [enabled, minLength, maxDelay, totalTimeout, onScan, resetBuffer, prefix]);
}
