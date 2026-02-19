/**
 * BarcodeScanner Component Unit Tests
 *
 * Tests the camera scanner UI states: initial loading, permission denied,
 * and error / retry states. Quagga2 and getUserMedia are heavily mocked
 * because they require real browser media APIs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BarcodeScanner } from "../../../../app/components/BarcodeScanner";

vi.mock("@ericblade/quagga2", () => ({
  default: {
    init: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onDetected: vi.fn(),
    offDetected: vi.fn(),
  },
}));

import Quagga from "@ericblade/quagga2";
const mockQuagga = vi.mocked(Quagga);

// Helper: make getUserMedia resolve (camera allowed, no real stream)
function mockGetUserMediaSuccess() {
  const mockStream = {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;

  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    },
    writable: true,
    configurable: true,
  });
}

// Helper: make getUserMedia reject with a permission error
function mockGetUserMediaDenied() {
  const error = new Error("NotAllowedError: Permission denied");
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn().mockRejectedValue(error),
    },
    writable: true,
    configurable: true,
  });
}

// Helper: make getUserMedia reject with a generic camera error
function mockGetUserMediaError(message = "Camera not found") {
  const error = new Error(message);
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn().mockRejectedValue(error),
    },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BarcodeScanner", () => {
  describe("renders scanner container", () => {
    it("mounts without crashing", () => {
      mockGetUserMediaSuccess();
      // Quagga.init just hangs (never calls callback) – that's fine for this test
      mockQuagga.init.mockImplementation(() => {});

      const { container } = render(
        <BarcodeScanner onScan={vi.fn()} />,
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("shows 'Starting camera...' initially", () => {
    it("displays the loading message before camera initialises", () => {
      mockGetUserMediaSuccess();
      // Quagga.init never calls its callback – scanner stays uninitialized
      mockQuagga.init.mockImplementation(() => {});

      render(<BarcodeScanner onScan={vi.fn()} />);

      expect(screen.getByText("Starting camera...")).toBeInTheDocument();
    });
  });

  describe("shows 'Camera Access Denied' when permission denied", () => {
    it("renders the permission-denied UI when getUserMedia rejects with NotAllowedError", async () => {
      mockGetUserMediaDenied();

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Camera Access Denied")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/allow camera access/i),
      ).toBeInTheDocument();
    });

    it("shows a 'Try Again' button in the denied state", async () => {
      mockGetUserMediaDenied();

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Try Again")).toBeInTheDocument();
      });
    });
  });

  describe("shows scanner error state with retry button", () => {
    it("renders the error UI when Quagga.init calls back with an error", async () => {
      mockGetUserMediaSuccess();

      mockQuagga.init.mockImplementation((_config: unknown, callback: (err: Error | null) => void) => {
        callback(new Error("Failed to initialize scanner"));
      });

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Scanner Error")).toBeInTheDocument();
      });
    });

    it("renders a 'Retry' button in the error state", async () => {
      mockGetUserMediaSuccess();

      mockQuagga.init.mockImplementation((_config: unknown, callback: (err: Error | null) => void) => {
        callback(new Error("Hardware failure"));
      });

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
      });
    });

    it("shows the error message text from Quagga init", async () => {
      mockGetUserMediaSuccess();

      mockQuagga.init.mockImplementation((_config: unknown, callback: (err: Error | null) => void) => {
        callback(new Error("No video device found"));
      });

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("No video device found")).toBeInTheDocument();
      });
    });

    it("shows 'Camera Access Denied' when getUserMedia rejects with generic error", async () => {
      mockGetUserMediaError("Camera not found");

      render(<BarcodeScanner onScan={vi.fn()} />);

      // Generic error (not a permission error) shows the error state, not the denied state
      await waitFor(() => {
        expect(screen.getByText("Scanner Error")).toBeInTheDocument();
        expect(screen.getByText("Camera not found")).toBeInTheDocument();
      });
    });

    it("clicking Retry clears the error and shows loading again", async () => {
      mockGetUserMediaSuccess();

      mockQuagga.init.mockImplementationOnce((_config: unknown, callback: (err: Error | null) => void) => {
        callback(new Error("Temporary failure"));
      });

      // On retry, Quagga.init hangs so we go back to the loading state
      mockQuagga.init.mockImplementation(() => {});

      render(<BarcodeScanner onScan={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Scanner Error")).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: /retry/i });
      fireEvent.click(retryButton);

      // After retry the error UI should be gone (scanner re-initialises)
      await waitFor(() => {
        expect(screen.queryByText("Scanner Error")).not.toBeInTheDocument();
      });
    });
  });
});
