# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `package-lock.json` regenerated from a clean state so `npm ci` works on Linux CI as well as Windows (previously missing cross-platform optional dependency entries such as `@emnapi/*`)

### Changed

- `npm run validate` now generates the Prisma client first, so it works directly after a fresh `npm ci`
- Pinned the package manager (`packageManager: npm@11`) and stopped Dependabot from auto-opening major-version npm upgrade PRs (majors are dedicated migration tasks pre-1.0)

Initial foundation, prepared as the upcoming `0.1.0` first release (not yet published).

### Added

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

### Security

- Local SQLite database, environment files, and local tooling settings are git-ignored
- No secrets are requested, stored, or transmitted anywhere in the application
