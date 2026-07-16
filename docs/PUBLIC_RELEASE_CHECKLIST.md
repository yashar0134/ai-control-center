# Public release checklist — v0.1.0

Status legend: checked = verified complete in this repository. Unchecked = requires an action by the repository owner (instructions included). **The repository is not public yet and must not be made public until the unchecked critical items are done.**

## Completed in the repository

- [x] **Security audit** — tracked/untracked sources, configs, and docs scanned for secrets, keys, tokens, personal emails, usernames, absolute paths, telemetry, and network calls. Findings fixed: unused scaffold assets removed; local AI-tooling settings (`.claude/`) added to `.gitignore`. Local SQLite files were already ignored and remain untracked.
- [x] **License** — Apache-2.0 (`LICENSE`) + `NOTICE` (© 2026 Yashar Ahmadabadi)
- [x] **Governance docs** — `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`, `SUPPORT.md`, `CHANGELOG.md`, `PROJECT_RULES.md`
- [x] **Contributor docs** — `CONTRIBUTING.md` with setup, boundaries, truthfulness/privacy rules, collector how-to
- [x] **Issue templates** — bug report + feature request (YAML forms) + config with private security-report link
- [x] **PR template** — scope/tests/validation/privacy/accessibility checklist
- [x] **Dependabot** — weekly, grouped minor/patch, low PR limit
- [x] **CI workflow** — `.github/workflows/ci.yml` (lint, typecheck, tests, build on a fresh SQLite DB; no secrets). Note: it can only actually execute after the first push.
- [x] **Package metadata** — name, version `0.1.0`, description, license, repository/bugs/homepage, `engines`, `validate` script; `private: true` kept deliberately (this is an application, not an npm library — prevents accidental `npm publish`)
- [x] **README** — public-audience rewrite with truthful demo-data and no-quota-API statements, platform-neutral quick start, relative doc links
- [x] **Clean install verified** — full copy to a temp dir: `npm ci` → `prisma migrate dev` (fresh DB + seed, 664 demo observations) → `npm run validate` (lint, typecheck, 16/16 tests, production build) — all passed; temp dir removed
- [x] **Validations pass in the working repository** (see CHANGELOG / CI-mirror commands)

## Requires Yashar (GitHub UI or a decision) — do these before going public

- [ ] **Real screenshots** — capture the set in `docs/screenshots/README.md` from a fresh demo database, then embed in README. *(Nice-to-have; not a safety blocker.)*
- [ ] **First commit** — review the working tree, then commit everything (nothing has been committed yet).
- [ ] **Push to GitHub** — `git push -u origin main` after the commit.
- [ ] **Repository description** — on GitHub: repo page → ⚙️ next to About → e.g. "Local-first control center for AI subscriptions, API usage, and costs — truthful provenance, no telemetry. Early stage."
- [ ] **Repository topics** — same About dialog → add e.g. `ai`, `dashboard`, `local-first`, `nextjs`, `typescript`, `sqlite`, `open-source`.
- [ ] **GitHub Discussions decision** — Settings → General → Features → enable Discussions (recommended) or leave off; update `SUPPORT.md` if enabled.
- [ ] **Default branch** — confirm it is `main` (Settings → General).
- [ ] **Branch protection** — Settings → Branches → add rule for `main`: require pull request + require the CI status check to pass (available after the first CI run).
- [ ] **Private vulnerability reporting** — Settings → Security → enable "Private vulnerability reporting" so the links in `SECURITY.md` and the issue-template config work.
- [ ] **Verify CI passes** on the first push (Actions tab) before inviting users.
- [ ] **Public visibility** — only after every item above: Settings → General → Danger Zone → Change visibility → Public.
- [ ] **`v0.1.0` release decision** — after going public and CI is green: create tag `v0.1.0` + GitHub Release using the `[Unreleased]` notes from `CHANGELOG.md` (and move them under a `0.1.0` heading).

## Not ready yet

The repository content is safe and validated, but **public release is blocked** on the manual items above — most importantly: first commit, push, CI verification, private-vulnerability-reporting toggle, and the visibility decision itself.
