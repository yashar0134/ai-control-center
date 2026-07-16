import type { Metadata } from "next";
import Link from "next/link";
import { getCostsPageData } from "@/server/services/analytics-service";
import { getSettings } from "@/server/services/settings-service";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { CostTrendChart } from "@/components/charts/cost-trend-chart";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Costs" };

export default async function CostsPage() {
  const [data, settings] = await Promise.all([getCostsPageData(), getSettings()]);
  const currency = settings.displayCurrency;
  const kinds = ["actual", "estimated", "manual", "imported"] as const;

  return (
    <>
      <PageHeader
        title="Costs"
        description={`All amounts in ${currency} (configured in Settings — no live conversion). Current values are demo data.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="This month"
          value={formatCurrency(data.totals.total, currency)}
          hint="Demo estimates + demo subscription fees"
        />
        {kinds
          .filter((k) => (data.totals.byKind[k] ?? 0) > 0 || k !== "imported")
          .slice(0, 3)
          .map((k) => (
            <StatCard
              key={k}
              label={`${k} costs`}
              value={formatCurrency(data.totals.byKind[k] ?? 0, currency)}
              hint={
                k === "actual"
                  ? "Provider-billed amounts (none yet)"
                  : k === "estimated"
                    ? "Derived from token counts"
                    : "Entered by hand (demo placeholders)"
              }
            />
          ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<Badge tone="demo">demo</Badge>}>
            Daily spend — last 30 days
          </CardTitle>
          <CostTrendChart data={data.dailyTrend} currency={currency} />
        </Card>
        <Card>
          <CardTitle action={<Badge tone="demo">demo</Badge>}>
            Provider breakdown — this month
          </CardTitle>
          {data.byProvider.length > 0 ? (
            <ul className="space-y-3">
              {[...data.byProvider]
                .sort((a, b) => b.amount - a.amount)
                .map((p) => {
                  const pct =
                    data.totals.total > 0 ? (p.amount / data.totals.total) * 100 : 0;
                  return (
                    <li key={p.providerId}>
                      <div className="flex items-center justify-between text-sm">
                        <span>{p.providerName}</span>
                        <span className="tabular font-mono text-xs">
                          {formatCurrency(p.amount, currency)}
                        </span>
                      </div>
                      <div
                        className="mt-1 h-1.5 overflow-hidden rounded bg-surface-raised"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded bg-accent"
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-faint-foreground">
                        {pct.toFixed(0)}% of month
                      </p>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <EmptyState
              title="No costs this month"
              description="Run the demo collector to generate demo cost records."
            />
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Cost records</CardTitle>
        {data.records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">
                Most recent 50 cost records across all connections.
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Period</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Provider / connection</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Description</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Kind</th>
                  <th scope="col" className="py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="tabular py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(r.periodStart)}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="text-muted-foreground">{r.connection.provider.name}</span>{" "}
                      · {r.connection.name}
                    </td>
                    <td className="max-w-64 truncate py-2 pr-3 text-muted-foreground" title={r.description ?? undefined}>
                      {r.description ?? "—"}
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                      {formatCurrency(r.amount, r.currency)}
                    </td>
                    <td className="py-2 pr-3">{r.kind}</td>
                    <td className="py-2">
                      <ProvenanceBadge provenance={r.provenance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No cost records"
            description="Seed the database or run the demo collector to create demo records."
          />
        )}
        <p className="mt-3 text-xs text-faint-foreground">
          Display currency can be changed in{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Settings
          </Link>
          . Records keep the currency they were written with.
        </p>
      </Card>
    </>
  );
}
