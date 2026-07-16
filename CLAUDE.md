@AGENTS.md

# CLAUDE.md — AI Control Center

Local-first Next.js (App Router) + TypeScript strict + Prisma 6/SQLite + Tailwind. Modular monolith. Owner is a non-programmer: give copy-paste commands, one per code block.

**The binding rules live in [PROJECT_RULES.md](PROJECT_RULES.md) — read it before changing code.** The notes below are session mechanics, not a substitute.

## Session rules
- Start with `git status --short --branch`; one task per session.
- Read only files relevant to the task; never read `node_modules`, `.next`, `dist`, `coverage`, lockfiles, or `prisma/dev.db`.
- Summarize changes; do not paste whole files into chat.
- **Never commit or push without explicit permission.** Never rewrite history or force-push.

## Non-negotiables (full versions in PROJECT_RULES.md)
- Dependency direction: UI → actions/services → data-access/contracts → domain; UI never imports Prisma.
- Truthful provenance + capabilities; unknown values stay `null`/"unknown", never 0.
- No secrets, no content payloads, no real provider calls in tests, no speculative dependencies.

## Commands
- Validate (targeted first): `npm test`, then `npm run validate` (lint + typecheck + tests + build).
- DB: `npx prisma migrate dev` (migrate + regenerate), `npm run db:seed` (idempotent).
- Update docs only when behavior or architecture actually changes.
