# Security Policy

AI Control Center is an early-stage, local-first application. It is **pre-1.0 and not production-hardened**.

## Supported versions

| Version | Supported |
| --- | --- |
| `main` (unreleased, pre-1.0) | ✅ security fixes land here |
| anything else | ❌ no backports before 1.0 |

Until 1.0, only the latest `main` receives fixes. There is no guaranteed response SLA — this is a community project.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via **GitHub's private vulnerability reporting**: on the repository page open the **Security** tab → **Report a vulnerability** (this creates a private security advisory visible only to the maintainer). If that is unavailable, contact the repository owner privately through their GitHub profile.

> A dedicated security email address is **not yet configured**. When one exists it will be listed here; until then, use the private GitHub mechanism above. Do not send reports to guessed addresses.

**Never include secrets in a report** — no API keys, tokens, cookies, passwords, or personal data. Redact real values; describe their shape instead.

### What makes a good report

- Affected file/component and commit
- Reproduction steps or proof-of-concept (with redacted data)
- Impact assessment: what an attacker gains

### Examples of reports we want

- Anything that causes the app to transmit local data off the machine
- SQL injection or unsafe query construction via filters/settings
- XSS through stored demo/manual data rendered in the UI
- Server actions accepting unvalidated input with side effects
- A dependency vulnerability that is actually reachable in this app
- Paths by which secrets or content payloads (prompts, file contents) could be persisted, contrary to the privacy rules

## Scope and threat model (current)

The app runs **entirely on the user's machine**: local Next.js server, local SQLite file, no authentication, no remote services, no telemetry, no secrets stored. The primary assets to protect are:

1. the locally stored metadata (usage/cost history),
2. the guarantee that nothing leaves the machine,
3. the guarantee that no content payloads (prompts, code, file names) are ever collected.

Out of scope today: multi-user isolation, network hardening of the dev server (it is intended for `localhost` use only — do not expose it to untrusted networks), and denial-of-service against a local process.

## Privacy principles

No external API calls, no telemetry, no credential storage, metadata-only collection, everything deletable by removing one local database file. Violations of these principles are treated as security bugs.
