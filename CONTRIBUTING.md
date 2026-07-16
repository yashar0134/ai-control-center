# Contributing to AI Control Center

Thanks for helping build a truthful, local-first AI monitoring tool. This guide keeps contributions safe and easy to review. The durable rules live in [PROJECT_RULES.md](PROJECT_RULES.md); this file is the practical workflow.

## Prerequisites

- Node.js 20 or newer, npm 10 or newer
- Git

## Local setup

```
git clone https://github.com/yashar0134/ai-control-center.git
cd ai-control-center
npm install
npx prisma migrate dev
npm run dev
```

`prisma migrate dev` creates the local SQLite file (`prisma/dev.db`, git-ignored) and seeds labeled demo data. The app runs at http://localhost:3000.

## Workflow

- **Open an issue first** for anything larger than a small fix — new collectors, schema changes, new pages, dependency additions. Agree on the approach before writing code.
- **Branch naming:** `feature/<short-topic>`, `fix/<short-topic>`, or `docs/<short-topic>`.
- **Keep PRs focused:** one change per PR. Refactors, features, and formatting churn belong in separate PRs.
- **Validation is required before every PR:**

```
npm run validate
```

This runs lint, type-check, unit tests, and the production build. All four must pass.

## Architecture boundaries (enforced in review)

- Dependency direction: `UI → server actions/services → data access & contracts → domain`. UI components never import Prisma or contain business logic.
- Providers and connections are distinct concepts; capabilities and provenance are persisted data, not UI copy.
- Collectors only return observations. Validation (Zod), de-duplication, persistence, `CollectorRun`, and `AuditEvent` recording happen in the collector service.
- Pure logic (aggregation, normalization, dedupe) stays dependency-free in `src/server/domain` and `src/server/collectors` so it is unit-testable.
- Database changes go through Prisma migrations — never edit applied migrations; add a new one.

## Truthfulness rules (non-negotiable)

- Never present fabricated values as real. Every usage, cost, quota, or health value carries a provenance (`demo`, `manual`, `estimated`, `live`, …) and the UI must show it.
- Unknown values stay `null` and render as "unknown" — never 0.
- Never claim a capability a source does not have. ChatGPT and Claude subscriptions expose no usage/quota API; they stay `unsupported`.
- No scraping, no cookie/session reuse, no undocumented endpoints — official interfaces only.

## Privacy and security rules

- Never commit secrets, API keys, tokens, `.env` files, or local databases (`prisma/dev.db` is git-ignored — keep it that way).
- Never collect or store prompts, completions, source code, file names, or message bodies — safe metadata only (timestamps, model names, token counts, aggregate costs).
- No telemetry, no analytics, no network calls the user did not explicitly configure.
- **Tests must never call real provider APIs.** Use the deterministic demo collector or fixtures.

## Adding a provider or collector

1. Open an issue describing the source, the official interface used, exactly what metadata is collected, and what is *not* available.
2. Declare the connection in `src/server/providers/registry.ts` with truthful capability states and privacy notes.
3. Implement the collector against the `Collector` contract (`src/server/collectors/contracts.ts`): pure `collect()`, stable dedupe keys, provenance on every observation.
4. Register it in `src/server/collectors/registry.ts` (compile-time registry — no dynamic loading).
5. Add unit tests: normalization, dedupe/idempotency, unknown-value handling, and proof that no content payloads are stored.
6. Update `docs/DATA-SOURCES.md` with the truthful availability matrix row.

## Documentation expectations

Update docs in the same PR when behavior or architecture changes: `README.md` for user-facing behavior, `docs/ARCHITECTURE.md` for structure, `docs/DECISIONS.md` for significant decisions, `CHANGELOG.md` under `[Unreleased]`.

## Accessibility expectations

Pages must keep: semantic landmarks and heading order, keyboard operability with visible focus, labeled controls, table captions/scope, text alternatives for charts, adequate contrast in **both** themes, status conveyed by text — not color alone, and `prefers-reduced-motion` respected. Include screenshots (light + dark) for visual changes.

## Code style

TypeScript strict, ESLint clean, Server Components by default (Client Components only for real interactivity), native `Intl` formatting, design tokens from `globals.css` — no ad-hoc hex values.
