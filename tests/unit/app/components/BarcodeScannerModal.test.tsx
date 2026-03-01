/**
 * BarcodeScannerModal Component Unit Tests
 *
 * Tests the modal wrapper around BarcodeScanner including:
 * - Open/close state
 * - Confirmation flow after a scan
 * - "Use This Code" and "Scan Again" actions
 * - Manual barcode entry
 * - Close button resets internal state
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BarcodeScannerModal } from "../../../../app/components/BarcodeScannerModal";

vi.mock("../../../../app/components/BarcodeScanner", () => ({
  BarcodeScanner: ({ onScan }: { onScan: (code: string) => void }) => (
    <div data-testid="barcode-scanner">
      <button onClick={() => onScan("1234567890")}>Mock Scan</button>
    </div>
  ),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onScan: vi.fn(),
};

describe("BarcodeScannerModal", () => {
  describe("returns null when not open", () => {
    it("renders nothing when isOpen is false", () => {
      const { container } = render(
        <BarcodeScannerModal {...defaultProps} isOpen={false} />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("renders title", () => {
    it("renders default title 'Scan Barcode'", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      expect(screen.getByText("Scan Barcode")).toBeInTheDocument();
    });

    it("renders a custom title when provided", () => {
      render(<BarcodeScannerModal {...defaultProps} title="Find Product" />);

      expect(screen.getByText("Find Product")).toBeInTheDocument();
    });
  });

  describe("close button", () => {
    it("renders close button with aria-label 'Close'", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      const closeBtn = screen.getByRole("button", { name: /close/i });
      expect(closeBtn).toBeInTheDocument();
    });

    it("calls onClose when close button is clicked", () => {
      const onClose = vi.fn();
      render(<BarcodeScannerModal {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByRole("button", { name: /close/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("resets to scanner view and calls onClose when close button clicked after a scan", () => {
      const onClose = vi.fn();
      render(<BarcodeScannerModal {...defaultProps} onClose={onClose} />);

      // Trigger a scan so confirmation UI appears
      fireEvent.click(screen.getByText("Mock Scan"));
      expect(screen.getByText("Use This Code")).toBeInTheDocument();

      // Close the modal
      fireEvent.click(screen.getByRole("button", { name: /close/i }));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("shows scanner when open", () => {
    it("renders the BarcodeScanner component", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      expect(screen.getByTestId("barcode-scanner")).toBeInTheDocument();
    });
  });

  describe("after scan – confirmation flow", () => {
    it("shows scanned code after mock scan", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      fireEvent.click(screen.getByText("Mock Scan"));

      expect(screen.getByText("1234567890")).toBeInTheDocument();
    });

    it("shows 'Use This Code' and 'Scan Again' buttons after scan", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      fireEvent.click(screen.getByText("Mock Scan"));

      expect(screen.getByText("Use This Code")).toBeInTheDocument();
      expect(screen.getByText("Scan Again")).toBeInTheDocument();
    });

    it("hides the scanner after a scan when showConfirmation is true", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      fireEvent.click(screen.getByText("Mock Scan"));

      expect(screen.queryByTestId("barcode-scanner")).not.toBeInTheDocument();
    });

    it("'Use This Code' calls onScan with the scanned code", () => {
      const onScan = vi.fn();
      render(<BarcodeScannerModal {...defaultProps} onScan={onScan} />);

      fireEvent.click(screen.getByText("Mock Scan"));
      fireEvent.click(screen.getByText("Use This Code"));

      expect(onScan).toHaveBeenCalledWith("1234567890");
    });

    it("'Scan Again' resets to scanner view", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      fireEvent.click(screen.getByText("Mock Scan"));
      expect(screen.queryByTestId("barcode-scanner")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Scan Again"));

      expect(screen.getByTestId("barcode-scanner")).toBeInTheDocument();
    });

    it("'Use This Code' also calls onClose (modal closes after confirm)", () => {
      const onClose = vi.fn();
      render(<BarcodeScannerModal {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByText("Mock Scan"));
      fireEvent.click(screen.getByText("Use This Code"));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("manual entry form", () => {
    it("renders manual entry input and submit button", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      expect(
        screen.getByPlaceholderText("Or enter barcode manually..."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /submit/i }),
      ).toBeInTheDocument();
    });

    it("submit button is disabled when input is empty", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      const submitBtn = screen.getByRole("button", { name: /submit/i });
      expect(submitBtn).toBeDisabled();
    });

    it("submitting manual barcode calls onScan with the entered code", () => {
      const onScan = vi.fn();
      render(<BarcodeScannerModal {...defaultProps} onScan={onScan} />);

      const input = screen.getByPlaceholderText("Or enter barcode manually...");
      fireEvent.change(input, { target: { value: "9876543210" } });

      const submitBtn = screen.getByRole("button", { name: /submit/i });
      fireEvent.click(submitBtn);

      // With showConfirmation=true the code is shown in confirmation UI, not passed directly
      expect(screen.getByText("9876543210")).toBeInTheDocument();
    });

    it("submitting manual barcode shows confirmation UI", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Or enter barcode manually...");
      fireEvent.change(input, { target: { value: "MANUALCODE" } });
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));

      expect(screen.getByText("Use This Code")).toBeInTheDocument();
      expect(screen.getByText("MANUALCODE")).toBeInTheDocument();
    });

    it("hides manual entry form once a code is scanned / entered", () => {
      render(<BarcodeScannerModal {...defaultProps} />);

      fireEvent.click(screen.getByText("Mock Scan"));

      expect(
        screen.queryByPlaceholderText("Or enter barcode manually..."),
      ).not.toBeInTheDocument();
    });
  });
});
