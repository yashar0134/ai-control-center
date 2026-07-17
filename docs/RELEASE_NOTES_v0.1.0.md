# AI Control Center v0.1.0 — release notes (draft)

> Draft for the future GitHub Release body. **No release or tag has been
> published yet**; the date will be set when the release is created.

## Summary

AI Control Center is a **local-first, open-source control center** for
monitoring AI subscriptions, API usage, costs, and machine health — built on a
strict rule: **nothing is ever presented as real unless it truly is**. Every
value carries a provenance label, unknown values stay "unknown", and no data
leaves your machine.

v0.1.0 is an **early-stage foundation release** (pre-production). It ships the
complete architecture — providers, connections, capabilities, collectors,
provenance, audit trail — plus the first real data source: a privacy-preserving
Windows system collector.

## Highlights

- **Real Windows system metrics on demand** — click "Collect now" for a one-shot, unprivileged measurement of CPU utilization, memory, disk capacity of the app's volume, and aggregate network throughput, labeled `locally-observed` with capture time, run duration, and 2-minute stale marking. No admin rights. Nothing identifying is read or stored.
- **Truthful provider model** — six connections (ChatGPT subscription, Claude subscription, Claude Code, OpenAI API, Anthropic API, Gemini API) shown in honest states with per-capability truth (`planned`, `manual`, `unavailable`, `unsupported`). Subscription quotas are marked *unsupported* because no official API exists — this project never scrapes accounts.
- **Demo collector vertical slice** — a deterministic, idempotent demo pipeline (collect → validate → de-duplicate → persist → audit → UI) that powers the dashboard with clearly-labeled demo AI data until real integrations arrive.
- **Local settings** — currency, week start, collection on/off, retention, anonymized-metadata preference, dark/light theme — all in one local SQLite file.
- **Open-source governance** — Apache-2.0, contributing guide, code of conduct, security policy, CI on every PR.

## Installation

Requires [Node.js](https://nodejs.org) 20+ and Git. Then:

```
git clone https://github.com/yashar0134/ai-control-center.git
cd ai-control-center
npm install
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000. Full beginner-friendly steps and troubleshooting: [README](../README.md).

## Privacy model

- Runs entirely on your machine; one SQLite file holds everything and deleting it removes all data
- No telemetry, no cloud, no accounts, no API keys in this version
- Collectors read **safe aggregate metadata only** — never file contents, file names, processes, prompts, responses, adapter identifiers, usernames, hostname, or any machine-identifying value
- Raw command output is validated and discarded, never stored
- Official interfaces only — scraping and session reuse are permanently out of scope

## Implemented data sources

| Source | Status |
| --- | --- |
| Windows system metrics (CPU, memory, disk, network) | ✅ real, `locally-observed`, manual one-shot, Windows only |
| Demo AI collector (deterministic, labeled) | ✅ demo data only |
| Manual subscription cost tracking | 🟡 schema ready, demo placeholders |
| Claude Code / Codex local metadata, official API billing, GitHub/deployments | 🔜 planned ([roadmap](ROADMAP.md)) |
| ChatGPT / Claude subscription quotas | ❌ not possible via any official API |

## Known limitations

- All AI usage and cost values are **demo data** in this release
- Real system collection is **Windows-only** and manual (no background monitoring)
- Network throughput may show *Unavailable* if the PowerShell counter probe fails — CPU/memory/disk still work
- Single user, single display currency, local machine only — do not expose the dev server to untrusted networks

## Upgrade notes

First release — nothing to upgrade from. The SQLite schema is managed by Prisma migrations; future releases will migrate existing local databases automatically via `npx prisma migrate dev`.

## Validation

Lint, strict type-check, 44 unit tests (collector math, idempotency, provenance, unknown-value handling, error mapping), and a production build run on every commit via GitHub Actions on Linux; the release candidate was additionally verified with a clean-clone install on Windows.

## Feedback and contributing

- Bugs and ideas: GitHub Issues (templates provided)
- Security reports: privately, per [SECURITY.md](../SECURITY.md) — never a public issue
- Contributions: read [CONTRIBUTING.md](../CONTRIBUTING.md) and [PROJECT_RULES.md](../PROJECT_RULES.md) first; open an issue before large changes
