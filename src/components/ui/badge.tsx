import type { ReactNode } from "react";

type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "demo"
  | "muted";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "border-border text-foreground",
  success: "border-success/40 text-success",
  warning: "border-warning/40 text-warning",
  danger: "border-danger/40 text-danger",
  info: "border-info/40 text-info",
  demo: "border-demo/40 text-demo",
  muted: "border-border text-muted-foreground",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border bg-surface-raised/50 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Maps a data-provenance value to a labeled badge. Status is text, not just color. */
export function ProvenanceBadge({ provenance }: { provenance: string }) {
  const tone: BadgeTone =
    provenance === "live"
      ? "success"
      : provenance === "demo"
        ? "demo"
        : provenance === "manual"
          ? "info"
          : provenance === "estimated"
            ? "warning"
            : provenance === "stale"
              ? "warning"
              : provenance === "locally-observed"
                ? "info"
                : "muted";
  return <Badge tone={tone}>{provenance}</Badge>;
}

export function ConnectionStatusBadge({ status }: { status: string }) {
  const labelMap: Record<string, { label: string; tone: BadgeTone }> = {
    demo: { label: "demo data", tone: "demo" },
    manual: { label: "manual tracking", tone: "info" },
    "not-connected": { label: "not connected", tone: "muted" },
    planned: { label: "planned", tone: "muted" },
    unavailable: { label: "unavailable", tone: "warning" },
    unsupported: { label: "unsupported", tone: "muted" },
  };
  const entry = labelMap[status] ?? { label: status, tone: "muted" as BadgeTone };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function HealthBadge({ status }: { status: string }) {
  const tone: BadgeTone =
    status === "ok"
      ? "success"
      : status === "degraded"
        ? "warning"
        : status === "down"
          ? "danger"
          : "muted";
  return <Badge tone={tone}>{status}</Badge>;
}

export function CapabilityStateBadge({ state }: { state: string }) {
  const tone: BadgeTone =
    state === "available"
      ? "success"
      : state === "manual"
        ? "info"
        : state === "estimated"
          ? "warning"
          : state === "planned"
            ? "neutral"
            : "muted"; // unavailable / unsupported
  return <Badge tone={tone}>{state}</Badge>;
}
