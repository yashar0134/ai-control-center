import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, KeyRound, MonitorSmartphone, Repeat } from "lucide-react";
import { getConnectionsOverview } from "@/server/services/connections-service";
import { Card, PageHeader } from "@/components/ui/card";
import {
  Badge,
  CapabilityStateBadge,
  ConnectionStatusBadge,
  HealthBadge,
} from "@/components/ui/badge";

export const metadata: Metadata = { title: "Providers" };

const KIND_META = {
  subscription: { label: "Subscription", Icon: Repeat },
  api: { label: "API", Icon: KeyRound },
  "local-tool": { label: "Local tool", Icon: MonitorSmartphone },
} as const;

/** Capabilities worth surfacing on the card (full list on the detail page). */
const CARD_CAPABILITIES = ["usage", "cost", "quota"] as const;

export default async function ProvidersPage() {
  const connections = await getConnectionsOverview();

  return (
    <>
      <PageHeader
        title="Providers"
        description="Each card is one product connection. Statuses and capabilities are truthful: nothing is shown as connected or measurable unless it really is."
      />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {connections.map((c) => {
          const kind = KIND_META[c.kind as keyof typeof KIND_META] ?? KIND_META.api;
          const cardCaps = CARD_CAPABILITIES.map((key) =>
            c.capabilities.find((cap) => cap.capability === key),
          ).filter((cap) => cap !== undefined);
          return (
            <li key={c.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {c.provider.name}
                    </p>
                    <h2 className="mt-0.5 text-sm font-semibold">{c.name}</h2>
                  </div>
                  <ConnectionStatusBadge status={c.status} />
                </div>

                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <kind.Icon size={13} aria-hidden="true" />
                  {kind.label}
                  {c.latestHealth && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      health: <HealthBadge status={c.latestHealth.status} />
                    </span>
                  )}
                </p>

                <dl className="space-y-1.5 text-xs">
                  {cardCaps.map((cap) => (
                    <div key={cap.id} className="flex items-center justify-between gap-2">
                      <dt className="text-muted-foreground">{cap.capability}</dt>
                      <dd>
                        <CapabilityStateBadge state={cap.state} />
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                  {c.status === "demo" ? (
                    <Badge tone="demo">showing demo data</Badge>
                  ) : (
                    <span className="text-xs text-faint-foreground">
                      {c.collectionMethod === "manual-entry"
                        ? "tracked manually"
                        : c.collectionMethod === "planned-official-api"
                          ? "official API planned"
                          : c.collectionMethod === "planned-local-file"
                            ? "local collector planned"
                            : "no collection"}
                    </span>
                  )}
                  <Link
                    href={`/providers/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    Details
                    <ArrowRight size={12} aria-hidden="true" />
                    <span className="sr-only"> for {c.name}</span>
                  </Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
