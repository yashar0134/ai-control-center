# PROJECT_RULES.md — the durable constitution

Compact, operational rules for every contributor and every AI coding session. If a change conflicts with these rules, the change is wrong.

## Product principles

1. **Truth over appearance.** Never present fabricated or inferred values as real. Every usage, cost, quota, and health value carries provenance, visibly.
2. **Local-first.** The app must remain fully usable offline on one machine. Hosted mode may be added later; it must never become required.
3. **Privacy by default.** Metadata only — never prompts, completions, source code, file names, or message bodies. No telemetry. No network calls the user didn't explicitly configure.
4. **Official interfaces only.** No scraping, cookie reuse, session hijacking, or undocumented endpoints — even if convenient.

## Architecture

5. Modular monolith. No microservices, queues, or runtime plugin loaders.
6. Dependency direction: `UI → server actions / services → data access & contracts → domain`. UI never imports Prisma or owns business logic. Domain modules stay pure and dependency-free.
7. **Provider ≠ connection.** A provider (company) has many connections (products). All data and UI key on connections.
8. Collectors only produce observations. The collector service validates (Zod), de-duplicates (stable `dedupeKey`), persists transactionally, and records a `CollectorRun` + `AuditEvent`. No collector touches the database or network directly (except its own official source).
9. Capabilities are persisted per connection with truthful states: `available | unavailable | unsupported | manual | estimated | planned`.

## Data

10. Provenance is required on every usage, cost, quota, and health value: `live | locally-observed | manual | estimated | demo | stale | unavailable | unsupported`.
11. **Unknown stays unknown.** Missing values are `NULL` in the database and "unknown" in the UI — never 0, never a guess.
12. Schema changes only via new Prisma migrations. Never edit or delete an applied migration. Seeds must stay deterministic and idempotent.
13. Never store secrets, tokens, cookies, or content payloads in any table, log, or audit event.

## Security

14. No secrets in the repository — no keys, `.env` values, tokens, or local databases (`prisma/dev.db` stays git-ignored).
15. Server actions validate all input with Zod; errors surface as friendly messages, never stack traces or internals.
16. Tests never call real provider APIs.

## UI / UX

17. Dark-first, restrained, information-dense developer aesthetic. Design tokens from `globals.css` only — no ad-hoc hex values in components.
18. Server Components by default; Client Components only for genuine interactivity. Native `Intl` for dates, numbers, currency.
19. Demo data is always visibly labeled. Status is conveyed with text, not color alone.
20. Accessibility floor: semantic landmarks, correct heading order, keyboard operability, visible focus, labeled controls, table semantics, chart text alternatives, adequate contrast in both themes, `prefers-reduced-motion` respected.
21. Performance discipline: no new heavyweight dependencies without an issue discussing them; charts and tables must stay responsive at realistic data volumes.

## Testing

22. Every collector needs unit tests for: normalization, idempotency/dedupe, unknown-value handling, and no-content-payload proof. Pure domain logic (aggregation, validation) stays test-covered. No coverage theater — test behavior that matters.

## Git & PRs

23. Never commit secrets or generated/local files. Never rewrite published history or force-push shared branches.
24. Branches: `feature/*`, `fix/*`, `docs/*`. One focused change per PR. Issue-first for large changes.
25. `npm run validate` (lint + typecheck + tests + build) must pass before review.

## Dependencies

- Never run forced audit fixes (`npm audit fix --force`) or blanket forced updates.
- Major dependency upgrades are dedicated, tested migration tasks — never drive-by bumps or auto-merged bot PRs.
- `package-lock.json` must pass a clean `npm ci` on CI (Linux) and locally; regenerate it from a clean state if platform-specific optional entries go missing.
- Dependency PRs must pass full validation before merge.

## Documentation

26. Docs change in the same PR as the behavior: `README.md` (user-facing), `docs/ARCHITECTURE.md` (structure), `docs/DATA-SOURCES.md` (source truth matrix), `docs/DECISIONS.md` (significant decisions), `CHANGELOG.md` (`[Unreleased]`).

## Definition of done

27. A change is done when: validation passes, boundaries and provenance rules hold, unknown values stay unknown, docs and changelog are updated, accessibility is preserved, and no secret or private data was introduced.

## Forbidden shortcuts

28. No hardcoded provider data in pages. No `any`-typed escape hatches around domain contracts. No silent catch-and-continue around persistence. No converting unknown to zero "for nicer charts". No disabling lint/type rules to ship. Temporary debt requires a `TODO(issue-link)` and an open issue.
