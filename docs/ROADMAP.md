# Roadmap

Compact phases. Each phase ships independently; no phase starts before the previous one's exit criteria are met.

## Phase 1 — Foundation + demo vertical slice ✅ (current)
- **Entry:** empty repository, Node.js installed.
- **Exit:** all routes render from SQLite; provider/connection/capability/provenance models live; demo collector runs end-to-end with duplicate protection, collector runs, and audit events; settings persist; tests/lint/typecheck/build pass.

## Phase 2 — Real local Windows system collector ✅
- **Entry:** Phase 1 complete. ✅
- **Exit:** a collector reads unprivileged OS counters (CPU, memory, disk, network) on a manual trigger ✅; snapshots carry provenance `locally-observed` ✅; System page shows real + demo clearly distinguished ✅; collection respects the Settings toggle ✅; unit tests for the collector's normalization ✅. (Scheduled background sampling was intentionally not included — collection is manual per click.)

## Phase 3A — Claude Code local metadata collector + usable local installation ✅
- **Entry:** Phase 2 collector pattern proven. ✅
- **Exit:** local-file collector reads Claude Code usage metadata (timestamps, models, token counts only) ✅; events land as `locally-observed` ✅; explicit tests proving no content payloads are ever stored ✅; duplicate-safe incremental manual import ✅; beginner-friendly local production workflow (`setup:local`, `app:start/stop/status/update` with pre-migration DB backup) ✅. (Estimated API-equivalent cost was intentionally **not** implemented — no pricing could be verified as current; it remains a candidate for a later phase with a versioned, documented pricing table. Background/scheduled import is also deferred.)

## Phase 4 — Codex local metadata collector
- **Entry:** Phase 3 shipped; Codex local metadata format assessed.
- **Exit:** same guarantees as Phase 3 for Codex sessions, or a documented "unsupported" finding if no safe local metadata exists.

## Phase 5 — Official API billing & usage adapters
- **Entry:** a safe local secret-storage design is agreed (encryption, never committed, never in the browser).
- **Exit:** OpenAI and Anthropic admin-API collectors ship behind explicit opt-in; data carries provenance `live`; API keys entered via Settings, stored encrypted locally; no key ever leaves the machine or appears in logs.

## Phase 6 — GitHub & deployment monitoring
- **Entry:** Phase 5 secret handling reused.
- **Exit:** read-only GitHub repo/PR status and deployment targets (Coolify, VPS, Supabase) as health snapshots with truthful capabilities.

## Phase 7 — Notifications & approved actions
- **Entry:** stable collectors from Phases 2–6.
- **Exit:** local notification rules (thresholds) and the first explicitly-approved actions, each audited.

## Phase 8 — Optional hosted / multi-user mode
- **Entry:** demonstrated need; Phases 1–7 stable.
- **Exit:** services behind authenticated API, Postgres migration, per-tenant isolation — without breaking local-first single-user mode.
