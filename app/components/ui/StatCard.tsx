interface StatCardProps {
  title: string;
  value: string | number;
  icon?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon, trend, className = "" }: StatCardProps) {
  return (
    <div className={`bg-surface-raised rounded-xl p-4 shadow-sm ${className}`}>
      {icon && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl">{icon}</span>
          {trend && (
            <span className={`text-sm ${trend.isPositive ? "text-success" : "text-danger"}`}>
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
      )}
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-foreground-muted text-sm">{title}</p>
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string | number;
  className?: string;
}

export function StatRow({ label, value, className = "" }: StatRowProps) {
  return (
    <div className={`flex justify-between text-sm ${className}`}>
      <span className="text-foreground-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
