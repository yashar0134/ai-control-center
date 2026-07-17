import { Download, ShieldCheck } from "lucide-react";
import type { getClaudeCodePageData } from "@/server/services/analytics-service";
import { CLAUDE_CODE_COLLECTOR_ID } from "@/server/collectors/claude-code/claude-code-collector";
import { Card, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RunCollectorButton } from "@/components/collectors/run-collector-button";
import { UsageTrendChart } from "@/components/charts/usage-trend-chart";
import { formatCompact, formatDateTime, formatTokens } from "@/lib/format";

type ClaudeCodePageData = Awaited<ReturnType<typeof getClaudeCodePageData>>;

/**
 * Real Claude Code usage: import action, source detection, token totals,
 * model breakdown, and a 30-day trend — all from locally-observed events
 * only. Demo rows are excluded from every number shown here.
 */
export function ClaudeCodeUsageSection({
  data,
  importEnabled,
}: {
  data: ClaudeCodePageData;
  importEnabled: boolean;
}) {
  const { summary, demoEventCount, lastRun, recentRuns, detection } = data;
  const hasRealData = summary.eventCount > 0;
  const observedBadge = <ProvenanceBadge provenance="locally-observed" />;

  return (
    <section aria-labelledby="claude-usage-heading" className="mt-4">
      <h2 id="claude-usage-heading" className="sr-only">
        Local Claude Code usage
      </h2>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Import Claude Code usage</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Local data source</dt>
              <dd>
                {detection.dataDirFound ? (
                  <Badge tone="success">detected</Badge>
                ) : (
                  <Badge tone="warning">not detected</Badge>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Session files found</dt>
              <dd className="tabular font-mono text-xs">{detection.sessionFileCount}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Import</dt>
              <dd>
                {importEnabled ? (
                  <Badge tone="success">enabled</Badge>
                ) : (
                  <Badge tone="warning">disabled in Settings</Badge>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Last import</dt>
              <dd className="text-right">
                {lastRun
                  ? `${formatDateTime(lastRun.startedAt)} · ${lastRun.status}`
                  : "never"}
              </dd>
            </div>
            {lastRun && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Written / skipped</dt>
                <dd className="tabular font-mono text-xs">
                  {lastRun.observationsWritten} / {lastRun.duplicatesSkipped}
                </dd>
              </div>
            )}
          </dl>
          {lastRun?.message && (
            <p className="mt-2 text-xs text-faint-foreground">{lastRun.message}</p>
          )}
          <div className="mt-4">
            <RunCollectorButton
              collectorId={CLAUDE_CODE_COLLECTOR_ID}
              label="Import Claude Code usage"
              pendingLabel="Importing usage metadata…"
            />
            <p className="mt-2 text-xs text-faint-foreground">
              Manual import — nothing runs in the background. Re-importing never
              creates duplicates; newly recorded sessions are picked up each run.
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle action={observedBadge}>Real token usage — all imported history</CardTitle>
          {hasRealData ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total tokens"
                  value={formatCompact(summary.totalTokens)}
                  badge={observedBadge}
                  hint="Input + output of imported events"
                />
                <StatCard
                  label="Input / output"
                  value={
                    <span className="text-lg">
                      {formatCompact(summary.inputTokens)} /{" "}
                      {formatCompact(summary.outputTokens)}
                    </span>
                  }
                  badge={observedBadge}
                  hint="Unknown values stay unknown"
                />
                <StatCard
                  label="Cache created / read"
                  value={
                    <span className="text-lg">
                      {formatCompact(summary.cacheCreationTokens)} /{" "}
                      {formatCompact(summary.cacheReadTokens)}
                    </span>
                  }
                  badge={observedBadge}
                  hint="Prompt-cache tokens, tracked separately"
                />
                <StatCard
                  label="Usage events"
                  value={formatTokens(summary.eventCount)}
                  badge={observedBadge}
                  trend={
                    <p className="mt-1 text-xs text-muted-foreground">
                      {summary.lastEventAt
                        ? `Latest ${formatDateTime(summary.lastEventAt)}`
                        : ""}
                    </p>
                  }
                  hint="One event per assistant response"
                />
              </div>
              {demoEventCount > 0 && (
                <p className="mt-3 text-xs text-faint-foreground">
                  {demoEventCount} older demo-labeled events also exist for this
                  connection; they are excluded from every number above and stay
                  marked <ProvenanceBadge provenance="demo" /> everywhere.
                </p>
              )}
            </>
          ) : (
            <EmptyState
              title="No usage imported yet"
              description={
                detection.dataDirFound
                  ? 'Click "Import Claude Code usage" to read token metadata from your local Claude Code sessions. Only timestamps, model names, and token counts are imported.'
                  : "Claude Code local data was not found on this machine. Install Claude Code, use it at least once, then import."
              }
            />
          )}
        </Card>
      </div>

      {hasRealData && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle action={observedBadge}>Daily usage — last 30 days</CardTitle>
            <UsageTrendChart
              data={summary.dailyTrend}
              days={30}
              sourceLabel="locally observed"
            />
          </Card>
          <Card>
            <CardTitle action={observedBadge}>Top models by usage</CardTitle>
            {summary.topModels.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Models ranked by known total tokens across imported Claude Code
                    usage.
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">Model</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Events</th>
                      <th scope="col" className="py-2 text-right font-medium">Known tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topModels.map((m) => (
                      <tr key={m.model} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-mono text-xs">{m.model}</td>
                        <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                          {formatTokens(m.events)}
                        </td>
                        <td className="tabular py-2 text-right font-mono text-xs">
                          {formatTokens(m.totalTokens)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No models yet" description="Import usage to see the breakdown." />
            )}
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <CardTitle>Privacy</CardTitle>
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <div className="space-y-1">
            <p>
              <span className="font-medium text-foreground">Imported:</span>{" "}
              timestamps, model identifiers, and token counts (input, output,
              cache) from local Claude Code session records — labeled{" "}
              <ProvenanceBadge provenance="locally-observed" />.
            </p>
            <p>
              <span className="font-medium text-foreground">Never imported:</span>{" "}
              prompts, responses, source code, file names, project names,
              directory paths, session titles, or account identity. Subscription
              quota, remaining allowance, and reset times are{" "}
              <span className="font-medium">not available</span> from any
              supported local source and are never shown as if they were.
            </p>
          </div>
        </div>
      </Card>

      {recentRuns.length > 1 && (
        <Card className="mt-4">
          <CardTitle action={<Download size={14} aria-hidden="true" className="text-muted-foreground" />}>
            Recent imports
          </CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Five most recent Claude Code import runs.</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Started</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Written</th>
                  <th scope="col" className="py-2 text-right font-medium">Skipped</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="tabular py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(r.startedAt)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={r.status === "success" ? "success" : "danger"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                      {r.observationsWritten}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-xs">
                      {r.duplicatesSkipped}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
