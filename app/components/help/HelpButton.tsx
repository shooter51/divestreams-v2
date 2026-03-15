/**
 * HelpButton — Floating action button that opens the help chat panel.
 * Renders fixed at the bottom-right corner of the viewport.
 */

interface HelpButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function HelpButton({ onClick, isOpen }: HelpButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "Close help" : "Open help"}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand text-white shadow-lg hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-colors flex items-center justify-center"
    >
      {isOpen ? (
        /* Close / X icon */
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        /* Question-mark icon */
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
    </button>
  );
}
