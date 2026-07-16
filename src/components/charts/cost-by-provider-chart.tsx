"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Slice {
  providerId: string;
  providerName: string;
  amount: number;
}

// Distinguishable without relying on hue alone: order + labels carry meaning.
const BAR_COLORS = ["var(--accent)", "var(--info)", "var(--demo)", "var(--warning)"];

export function CostByProviderChart({
  data,
  currency,
}: {
  data: Slice[];
  currency: string;
}) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  const sorted = [...data].sort((a, b) => b.amount - a.amount);

  return (
    <figure
      aria-label={`Cost by provider this month: ${sorted
        .map((s) => `${s.providerName} ${fmt(s.amount)}`)
        .join(", ")}.`}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => fmt(Number(v))}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              type="category"
              dataKey="providerName"
              width={80}
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
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
              formatter={(value) => [fmt(Number(value)), "this month (demo)"]}
            />
            <Bar dataKey="amount" radius={[0, 3, 3, 0]} isAnimationActive={false} barSize={18}>
              {sorted.map((entry, i) => (
                <Cell key={entry.providerId} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Month-to-date demo cost per provider, largest first.
      </figcaption>
    </figure>
  );
}
