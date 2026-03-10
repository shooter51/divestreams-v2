/**
 * BarcodeScanner Component Unit Tests
 *
 * Tests the camera scanner UI states: initial loading, permission denied,
 * and error / retry states. ZXing and getUserMedia are heavily mocked
 * because they require real browser media APIs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BarcodeScanner } from "../../../../app/components/BarcodeScanner";

// Mock ZXing BrowserMultiFormatReader
const mockStop = vi.fn();
const mockDecodeFromConstraints = vi.fn();

vi.mock("@zxing/browser", () => {
  class BrowserMultiFormatReader {
    decodeFromConstraints = mockDecodeFromConstraints;
  }
  return { BrowserMultiFormatReader };
});

vi.mock("@zxing/library", () => ({
  NotFoundException: class NotFoundException extends Error {},
}));

// Helper: make decodeFromConstraints resolve (camera started successfully)
function mockScannerSuccess() {
  mockDecodeFromConstraints.mockResolvedValue({ stop: mockStop });
}

// Helper: make decodeFromConstraints reject with a permission error
function mockScannerPermissionDenied() {
  mockDecodeFromConstraints.mockRejectedValue(
    new Error("NotAllowedError: Permission denied")
  );
}

// Helper: make decodeFromConstraints reject with a generic error
function mockScannerError(message = "Camera not found") {
  mockDecodeFromConstraints.mockRejectedValue(new Error(message));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BarcodeScanner", () => {
  describe("renders scanner container", () => {
    it("mounts without crashing", () => {
      mockScannerSuccess();

      const { container } = render(
        <BarcodeScanner onScan={vi.fn()} />,
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("shows 'Starting camera...' initially", () => {
    it("displays the loading message before camera initialises", () => {
      // decodeFromConstraints never resolves – scanner stays uninitialized
      mockDecodeFromConstraints.mockReturnValue(new Promise(() => {}));

      render(<BarcodeScanner onScan={vi.fn()} />);

      expect(screen.getByText("Starting camera...")).toBeInTheDocument();
    });
  });

  describe("shows 'Camera Access Denied' when permission denied", () => {
    it("renders the permission-denied UI when decodeFromConstraints rejects with NotAllowedError", async () => {
      mockScannerPermissionDenied();

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Camera Access Denied")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/allow camera access/i),
      ).toBeInTheDocument();
    });

    it("shows a 'Try Again' button in the denied state", async () => {
      mockScannerPermissionDenied();

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Try Again")).toBeInTheDocument();
      });
    });
  });

  describe("shows scanner error state with retry button", () => {
    it("renders the error UI when decodeFromConstraints rejects with a generic error", async () => {
      mockScannerError("Failed to initialize scanner");

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Scanner Error")).toBeInTheDocument();
      });
    });

    it("renders a 'Try Again' button in the error state", async () => {
      mockScannerError("Hardware failure");

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
      });
    });

    it("shows the error message text", async () => {
      mockScannerError("No video device found");

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("No video device found")).toBeInTheDocument();
      });
    });

    it("shows 'Scanner Error' when decodeFromConstraints rejects with generic error", async () => {
      mockScannerError("Camera not found");

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Scanner Error")).toBeInTheDocument();
        expect(screen.getByText("Camera not found")).toBeInTheDocument();
      });
    });

    it("clicking Retry clears the error and shows loading again", async () => {
      mockScannerError("Temporary failure");

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Scanner Error")).toBeInTheDocument();
      });

      // On retry, decodeFromConstraints hangs so we go back to loading state
      mockDecodeFromConstraints.mockReturnValue(new Promise(() => {}));

      const retryButton = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByText("Scanner Error")).not.toBeInTheDocument();
      });
    });
  });
});
