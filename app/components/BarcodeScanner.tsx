/**
 * Barcode Scanner Component
 *
 * Uses Quagga2 library to scan barcodes via device camera.
 * Supports EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Quagga from "@ericblade/quagga2";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
  className?: string;
}

export function BarcodeScanner({
  onScan,
  onError,
  enabled = true,
  className = "",
}: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // Play beep sound on successful scan
  const playBeep = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 1000;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch {
      // Audio not supported, ignore silently
    }
  }, []);

  // Handle barcode detection
  const handleDetected = useCallback(
    (result: { codeResult?: { code?: string | null } }) => {
      const code = result.codeResult?.code;
      if (!code) return;

      // Debounce: prevent duplicate scans within 1 second
      const now = Date.now();
      if (code === lastScanRef.current && now - lastScanTimeRef.current < 1000) {
        return;
      }

      lastScanRef.current = code;
      lastScanTimeRef.current = now;

      playBeep();
      onScan(code);
    },
    [onScan, playBeep]
  );

  // Initialize scanner
  useEffect(() => {
    if (!enabled || !scannerRef.current) return;

    const initScanner = async () => {
      try {
        // Check for camera permission
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        stream.getTracks().forEach(track => track.stop());

        Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: scannerRef.current!,
              constraints: {
                facingMode: "environment",
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
              },
            },
            decoder: {
              readers: [
                "ean_reader",
                "ean_8_reader",
                "upc_reader",
                "upc_e_reader",
                "code_128_reader",
                "code_39_reader",
              ],
            },
            locate: true,
            locator: {
              halfSample: true,
              patchSize: "medium",
            },
          },
          (err) => {
            if (err) {
              console.error("Quagga init error:", err);
              const errorMessage = err instanceof Error ? err.message : String(err);
              if (errorMessage.includes("Permission") || errorMessage.includes("NotAllowed")) {
                setPermissionDenied(true);
              }
              setError(errorMessage);
              onError?.(err instanceof Error ? err : new Error(errorMessage));
              return;
            }

            setIsInitialized(true);
            setError(null);
            Quagga.start();
          }
        );

        Quagga.onDetected(handleDetected);
      } catch (err) {
        console.error("Camera access error:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes("Permission") || errorMessage.includes("NotAllowed")) {
          setPermissionDenied(true);
        }
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      }
    };

    initScanner();

    return () => {
      if (isInitialized) {
        Quagga.offDetected(handleDetected);
        Quagga.stop();
      }
    };
  }, [enabled, handleDetected, onError, isInitialized]);

  // Stop scanner when disabled
  useEffect(() => {
    if (!enabled && isInitialized) {
      Quagga.stop();
      setIsInitialized(false);
    }
  }, [enabled, isInitialized]);

  if (permissionDenied) {
    return (
      <div className={`bg-surface-inset rounded-lg p-6 text-center ${className}`}>
        <div className="w-12 h-12 bg-danger-muted rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="font-semibold text-foreground mb-2">Camera Access Denied</h3>
        <p className="text-sm text-foreground-muted mb-4">
          Please allow camera access in your browser settings to use the barcode scanner.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (error && !permissionDenied) {
    return (
      <div className={`bg-surface-inset rounded-lg p-6 text-center ${className}`}>
        <div className="w-12 h-12 bg-warning-muted rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="font-semibold text-foreground mb-2">Scanner Error</h3>
        <p className="text-sm text-foreground-muted mb-4">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setIsInitialized(false);
          }}
          className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg bg-black ${className}`}>
      {/* Camera viewport */}
      <div ref={scannerRef} className="w-full aspect-[4/3]">
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 dark:bg-black">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-white text-sm">Starting camera...</p>
            </div>
          </div>
        )}
      </div>

      {/* Scanning overlay */}
      {isInitialized && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Scan area indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3/4 h-24 border-2 border-brand rounded-lg relative">
              {/* Corner markers */}
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-brand rounded-tl" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-brand rounded-tr" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-brand rounded-bl" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-brand rounded-br" />

              {/* Scan line animation */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-danger animate-pulse" />
            </div>
          </div>

          {/* Instructions */}
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-white text-sm bg-black/50 px-4 py-2 rounded-full inline-block">
              Position barcode within the frame
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default BarcodeScanner;
