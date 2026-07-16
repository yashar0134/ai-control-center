import { db } from "@/server/db/client";
import { getConnectionDeclaration } from "@/server/providers/registry";
import { listCollectors } from "@/server/collectors/registry";

/** Connections list for the providers page, with capability + health context. */
export async function getConnectionsOverview() {
  const connections = await db.connection.findMany({
    include: {
      provider: true,
      capabilities: true,
    },
    orderBy: [{ providerId: "asc" }, { name: "asc" }],
  });

  const latestHealth = await db.healthSnapshot.findMany({
    where: { subjectType: "connection" },
    orderBy: { capturedAt: "desc" },
    distinct: ["subjectId"],
  });
  const healthByConnection = new Map(latestHealth.map((h) => [h.subjectId, h]));

  return connections.map((c) => ({
    ...c,
    latestHealth: healthByConnection.get(c.id) ?? null,
  }));
}

/** Full detail for one connection, driven entirely by persisted data + registry metadata. */
export async function getConnectionDetail(connectionId: string) {
  const connection = await db.connection.findUnique({
    where: { id: connectionId },
    include: { provider: true, capabilities: true },
  });
  if (!connection) return null;

  const [usageEvents, costRecords, latestHealth] = await Promise.all([
    db.usageEvent.findMany({
      where: { connectionId },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),
    db.costRecord.findMany({
      where: { connectionId },
      orderBy: { periodStart: "desc" },
      take: 10,
    }),
    db.healthSnapshot.findFirst({
      where: { subjectType: "connection", subjectId: connectionId },
      orderBy: { capturedAt: "desc" },
    }),
  ]);

  const collector = listCollectors().find((col) =>
    col.connectionIds.includes(connectionId),
  );
  const lastCollectorRun = collector
    ? await db.collectorRun.findFirst({
        where: { collectorId: collector.id },
        orderBy: { startedAt: "desc" },
      })
    : null;

  const declaration = getConnectionDeclaration(connectionId);

  return {
    connection,
    usageEvents,
    costRecords,
    latestHealth,
    collector: collector ?? null,
    lastCollectorRun,
    declaration: declaration?.connection ?? null,
  };
}
