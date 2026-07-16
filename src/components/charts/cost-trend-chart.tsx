"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Point {
  date: string; // YYYY-MM-DD
  amount: number;
}

function shortDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

export function CostTrendChart({
  data,
  currency,
}: {
  data: Point[];
  currency: string;
}) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  const total = data.reduce((s, p) => s + p.amount, 0);

  return (
    <figure
      aria-label={`Daily cost for the last 30 days, ${fmt(total)} in total (demo data).`}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDay}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v) => fmt(Number(v))}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-raised)" }}
              contentStyle={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--foreground)",
                fontSize: 12,
              }}
              labelFormatter={(label) => `${shortDay(String(label))} (demo)`}
              formatter={(value) => [fmt(Number(value)), "daily cost"]}
            />
            <Bar
              dataKey="amount"
              fill="var(--accent)"
              fillOpacity={0.75}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Demo daily spend across all connections for the last 30 days.
      </figcaption>
    </figure>
  );
}
