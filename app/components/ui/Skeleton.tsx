interface SkeletonLineProps {
  className?: string;
  width?: "full" | "3/4" | "1/2" | "1/4";
}

export function SkeletonLine({ className = "", width = "full" }: SkeletonLineProps) {
  const widthClass = {
    full: "w-full",
    "3/4": "w-3/4",
    "1/2": "w-1/2",
    "1/4": "w-1/4",
  }[width];

  return (
    <div
      className={`h-4 rounded bg-surface-inset animate-pulse ${widthClass} ${className}`}
    />
  );
}

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className = "", lines = 3 }: SkeletonCardProps) {
  return (
    <div className={`bg-surface-raised rounded-xl shadow-sm p-6 ${className}`}>
      <SkeletonLine width="1/2" className="mb-4 h-5" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine key={i} width={i === lines - 1 ? "3/4" : "full"} />
        ))}
      </div>
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className = "" }: SkeletonTableProps) {
  return (
    <div className={`bg-surface-raised rounded-xl shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-3 border-b border-border-subtle flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLine key={i} width="1/4" className="h-3" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="px-6 py-4 border-b border-border-subtle last:border-0 flex gap-4 items-center">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <SkeletonLine key={colIdx} width={colIdx === 0 ? "1/2" : "1/4"} />
          ))}
        </div>
      ))}
    </div>
  );
}
