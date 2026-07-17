# Public release checklist — v0.1.0

**Status: v0.1.0 is released.** Every item below was completed and verified
(in-repo, or through the GitHub API/UI). This file is kept as a historical
record and as a template for future releases.

## Completed and verified

- [x] **Security audit** — tracked sources, configs, docs, and screenshots audited for secrets, tokens, personal data, absolute paths, identifiers, and raw command output. Local DB, `.env*`, and `.claude/` confirmed ignored.
- [x] **License** — Apache-2.0 (`LICENSE`) + `NOTICE` (© 2026 Yashar Ahmadabadi)
- [x] **Governance docs** — `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `CONTRIBUTING.md`, `PROJECT_RULES.md`, `CHANGELOG.md`
- [x] **Issue/PR templates, Dependabot, CI** — CI green on `main`; Dependabot restricted to minor/patch
- [x] **Package metadata** — version `0.1.0`, Apache-2.0, repository/bugs/homepage, `engines`, `packageManager`, `validate` script
- [x] **README** — public-ready with real screenshots, truthful CI + license badges, implemented-vs-planned sources, privacy summary
- [x] **Real privacy-safe screenshots** — Overview, Providers, System (screenshot-preview mode with synthetic fixtures) under `docs/screenshots/`
- [x] **Clean-install verification** — fresh clone → `npm ci` → migrate + seed → `npm run validate`, all green
- [x] **Repository description, topics, default branch** — set and verified via API
- [x] **Release-preparation PR merged** — PR #9 merged to `main` with green CI
- [x] **Repository visibility: Public** — verified via API (`private: false`)
- [x] **Tag `v0.1.0` created** — exists on `main`
- [x] **GitHub Release v0.1.0 published** — published 2026-07-17, marked **Latest**, body from `docs/RELEASE_NOTES_v0.1.0.md`
- [x] **Changelog release date** — `CHANGELOG.md` `[0.1.0] — 2026-07-17`
- [x] **Branch ruleset active on `main`** — "Protect main", enforcement `active` (verified via rulesets API): pull request required, required status check `validate`, force pushes and branch deletion blocked
- [x] **Merge methods** — merge commits disabled; squash and rebase merging enabled (verified via API)
- [x] **Private vulnerability reporting enabled** — verified via API (`enabled: true`); `SECURITY.md` links to it
- [x] **Security features** — Secret Protection and dependency security features (Dependabot alerts/updates) enabled

## For future releases

Use this file as a template: update the version, re-run the security audit and
clean-install verification, draft release notes in `docs/`, set the changelog
date when publishing, and verify repository settings via the GitHub API rather
than assuming them.
