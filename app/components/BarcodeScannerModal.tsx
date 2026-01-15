/**
 * Barcode Scanner Modal
 *
 * Modal wrapper for the BarcodeScanner component.
 * Shows camera preview with scanning overlay and confirmation UI.
 */

import { useState } from "react";
import { BarcodeScanner } from "./BarcodeScanner";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  showConfirmation?: boolean;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Scan Barcode",
  showConfirmation = true,
}: BarcodeScannerModalProps) {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [scannerEnabled, setScannerEnabled] = useState(true);

  if (!isOpen) return null;

  const handleScan = (barcode: string) => {
    if (showConfirmation) {
      setScannedCode(barcode);
      setScannerEnabled(false);
    } else {
      onScan(barcode);
      handleClose();
    }
  };

  const handleConfirm = () => {
    if (scannedCode) {
      onScan(scannedCode);
      handleClose();
    }
  };

  const handleRescan = () => {
    setScannedCode(null);
    setScannerEnabled(true);
  };

  const handleClose = () => {
    setScannedCode(null);
    setScannerEnabled(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scanner or Result */}
        <div className="p-4">
          {scannedCode ? (
            <div className="space-y-4">
              {/* Scanned code display */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-green-700 font-medium">Barcode Detected</p>
                    <p className="text-xl font-mono font-bold text-green-900 truncate">{scannedCode}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleRescan}
                  className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Scan Again
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Use This Code
                </button>
              </div>
            </div>
          ) : (
            <BarcodeScanner
              onScan={handleScan}
              onError={(error) => console.error("Scanner error:", error)}
              enabled={scannerEnabled}
              className="aspect-[4/3]"
            />
          )}
        </div>

        {/* Footer with manual entry */}
        {!scannedCode && (
          <div className="p-4 border-t bg-gray-50">
            <ManualBarcodeEntry onSubmit={handleScan} />
          </div>
        )}
      </div>
    </div>
  );
}

// Manual barcode entry component
function ManualBarcodeEntry({ onSubmit }: { onSubmit: (barcode: string) => void }) {
  const [manualCode, setManualCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onSubmit(manualCode.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={manualCode}
        onChange={(e) => setManualCode(e.target.value)}
        placeholder="Or enter barcode manually..."
        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
      />
      <button
        type="submit"
        disabled={!manualCode.trim()}
        className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
      >
        Submit
      </button>
    </form>
  );
}

export default BarcodeScannerModal;
