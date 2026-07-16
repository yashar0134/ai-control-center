# Pull request

## Summary

<!-- What does this PR change, and why? Link the related issue: Fixes #NN -->

## Checklist

- [ ] **Focused scope** — one coherent change; no unrelated refactors or formatting churn
- [ ] **Tests** — added/updated for changed behavior (collectors: normalization, idempotency, unknown-value handling)
- [ ] **Lint** — `npm run lint` passes
- [ ] **Type-check** — `npm run typecheck` passes
- [ ] **Build** — `npm run build` passes
- [ ] **Documentation** — README / docs / `CHANGELOG.md` `[Unreleased]` updated where behavior or architecture changed
- [ ] **Migrations** — schema changes use a new Prisma migration; no applied migration was edited; seed stays idempotent
- [ ] **Accessibility** — keyboard operability, visible focus, labels, contrast in both themes, status not color-only
- [ ] **Privacy & truthfulness** — no content payloads collected; provenance shown; unknown stays unknown (never 0); no fabricated data
- [ ] **No secrets** — no keys, tokens, `.env` values, local databases, or personal paths in the diff
- [ ] **No real provider calls in tests** — demo collector or fixtures only
- [ ] **Screenshots** — attached for visual changes (dark and light theme)
- [ ] **Backwards compatibility** — existing local databases still work, or the migration path is documented
