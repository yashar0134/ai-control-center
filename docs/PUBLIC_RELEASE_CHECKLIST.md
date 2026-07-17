# Public release checklist — v0.1.0

Status legend: checked = verified complete (in-repo, or confirmed through the
GitHub API). Unchecked = requires an action or decision by the repository
owner, with exact instructions. **The repository must stay private until every
critical unchecked item below is done.**

## Completed and verified

- [x] **Security audit** — tracked sources, configs, docs, and screenshots audited for secrets, tokens, personal data, absolute paths, identifiers, and raw command output (see PR "Prepare public v0.1.0 release candidate"). Local DB, `.env*`, and `.claude/` confirmed ignored.
- [x] **License** — Apache-2.0 (`LICENSE`) + `NOTICE` (© 2026 Yashar Ahmadabadi)
- [x] **Governance docs** — `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `CONTRIBUTING.md`, `PROJECT_RULES.md`, `CHANGELOG.md`
- [x] **Issue/PR templates, Dependabot, CI** — CI green on `main` (verified); Dependabot restricted to minor/patch
- [x] **Package metadata** — version `0.1.0`, Apache-2.0, repository/bugs/homepage, `engines`, `packageManager`, `validate` script
- [x] **README** — public-ready with real screenshots, truthful CI + license badges, implemented-vs-planned sources, privacy summary
- [x] **Real privacy-safe screenshots** — Overview, Providers, System (screenshot-preview mode with synthetic fixtures) under `docs/screenshots/`
- [x] **v0.1.0 changelog + draft release notes** — `CHANGELOG.md` `[0.1.0] — TBD`, `docs/RELEASE_NOTES_v0.1.0.md` (draft, unpublished)
- [x] **First commit + push** — history exists on `main`; Phase 1 foundation and Phase 2 Windows collector merged
- [x] **Repository description** — set (verified via GitHub API)
- [x] **Repository topics** — set: ai, dashboard, local-first, monitoring, nextjs, privacy, typescript, windows, … (verified via API)
- [x] **Default branch** — `main` (verified via API)
- [x] **Clean-install verification** — fresh clone → `npm ci` → migrate + seed → `npm run validate`, all green (see PR)

## Requires Yashar (GitHub UI) — in this order, before going public

- [ ] **Merge the release-preparation PR** after reviewing its screenshots and checks.
- [ ] **GitHub Discussions decision** — currently **disabled** (verified). To enable: repo → Settings → General → Features → check "Discussions". `SUPPORT.md` already covers both cases.
- [ ] **Change visibility to Public** — repo → Settings → General → Danger Zone → "Change repository visibility" → Public. Type the repository name to confirm. *(Do this only after the PR above is merged.)*
- [ ] **Enable private vulnerability reporting** *(only possible once public)* — repo → Settings → Advanced Security → enable "Private vulnerability reporting". Verified currently unavailable; `SECURITY.md` links depend on it.
- [ ] **Branch protection / ruleset** *(only possible once public on the current plan — verified: the rulesets API returns "Upgrade to GitHub Pro or make this repository public")* — repo → Settings → Rules → Rulesets → New branch ruleset: target `main`, require a pull request and the "CI / validate" status check.
- [ ] **Create the v0.1.0 release** — repo → Releases → "Draft a new release" → tag `v0.1.0` (create on publish), title "v0.1.0", paste the body from `docs/RELEASE_NOTES_v0.1.0.md`, publish. Then replace `TBD` in `CHANGELOG.md` with the release date.

## Explicitly NOT done in the release-preparation task

Visibility was not changed (repository is still **private**, verified), no tag
was created, and no GitHub Release was published — these are Yashar's manual
steps above.
