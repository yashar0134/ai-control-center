import type { Metadata } from "next";
import Link from "next/link";
import { getActivity } from "@/server/services/analytics-service";
import { getSettings } from "@/server/services/settings-service";
import { EVENT_STATUSES, PROVENANCES } from "@/server/domain/types";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateTime, formatTokens } from "@/lib/format";

export const metadata: Metadata = { title: "Activity" };

const SELECT_CLASS =
  "rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-foreground";

function pick(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  return value;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    connectionId: pick(params.connection),
    model: pick(params.model),
    status: pick(params.status),
    provenance: pick(params.provenance),
  };
  const [{ events, connections, models }, settings] = await Promise.all([
    getActivity(filters),
    getSettings(),
  ]);
  const hasFilters = Object.values(filters).some((v) => v !== undefined);

  return (
    <>
      <PageHeader
        title="Activity"
        description="Normalized usage events across all connections. Unknown values are shown as unknown — never as zero."
      />

      <Card className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="f-connection" className="mb-1 block text-xs font-medium text-muted-foreground">
              Connection
            </label>
            <select id="f-connection" name="connection" defaultValue={filters.connectionId ?? ""} className={SELECT_CLASS}>
              <option value="">All</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-model" className="mb-1 block text-xs font-medium text-muted-foreground">
              Model
            </label>
            <select id="f-model" name="model" defaultValue={filters.model ?? ""} className={SELECT_CLASS}>
              <option value="">All</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-status" className="mb-1 block text-xs font-medium text-muted-foreground">
              Status
            </label>
            <select id="f-status" name="status" defaultValue={filters.status ?? ""} className={SELECT_CLASS}>
              <option value="">All</option>
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-provenance" className="mb-1 block text-xs font-medium text-muted-foreground">
              Source
            </label>
            <select id="f-provenance" name="provenance" defaultValue={filters.provenance ?? ""} className={SELECT_CLASS}>
              <option value="">All</option>
              {PROVENANCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Apply filters
            </button>
            {hasFilters && (
              <Link href="/activity" className="text-sm text-muted-foreground hover:text-foreground">
                Clear
              </Link>
            )}
          </div>
        </form>
      </Card>

      <Card>
        {events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <caption className="sr-only">
                Usage events, most recent first, limited to 100 rows.
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Time</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Provider / connection</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Model</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Event</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">In</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Out</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Total</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Cost</th>
                  <th scope="col" className="py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="tabular py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(e.occurredAt)}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="text-muted-foreground">{e.connection.provider.name}</span>{" "}
                      · {e.connection.name}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {e.model ?? <span className="text-faint-foreground">unknown</span>}
                    </td>
                    <td className="py-2 pr-3">{e.eventType}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={e.status === "ok" ? "success" : e.status === "error" ? "danger" : "muted"}>
                        {e.status}
                      </Badge>
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                      {formatTokens(e.inputTokens)}
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                      {formatTokens(e.outputTokens)}
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                      {formatTokens(e.totalTokens)}
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                      {e.costAmount === null ? (
                        <span className="text-faint-foreground">unknown</span>
                      ) : (
                        <>
                          {formatCurrency(e.costAmount, settings.displayCurrency)}
                          {e.costKind === "estimated" && (
                            <span className="ml-1 text-faint-foreground" title="estimated">est.</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-2">
                      <ProvenanceBadge provenance={e.provenance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No matching events"
            description={
              hasFilters
                ? "No events match the current filters. Try clearing them."
                : "Run the demo collector from the Overview page to generate demo events."
            }
          />
        )}
      </Card>
    </>
  );
}
