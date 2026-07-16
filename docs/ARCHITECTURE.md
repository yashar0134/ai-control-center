# Architecture

AI Control Center is a **modular monolith**: one Next.js application with strict internal boundaries that can be extracted later, and nothing distributed today.

## Layers and dependency direction

```
UI (src/app, src/components)
  ↓ may call
Server actions (src/server/actions)
  ↓ may call
Application services (src/server/services)
  ↓ may call
Data access (src/server/db — Prisma/SQLite)   Collector & provider contracts (src/server/collectors, src/server/providers)
  ↓ both depend on
Domain types & rules (src/server/domain)
```

Rules:

- UI never contains business logic and never touches Prisma directly; it calls services (reads) and server actions (writes).
- Collectors never persist anything; they return observations that the collector service validates, de-duplicates, and writes.
- Domain modules (`domain/*`) are pure and dependency-free — this is where tests concentrate.

## Major domains

providers · usage · costs · activity · collectors · system-monitoring · settings · audit. These are boundaries inside `src/server`, not microservices.

## Provider vs. connection

- **Provider** = a company (OpenAI, Anthropic, Google).
- **Connection** = one product relationship under a provider (ChatGPT subscription, OpenAI API, Claude Code local collector). One provider has many connections, each with its own status, capabilities, collector, and privacy notes. All UI is keyed by connection.

## Adapter / collector boundary

- `providers/registry.ts` — typed, compile-time registry of provider adapter metadata: identity, connections, capability declarations, configuration requirements (labels only), privacy notes, future actions. **No runtime plugin loading.**
- `collectors/contracts.ts` — `Collector`, `CollectorContext`, `CollectorResult`, and the observation types (`Usage`, `Cost`, `Quota`, `Health`), each carrying provenance.
- `collectors/registry.ts` — typed list of built-in collectors (currently only the demo collector).

## Observation flow (collect → UI)

1. `Collector.collect(ctx)` returns normalized observations (pure; no DB, no network for the demo collector).
2. `collector-service.runCollector()`:
   - validates each observation with Zod (`collectors/normalize.ts`); unknown token counts stay `null`, totals are derived only when truthful
   - de-duplicates via stable dedupe keys against the DB and within the batch (`collectors/dedupe.ts` — explicit because SQLite lacks `skipDuplicates`)
   - persists usage events, cost records, and health snapshots in one transaction
   - records a `CollectorRun` (written/skipped counts) and a safe `AuditEvent`
3. Analytics services (`analytics-service.ts`) aggregate persisted rows (pure aggregation lives in `domain/costs.ts`).
4. Server Components render the results; provenance badges travel with every value.

Quota observations are defined in the contracts but intentionally have no storage yet — no legitimate quota source exists in this milestone.

## Windows system collector (Phase 2)

`collectors/system/` implements the first real collector behind a strict platform boundary:

- **Host abstraction** (`SystemHost`): all OS access (os.cpus/totalmem/freemem, `fs.statfs`, the PowerShell probe) goes through one injectable interface; tests use fakes and never touch real hardware or PowerShell.
- **Measurements**: CPU % from two bounded `os.cpus()` time-delta samples (shared ~700 ms window, not a load average); memory from `os.totalmem/freemem`; disk from `fs.statfs` on the app's volume root (capacity API only — no file enumeration); network from one fixed, non-interactive `powershell.exe` invocation that samples cumulative per-interface byte counters twice and reports the measured interval.
- **Safe command boundary**: fixed script string, argument-array invocation (no shell concatenation, nothing user-controlled), `-NoProfile -NonInteractive`, 5 s process timeout, 1 MiB output cap, structured JSON parsed and validated with Zod, raw output discarded. Interface names are used transiently to pair samples and exclude loopback/tunnel pseudo-interfaces, then dropped — never persisted or displayed.
- **Errors and timeouts**: every failure maps to a fixed safe category (`unsupported-platform`, `timeout`, `command-unavailable`, `malformed-output`, `permission-denied`, `metric-unavailable`, `internal-error`) via `collectors/errors.ts`; the whole run has an 8 s hard bound. Only the category and a hand-written message reach CollectorRun, AuditEvent, or the UI.
- **Persistence**: the same pipeline as every collector — one HealthSnapshot (`subjectType: machine`, provenance `locally-observed`, metrics validated by `systemMetricsSchema`, unavailable metrics absent, never 0), a CollectorRun, and a safe AuditEvent. No schema migration was needed.
- **Duplicate protection**: an in-process `RunGate` (per-collector in-flight lock + 5 s cooldown) guards all collector runs — honest for a local single-process app; not a distributed lock.
- **Platform abstraction**: non-Windows platforms get a truthful `unsupported-platform` result and an explanatory UI state; macOS/Linux collectors can later implement the same `SystemHost` boundary separately.
- **Units**: bytes and bytes/second in storage; GiB (1024³) and Mbps (10⁶ bits/s) in the UI; snapshots older than 2 minutes are marked stale (`domain/freshness.ts`).

## Provenance model

Every usage, cost, and health value stores one of:
`live · locally-observed · manual · estimated · demo · stale · unavailable · unsupported`.
The UI renders the provenance next to the value; demo data is additionally labeled at page level.

## Capability model

Each connection declares per-capability truth (`usage`, `model-attribution`, `input-tokens`, `output-tokens`, `cost`, `quota`, `reset-time`, `health`, `actions`) with a state:
`available · unavailable · unsupported · manual · estimated · planned`.
Capabilities are persisted (seeded from the registry) so pages are data-driven, not hardcoded.

## Persistence

SQLite via Prisma 6, file `prisma/dev.db` (git-ignored). SQLite has no enums, so constrained strings are validated with Zod at every boundary. Migrations via `prisma migrate`; deterministic idempotent seed via `prisma db seed`.

## Security boundaries

- No secrets exist in the system; no env vars are required (the SQLite path is hardcoded in the schema).
- Server actions validate input with Zod; errors surface as friendly messages, never stack traces.
- Collectors are forbidden by contract from reading content payloads (prompts, code, file names) — only safe metadata.
- No external network calls anywhere, including tests.

## Future hosted mode (considered, not built)

The service layer takes no HTTP/UI dependencies, so it can later sit behind an API with auth. Multi-user would add a tenant column and move SQLite → Postgres via Prisma. Nothing in the current schema blocks that; nothing anticipates it prematurely.

## Intentionally deferred

- Real collectors and provider integrations (Phases 2–5)
- API-key entry/storage and its encryption story
- Quota snapshot storage
- Notifications and actions
- Retention enforcement job (setting exists; cleanup job arrives with real collectors)
- Money as integer minor-units (floats are fine for demo/estimates; revisit before real billing data)
