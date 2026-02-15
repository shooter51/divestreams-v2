import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    let dismissTimer: NodeJS.Timeout;

    const timer = setTimeout(() => {
      setIsExiting(true);
      dismissTimer = setTimeout(() => onDismiss(toast.id), 300);
    }, duration);

    // Clean up both timers to prevent memory leak
    return () => {
      clearTimeout(timer);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [toast.id, toast.duration, onDismiss]); // Only depend on primitive values

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const typeStyles: Record<ToastType, string> = {
    success: "bg-success-muted border-success text-success",
    error: "bg-danger-muted border-danger text-danger",
    warning: "bg-warning-muted border-warning text-warning",
    info: "bg-brand-muted border-brand text-brand",
  };

  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  // Check for reduced motion preference (WCAG 2.1 2.3.3)
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // Use appropriate ARIA role (WCAG 2.1 4.1.3)
  // Errors and warnings are assertive (role="alert")
  // Success and info are polite (role="status")
  const isAssertive = toast.type === 'error' || toast.type === 'warning';

  return (
    <div
      className={`
        ${typeStyles[toast.type]}
        border rounded-lg shadow-lg p-4 mb-3 flex items-center justify-between gap-3
        min-w-[320px] max-w-[500px]
        ${prefersReducedMotion ? '' : 'transition-all duration-300 ease-in-out'}
        ${isExiting ? 'opacity-0' : 'opacity-100'}
        ${isExiting && !prefersReducedMotion ? 'translate-x-full' : 'translate-x-0'}
      `}
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold flex-shrink-0">{icons[toast.type]}</span>
        <p className="text-sm font-medium">{toast.message}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-lg font-bold hover:opacity-70 transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col items-end"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
