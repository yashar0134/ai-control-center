"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact } from "@/lib/format";

interface Point {
  date: string; // YYYY-MM-DD
  events: number;
  tokens: number;
}

function shortDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

export function UsageTrendChart({
  data,
  days = 14,
  sourceLabel = "demo",
}: {
  data: Point[];
  /** Number of days covered (for the text alternative). */
  days?: number;
  /** Truthful provenance label woven into tooltip + text alternative. */
  sourceLabel?: string;
}) {
  const totalEvents = data.reduce((s, p) => s + p.events, 0);
  return (
    <figure
      aria-label={`Usage trend over the last ${days} days: ${totalEvents} ${sourceLabel} usage events in total.`}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDay}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)" }}
              contentStyle={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--foreground)",
                fontSize: 12,
              }}
              labelFormatter={(label) => `${shortDay(String(label))} (${sourceLabel})`}
              formatter={(value, _name, item) => {
                const tokens = (item?.payload as Point | undefined)?.tokens;
                return [
                  `${value} events · ${formatCompact(tokens ?? null)} known tokens`,
                  "usage",
                ];
              }}
            />
            <Area
              type="monotone"
              dataKey="events"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="var(--accent)"
              fillOpacity={0.12}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Daily {sourceLabel} usage events for the last {days} days. Token totals
        include only events with known token counts.
      </figcaption>
    </figure>
  );
}
