import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { getConnectionDetail } from "@/server/services/connections-service";
import { getClaudeCodePageData } from "@/server/services/analytics-service";
import { getSettings } from "@/server/services/settings-service";
import { CLAUDE_CODE_CONNECTION_ID } from "@/server/collectors/claude-code/claude-code-collector";
import { ClaudeCodeUsageSection } from "@/components/claude-code/claude-code-usage-section";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import {
  CapabilityStateBadge,
  ConnectionStatusBadge,
  HealthBadge,
  ProvenanceBadge,
} from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RunCollectorButton } from "@/components/collectors/run-collector-button";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTokens,
} from "@/lib/format";

export const metadata: Metadata = { title: "Connection detail" };

const SUPPORTED_STATES = new Set(["available", "manual", "estimated", "planned"]);

export default async function ConnectionDetailPage({
  params,
}: {
  params: Promise<{ connectionId: string }>;
}) {
  const { connectionId } = await params;
  const detail = await getConnectionDetail(connectionId);
  if (!detail) notFound();

  const { connection, usageEvents, costRecords, latestHealth, collector, lastCollectorRun, declaration } = detail;

  const isClaudeCode = connection.id === CLAUDE_CODE_CONNECTION_ID;
  const [claudeData, settings] = isClaudeCode
    ? await Promise.all([getClaudeCodePageData(), getSettings()])
    : [null, null];

  const collectorButtonLabels =
    collector?.id === "claude-code-local"
      ? { label: "Import Claude Code usage", pendingLabel: "Importing usage metadata…" }
      : { label: undefined, pendingLabel: undefined };

  const supported = connection.capabilities.filter((c) => SUPPORTED_STATES.has(c.state));
  const notSupported = connection.capabilities.filter((c) => !SUPPORTED_STATES.has(c.state));

  return (
    <>
      <Link
        href="/providers"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={12} aria-hidden="true" /> All providers
      </Link>
      <PageHeader
        title={connection.name}
        description={`${connection.provider.name} · ${connection.kind}`}
        action={<ConnectionStatusBadge status={connection.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Connection</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Provider</dt>
              <dd>{connection.provider.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{connection.kind}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Status</dt>
              <dd><ConnectionStatusBadge status={connection.status} /></dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Collection method</dt>
              <dd className="text-right">{connection.collectionMethod}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Health</dt>
              <dd>
                {latestHealth ? (
                  <span className="inline-flex items-center gap-2">
                    <HealthBadge status={latestHealth.status} />
                    <ProvenanceBadge provenance={latestHealth.provenance} />
                  </span>
                ) : (
                  <span className="text-faint-foreground">unknown</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-4 border-t border-border pt-4">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground opacity-70"
            >
              <Lock size={14} aria-hidden="true" />
              Connect — available in a later phase
            </button>
            <p className="mt-2 text-xs text-faint-foreground">
              Connecting real accounts (and storing any API key) is intentionally not
              implemented yet. This app currently asks for no credentials.
            </p>
          </div>
        </Card>

        <Card>
          <CardTitle>Capabilities</CardTitle>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Supported or planned
          </h3>
          <ul className="mt-2 space-y-1.5">
            {supported.map((cap) => (
              <li key={cap.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{cap.capability}</span>
                <CapabilityStateBadge state={cap.state} />
              </li>
            ))}
            {supported.length === 0 && (
              <li className="text-sm text-faint-foreground">None</li>
            )}
          </ul>
          <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Not available
          </h3>
          <ul className="mt-2 space-y-1.5">
            {notSupported.map((cap) => (
              <li key={cap.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{cap.capability}</span>
                <span className="flex items-center gap-2">
                  <CapabilityStateBadge state={cap.state} />
                </span>
              </li>
            ))}
            {notSupported.length === 0 && (
              <li className="text-sm text-faint-foreground">None</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle>Collector</CardTitle>
          {collector ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{collector.description}</p>
              <dl className="space-y-2">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Collector</dt>
                  <dd className="font-mono text-xs">{collector.id}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Last run</dt>
                  <dd>
                    {lastCollectorRun
                      ? `${formatDateTime(lastCollectorRun.startedAt)} · ${lastCollectorRun.status}`
                      : "never"}
                  </dd>
                </div>
                {lastCollectorRun && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Written / skipped</dt>
                    <dd className="tabular font-mono text-xs">
                      {lastCollectorRun.observationsWritten} / {lastCollectorRun.duplicatesSkipped}
                    </dd>
                  </div>
                )}
              </dl>
              <RunCollectorButton
                collectorId={collector.id}
                label={collectorButtonLabels.label}
                pendingLabel={collectorButtonLabels.pendingLabel}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No collector exists for this connection yet.{" "}
              {connection.collectionMethod === "manual-entry"
                ? "Costs are tracked by manual entry."
                : "Collection is planned for a later phase."}
            </p>
          )}
          <div className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <p>{connection.privacyNotes ?? declaration?.privacyNotes ?? "No privacy notes."}</p>
          </div>
        </Card>
      </div>

      {isClaudeCode && claudeData && settings && (
        <ClaudeCodeUsageSection
          data={claudeData}
          importEnabled={settings.collectionEnabled && settings.claudeCodeImportEnabled}
        />
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Recent usage events</CardTitle>
          {usageEvents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Ten most recent usage events for {connection.name}.
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Time</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Model</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Tokens</th>
                    <th scope="col" className="py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {usageEvents.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="tabular py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(e.occurredAt)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {e.model ?? <span className="text-faint-foreground">unknown</span>}
                      </td>
                      <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                        {formatTokens(e.totalTokens)}
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
              title="No usage recorded"
              description={
                connection.status === "manual"
                  ? "Subscription usage cannot be read from any supported source."
                  : "No usage events exist for this connection yet."
              }
            />
          )}
        </Card>

        <Card>
          <CardTitle>Recent cost records</CardTitle>
          {costRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Ten most recent cost records for {connection.name}.
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Period</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Kind</th>
                    <th scope="col" className="py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {costRecords.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="tabular py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {formatDate(r.periodStart)}
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
              description="No costs have been recorded for this connection yet."
            />
          )}
        </Card>
      </div>
    </>
  );
}
