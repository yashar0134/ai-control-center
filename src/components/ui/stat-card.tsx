import type { ReactNode } from "react";
import { Badge } from "./badge";

/** Compact metric tile. `hint` carries the honest context (e.g. "demo data"). */
export function StatCard({
  label,
  value,
  hint,
  badge,
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  badge?: ReactNode;
  trend?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {badge ?? <Badge tone="demo">demo</Badge>}
      </div>
      <p className="tabular mt-2 font-mono text-2xl font-semibold">{value}</p>
      {trend}
      {hint && <p className="mt-1 text-xs text-faint-foreground">{hint}</p>}
    </div>
  );
}
