import type { Metadata } from "next";
import { Cpu, HardDrive, MemoryStick, Network, ServerCog } from "lucide-react";
import { getSystemPageData } from "@/server/services/analytics-service";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { Badge, HealthBadge, ProvenanceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "System" };

function metricNumber(
  metrics: Record<string, number | string> | null,
  key: string,
): number | null {
  const v = metrics?.[key];
  return typeof v === "number" ? v : null;
}

export default async function SystemPage() {
  const { machineSnapshot, metrics, lastRun, recentRuns } = await getSystemPageData();

  const cpu = metricNumber(metrics, "cpuPercent");
  const memUsed = metricNumber(metrics, "memoryUsedGb");
  const memTotal = metricNumber(metrics, "memoryTotalGb");
  const diskUsed = metricNumber(metrics, "diskUsedGb");
  const diskTotal = metricNumber(metrics, "diskTotalGb");
  const netDown = metricNumber(metrics, "networkDownMbps");
  const netUp = metricNumber(metrics, "networkUpMbps");

  const tiles = [
    {
      key: "cpu",
      label: "CPU",
      Icon: Cpu,
      value: cpu === null ? "unknown" : `${cpu}%`,
      detail: "utilization",
    },
    {
      key: "memory",
      label: "Memory",
      Icon: MemoryStick,
      value: memUsed === null ? "unknown" : `${memUsed} GB`,
      detail: memTotal === null ? "" : `of ${memTotal} GB`,
    },
    {
      key: "disk",
      label: "Disk",
      Icon: HardDrive,
      value: diskUsed === null ? "unknown" : `${diskUsed} GB`,
      detail: diskTotal === null ? "" : `of ${diskTotal} GB used`,
    },
    {
      key: "network",
      label: "Network",
      Icon: Network,
      value: netDown === null ? "unknown" : `${netDown} Mbps`,
      detail: netUp === null ? "" : `down · ${netUp} Mbps up`,
    },
  ];

  return (
    <>
      <PageHeader
        title="System"
        description="Local machine and collector-service monitoring. Everything below is demo data — the real Windows collector arrives in Phase 2 and this app has not read any actual machine statistics."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ key, label, Icon, value, detail }) => (
          <div key={key} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Icon size={14} aria-hidden="true" />
                {label}
              </p>
              <Badge tone="demo">demo</Badge>
            </div>
            <p className="tabular mt-2 font-mono text-2xl font-semibold">{value}</p>
            {detail && <p className="mt-1 text-xs text-faint-foreground">{detail}</p>}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Collector service</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <ServerCog size={14} aria-hidden="true" /> Status
              </dt>
              <dd>
                {lastRun ? (
                  <HealthBadge status={lastRun.status === "success" ? "ok" : "down"} />
                ) : (
                  <HealthBadge status="unknown" />
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Snapshot captured</dt>
              <dd>
                {machineSnapshot
                  ? formatDateTime(machineSnapshot.capturedAt)
                  : "never"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Snapshot source</dt>
              <dd>
                {machineSnapshot ? (
                  <ProvenanceBadge provenance={machineSnapshot.provenance} />
                ) : (
                  <span className="text-faint-foreground">unknown</span>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-border pt-4 text-xs text-faint-foreground">
            Phase 2 will add a real Windows collector using safe, unprivileged
            OS counters (CPU, memory, disk, network). It will never read file
            contents, window titles, or process arguments.
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
              description="Run the demo collector from the Overview page."
            />
          )}
        </Card>
      </div>
    </>
  );
}
