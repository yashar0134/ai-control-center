import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Cpu,
  HardDrive,
  MemoryStick,
  MonitorX,
  ServerCog,
  Settings2,
} from "lucide-react";
import { getSystemPageData } from "@/server/services/analytics-service";
import { getSettings } from "@/server/services/settings-service";
import { windowsSystemCollector } from "@/server/collectors/system/windows-system-collector";
import {
  SCREENSHOT_CAPTURED_AT,
  SCREENSHOT_SYSTEM_METRICS,
} from "@/server/collectors/system/screenshot-fixtures";
import { isStale, STALE_AFTER_MS } from "@/server/domain/freshness";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { Badge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RunCollectorButton } from "@/components/collectors/run-collector-button";
import {
  formatDateTime,
  formatDurationMs,
  formatGiB,
  formatMbps,
} from "@/lib/format";

export const metadata: Metadata = { title: "System" };

type TileState = "observed" | "stale" | "unavailable" | "unsupported" | "demo";

function TileBadge({ state }: { state: TileState }) {
  switch (state) {
    case "observed":
      return <Badge tone="info">locally observed</Badge>;
    case "stale":
      return <Badge tone="warning">stale</Badge>;
    case "demo":
      return <Badge tone="demo">demo</Badge>;
    case "unsupported":
      return <Badge tone="muted">unsupported</Badge>;
    default:
      return <Badge tone="muted">unavailable</Badge>;
  }
}

function MetricTile({
  label,
  Icon,
  value,
  detail,
  state,
}: {
  label: string;
  Icon: typeof Cpu;
  value: string;
  detail?: string;
  state: TileState;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon size={14} aria-hidden="true" />
          {label}
        </p>
        <TileBadge state={state} />
      </div>
      <p className="tabular mt-2 font-mono text-2xl font-semibold">{value}</p>
      {detail && <p className="mt-1 text-xs text-faint-foreground">{detail}</p>}
    </div>
  );
}

export default async function SystemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [data, settings, params] = await Promise.all([
    getSystemPageData(),
    getSettings(),
    searchParams,
  ]);
  const { realSnapshot, realMetrics, demoSnapshot, demoMetrics, lastSystemRun, recentRuns } =
    data;

  // Screenshot-preview mode: development builds only, fixed synthetic
  // fixtures, every tile labeled "demo", nothing measured, nothing written.
  // Production builds ignore the parameter entirely.
  const screenshotPreview =
    process.env.NODE_ENV !== "production" && params.preview === "demo";

  // This app runs on the user's own machine, so the server platform IS the
  // machine's platform.
  const isWindows = process.platform === "win32";
  const collectionEnabled = settings.collectionEnabled;
  const canCollect = isWindows && collectionEnabled && !screenshotPreview;

  const snapshotIsStale =
    !screenshotPreview && realSnapshot ? isStale(realSnapshot.capturedAt) : false;
  const baseState: TileState = screenshotPreview
    ? "demo"
    : !isWindows
      ? "unsupported"
      : snapshotIsStale
        ? "stale"
        : "observed";

  const m = screenshotPreview ? SCREENSHOT_SYSTEM_METRICS : realMetrics;
  const snapshotCapturedAt = screenshotPreview
    ? SCREENSHOT_CAPTURED_AT
    : (realSnapshot?.capturedAt ?? null);
  const snapshotProvenance = screenshotPreview
    ? "demo"
    : (realSnapshot?.provenance ?? null);
  const hasSnapshot = screenshotPreview || (realSnapshot !== null && m !== null);
  const tiles = [
    {
      key: "cpu",
      label: "CPU",
      Icon: Cpu,
      value: m?.cpuPercent !== undefined ? `${m.cpuPercent}%` : "Unavailable",
      detail:
        m?.cpuPercent !== undefined
          ? m.cpuCount !== undefined
            ? `utilization · ${m.cpuCount} logical cores`
            : "utilization"
          : undefined,
      state: m?.cpuPercent !== undefined ? baseState : ("unavailable" as TileState),
    },
    {
      key: "memory",
      label: "Memory",
      Icon: MemoryStick,
      value: m?.memoryPercent !== undefined ? `${m.memoryPercent}%` : "Unavailable",
      detail:
        m?.memoryUsedBytes !== undefined && m?.memoryTotalBytes !== undefined
          ? `${formatGiB(m.memoryUsedBytes)} of ${formatGiB(m.memoryTotalBytes)} used`
          : undefined,
      state: m?.memoryPercent !== undefined ? baseState : ("unavailable" as TileState),
    },
    {
      key: "disk",
      label: "Disk",
      Icon: HardDrive,
      value: m?.diskPercent !== undefined ? `${m.diskPercent}%` : "Unavailable",
      detail:
        m?.diskUsedBytes !== undefined && m?.diskTotalBytes !== undefined
          ? `${formatGiB(m.diskUsedBytes)} of ${formatGiB(m.diskTotalBytes)} · volume hosting this app`
          : undefined,
      state: m?.diskPercent !== undefined ? baseState : ("unavailable" as TileState),
    },
    {
      key: "down",
      label: "Download",
      Icon: ArrowDownToLine,
      value:
        m?.networkDownBytesPerSec !== undefined
          ? formatMbps(m.networkDownBytesPerSec)
          : "Unavailable",
      detail:
        m?.networkDownBytesPerSec !== undefined
          ? "all active interfaces"
          : undefined,
      state:
        m?.networkDownBytesPerSec !== undefined
          ? baseState
          : ("unavailable" as TileState),
    },
    {
      key: "up",
      label: "Upload",
      Icon: ArrowUpFromLine,
      value:
        m?.networkUpBytesPerSec !== undefined
          ? formatMbps(m.networkUpBytesPerSec)
          : "Unavailable",
      detail:
        m?.networkUpBytesPerSec !== undefined ? "all active interfaces" : undefined,
      state:
        m?.networkUpBytesPerSec !== undefined
          ? baseState
          : ("unavailable" as TileState),
    },
  ];

  return (
    <>
      <PageHeader
        title="System"
        description="Real, locally-observed machine metrics. Nothing is sent anywhere — measurements stay in your local database."
        action={
          canCollect ? (
            <RunCollectorButton
              collectorId={windowsSystemCollector.id}
              label="Collect now"
              pendingLabel="Collecting…"
            />
          ) : undefined
        }
      />

      {screenshotPreview && (
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <MonitorX size={16} className="mt-0.5 shrink-0 text-demo" aria-hidden="true" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Screenshot preview — synthetic example data (development only).
              </p>
              <p className="mt-1">
                Nothing below was measured on this machine. This mode exists so
                project documentation can show the layout without exposing real
                system values.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!screenshotPreview && !isWindows && (
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <MonitorX size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Real system collection is not supported on this platform yet.
              </p>
              <p className="mt-1">
                The system collector currently supports Windows only. macOS and
                Linux collectors are planned as separate phases. No fake values
                are shown.
              </p>
            </div>
          </div>
        </Card>
      )}

      {!screenshotPreview && isWindows && !collectionEnabled && (
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <Settings2 size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Local collection is disabled.</p>
              <p className="mt-1">
                The system collector will not run and no snapshot will be written
                while collection is off. Enable “Local data collection” in{" "}
                <Link href="/settings" className="text-accent hover:underline">
                  Settings
                </Link>{" "}
                to collect real metrics.
              </p>
            </div>
          </div>
        </Card>
      )}

      <section aria-labelledby="real-metrics-heading">
        <h2 id="real-metrics-heading" className="sr-only">
          Real machine metrics
        </h2>
        {hasSnapshot && m ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {tiles.map(({ key, ...tile }) => (
                <MetricTile key={key} {...tile} />
              ))}
            </div>
            <p className="mt-2 text-xs text-faint-foreground">
              {screenshotPreview ? "Example measurement" : "Measured"}{" "}
              {snapshotCapturedAt ? formatDateTime(snapshotCapturedAt) : "unknown"}
              {m.collectionDurationMs !== undefined &&
                ` in ${formatDurationMs(m.collectionDurationMs)}`}
              {" · "}one-shot measurement, provenance{" "}
              {snapshotProvenance && <ProvenanceBadge provenance={snapshotProvenance} />}
              {snapshotIsStale &&
                ` · older than ${Math.round(STALE_AFTER_MS / 60000)} minutes — collect again for current values`}
            </p>
          </>
        ) : (
          <EmptyState
            title={
              isWindows
                ? "No real measurements yet"
                : "No real measurements on this platform"
            }
            description={
              isWindows
                ? collectionEnabled
                  ? "Click “Collect now” to take a one-shot measurement of CPU, memory, disk capacity, and network throughput. Only aggregate totals are read — never files, processes, or identifiers."
                  : "Enable local data collection in Settings, then collect your first snapshot."
                : "The real collector supports Windows only, so no machine values are shown here."
            }
          />
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Collector status</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <ServerCog size={14} aria-hidden="true" /> Collector
              </dt>
              <dd className="font-mono text-xs">{windowsSystemCollector.id}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Platform support</dt>
              <dd>
                {isWindows ? (
                  <Badge tone="success">supported (Windows)</Badge>
                ) : (
                  <Badge tone="muted">unsupported — Windows only</Badge>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Local collection</dt>
              <dd>
                {collectionEnabled ? (
                  <Badge tone="success">enabled</Badge>
                ) : (
                  <Badge tone="warning">disabled</Badge>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Privileges</dt>
              <dd className="text-right">standard user — no administrator rights</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Last run</dt>
              <dd className="text-right">
                {lastSystemRun
                  ? `${formatDateTime(lastSystemRun.startedAt)} · ${lastSystemRun.status}`
                  : "never"}
              </dd>
            </div>
            {lastSystemRun?.finishedAt && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="tabular font-mono text-xs">
                  {formatDurationMs(
                    lastSystemRun.finishedAt.getTime() - lastSystemRun.startedAt.getTime(),
                  )}
                </dd>
              </div>
            )}
            {lastSystemRun?.message && (
              <div className="border-t border-border pt-2">
                <dt className="sr-only">Last run notes</dt>
                <dd className="text-xs text-faint-foreground">{lastSystemRun.message}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 border-t border-border pt-4 text-xs text-faint-foreground">
            Collected: aggregate CPU %, memory totals, capacity of the volume
            hosting this app, and summed network throughput. Never collected:
            files, file names, processes, adapter identifiers, usernames,
            hostname, or any machine-identifying value.
          </p>
        </Card>

        <Card>
          <CardTitle>Recent collector runs</CardTitle>
          {recentRuns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Ten most recent collector runs.</caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Started</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Collector</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                    <th scope="col" className="py-2 text-right font-medium">Written / skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="tabular py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(r.startedAt)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{r.collectorId}</td>
                      <td className="py-2 pr-3">
                        <Badge tone={r.status === "success" ? "success" : "danger"}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="tabular py-2 text-right font-mono text-xs">
                        {r.observationsWritten} / {r.duplicatesSkipped}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No collector runs yet"
              description="Run a collector to see its history here."
            />
          )}
        </Card>
      </div>

      {demoSnapshot && demoMetrics && (
        <Card className="mt-4">
          <CardTitle action={<Badge tone="demo">demo</Badge>}>
            Demo snapshot — synthetic example, not your machine
          </CardTitle>
          <p className="mb-3 text-xs text-faint-foreground">
            Generated by the demo collector for demonstration only. It is stored
            separately from real measurements and never mixed into the tiles above.
          </p>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {[
              ["CPU", typeof demoMetrics.cpuPercent === "number" ? `${demoMetrics.cpuPercent}%` : "unknown"],
              ["Memory", typeof demoMetrics.memoryUsedGb === "number" ? `${demoMetrics.memoryUsedGb} / ${demoMetrics.memoryTotalGb ?? "?"} GB` : "unknown"],
              ["Disk", typeof demoMetrics.diskUsedGb === "number" ? `${demoMetrics.diskUsedGb} / ${demoMetrics.diskTotalGb ?? "?"} GB` : "unknown"],
              ["Network", typeof demoMetrics.networkDownMbps === "number" ? `${demoMetrics.networkDownMbps} Mbps down · ${demoMetrics.networkUpMbps ?? "?"} Mbps up` : "unknown"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </>
  );
}
