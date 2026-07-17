# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [0.1.0] — 2026-07-17

First public release: the local-first foundation plus the first real
data source.

### Added — real Windows system collector

- **Windows system collector** (`windows-system`): one-shot, unprivileged measurement of CPU utilization (sampled CPU-time deltas), memory, disk capacity of the app's volume (`fs.statfs`), and aggregate network throughput (fixed, validated PowerShell counter probe) — stored as `locally-observed` health snapshots with CollectorRun + audit trail
- System page: "Collect now" action, per-tile source labels (locally observed / stale / unavailable / unsupported / demo), 2-minute stale marking, collector status card, truthful unsupported state on non-Windows, and a separately labeled demo-snapshot section
- Safe collector error categories (timeout, command-unavailable, malformed-output, …) — raw command output and stack traces are never persisted or shown
- In-process duplicate-run gate for all collectors (in-flight lock + 5 s cooldown)
- Development-only screenshot-preview mode for the System page (`/system?preview=demo`): fixed synthetic fixtures, every tile labeled demo, ignored in production builds — used for repository screenshots so no real machine values are published

### Added — foundation

- Local-first Next.js application with SQLite persistence (Prisma 6) — no cloud, no telemetry, no external API calls
- Domain model: providers, connections, capabilities, usage events, cost records, health snapshots, collector runs, audit events, settings
- Data-provenance model (`live`, `locally-observed`, `manual`, `estimated`, `demo`, `stale`, `unavailable`, `unsupported`) attached to every usage, cost, and health value
- Truthful capability model per connection (`available`, `unavailable`, `unsupported`, `manual`, `estimated`, `planned`)
- Typed compile-time registries for provider adapters and collectors
- Deterministic demo collector proving the full pipeline: collect → validate → de-duplicate → persist → collector run + audit event → UI, with idempotent re-runs
- Deterministic, idempotent demo seed (30 days of clearly-labeled demo history)
- Pages: Overview dashboard, Providers, Connection detail, Activity (URL-parameter filters), Costs, System (demo snapshots), Settings — all database-backed
- Dark-first accessible UI with light theme, keyboard navigation, reduced-motion support, and demo-data labeling throughout
- Unknown token/cost values stored as `NULL` and rendered as "unknown" — never zero
- 16 focused unit tests (capabilities, provenance, normalization, idempotency, cost aggregation, unknown-value handling, settings validation)
- Project documentation: architecture, truthful data-source matrix, roadmap, decision log
- Open-source governance: Apache-2.0 license, contributing guide, code of conduct, security policy, support guide, issue/PR templates

### Fixed

- `package-lock.json` regenerated from a clean state so `npm ci` works on Linux CI as well as Windows (previously missing cross-platform optional dependency entries such as `@emnapi/*`)

### Changed

- `npm run validate` generates the Prisma client first, so it works directly after a fresh `npm ci`
- Pinned the package manager (`packageManager: npm@11`); Dependabot no longer auto-opens major-version npm upgrade PRs (majors are dedicated migration tasks pre-1.0)
- CI on GitHub Actions (Linux): lint, type-check, unit tests, and production build on every PR and push to `main`

### Security

- Local SQLite database, environment files, and local tooling settings are git-ignored
- No secrets are requested, stored, or transmitted anywhere in the application
- Windows collector never persists raw command output, adapter identifiers, usernames, hostname, or any machine-identifying value

### Known limitations

- All AI usage/cost values are labeled demo data; only Windows system metrics are real (`locally-observed`, manual one-shot collection)
- ChatGPT / Claude subscription usage and quotas are not collectable — no official API exists and scraping is permanently out of scope
- Real system collection is Windows-only; macOS/Linux see a truthful unsupported state
- Single display currency, single user, local machine only
