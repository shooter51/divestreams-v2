/**
 * ConfirmModal — reusable accessible confirmation dialog.
 * DS-lu26: Replaces browser window.confirm() calls with a proper modal.
 *
 * Usage:
 *   const [show, setShow] = useState(false);
 *   <ConfirmModal
 *     isOpen={show}
 *     title="Delete tour?"
 *     message="This action cannot be undone."
 *     danger
 *     onConfirm={() => { submitDelete(); setShow(false); }}
 *     onCancel={() => setShow(false)}
 *   />
 */

const TITLE_ID = "confirm-modal-title";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button uses danger (red) styling. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="modal-backdrop"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="relative z-10 w-full max-w-md rounded-xl bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={TITLE_ID} className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h2>
        <p className="text-foreground-muted text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-surface-hover transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? "px-4 py-2 rounded-lg bg-danger text-white hover:bg-danger/90 transition-colors"
                : "px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
