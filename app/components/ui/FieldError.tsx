import type { ReactNode } from "react";

export function FieldError({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-danger text-sm mt-1 ${className}`}>
      {children}
    </p>
  );
}

export function RequiredMark() {
  return <span className="text-danger">*</span>;
}
