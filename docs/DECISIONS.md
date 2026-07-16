# Architectural decisions

Compact ADR log. Only decisions with real consequences are recorded.

## ADR-1: Prisma 6 (not 7) with SQLite
- **Decision:** pin `prisma` / `@prisma/client` to major version 6.
- **Context:** `npm install prisma` resolved to Prisma 7, which requires driver adapters (native `better-sqlite3`), a `prisma.config.ts`, and a new generator — more moving parts on a beginner-operated Windows machine.
- **Rationale:** Prisma 6's SQLite workflow is self-contained (no native build steps, no env vars, hardcoded file URL) and battle-tested with Next.js.
- **Consequences:** upgrade to 7 is a deliberate future task; schema hardcodes `file:./dev.db` so no `.env` is needed at all.

## ADR-2: Explicit dedupe instead of `createMany({ skipDuplicates })`
- **Decision:** de-duplication is a pure function (`splitFreshObservations`) run before insert, backed by a unique `dedupeKey` column.
- **Context:** Prisma does not support `skipDuplicates` on SQLite.
- **Consequences:** duplicate protection is unit-testable, and collector runs can truthfully report written vs. skipped counts. The unique constraint remains a second line of defense.

## ADR-3: Unknown values are `NULL`, never 0
- **Decision:** token counts and costs use nullable columns; totals are derived only when both parts (or an explicit total) are known; formatters render `unknown`.
- **Context:** the product's core principle is truth over appearance; zero is a measurement, absence is not.
- **Consequences:** aggregations must handle nulls explicitly (tokens trend sums only known values and says so).

## ADR-4: Lightweight internal components instead of shadcn/ui
- **Decision:** hand-written Card/Badge/StatCard/EmptyState primitives (~5 small files).
- **Context:** the milestone needs ~6 primitives; shadcn would generate more code and dependencies than the entire component layer written by hand.
- **Consequences:** less code to maintain now; shadcn can still be adopted later if the component surface grows.

## ADR-5: Deterministic, date-seeded demo collector
- **Decision:** demo data is generated with a seeded PRNG keyed by `connectionId + date`, producing stable dedupe keys.
- **Context:** the vertical slice must prove idempotency end-to-end and be honestly reproducible.
- **Consequences:** re-running the collector on the same day is a visible no-op ("duplicate protection"); seed and collector share one code path.

## ADR-6: Capabilities and statuses persisted in SQLite, declared in a typed registry
- **Decision:** provider/connection/capability truth lives in `providers/registry.ts` and is upserted into the DB by the seed; pages read the DB.
- **Context:** detail pages must be data-driven, not hardcoded per route, while keeping a single source of truth in code review.
- **Consequences:** changing a capability is a registry edit + reseed; a future admin UI can edit the DB directly.

## ADR-7: Money stored as float in a single display currency
- **Decision:** `amount Float` + per-record currency code; one configured display currency; no conversion.
- **Context:** current values are demo/estimated/manual; sub-cent float error is immaterial and SQLite lacks a native decimal.
- **Consequences:** revisit (integer minor-units or Decimal) before ingesting real billing data in Phase 5.
