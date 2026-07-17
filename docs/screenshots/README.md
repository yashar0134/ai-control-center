# Screenshots

Public screenshots referenced by the main README. All were captured from the
seeded demo database at 1280×800 (headless browser, no window chrome, dark
theme) and contain **no real machine information**.

## Current set

| File | Page | Data shown |
| --- | --- | --- |
| `overview-dark.png` | `/` Overview | Seeded demo AI data, demo badges visible |
| `providers-dark.png` | `/providers` | Truthful connection states (demo / manual / not connected) |
| `system-demo-dark.png` | `/system?preview=demo` | **Screenshot-preview mode** — synthetic fixtures, every tile labeled demo |

A mobile-navigation screenshot is intentionally not included yet: capturing the
open menu requires an interactive session, and a closed-menu mobile shot adds
little value. It can be added later following the rules below.

## Screenshot-preview mode (System page)

The System page shows the contributor's real machine values after a collection,
which must never be published. `/system?preview=demo` renders the page from
fixed synthetic fixtures instead
([`src/server/collectors/system/screenshot-fixtures.ts`](../../src/server/collectors/system/screenshot-fixtures.ts)):

- **development builds only** — production ignores the parameter entirely
- values are hardcoded constants; the parameter accepts no data
- a banner and per-tile "demo" badges make the synthetic origin unmistakable
- nothing is measured and nothing is written to the database

## Capture requirements (privacy-safe)

1. Use **only the seeded demo database** for Overview/Providers, and **only preview mode** for System — never a database containing real usage or real machine snapshots.
2. Capture the page content only — no desktop, taskbar, bookmarks, tabs, OS user name, extensions, or dev overlays (`devIndicators` is disabled in `next.config.ts`).
3. Standard viewport: 1280×800 desktop (375×812 for future mobile shots), PNG, dark theme.
4. Recheck every image before committing: no real file paths, account names, emails, IPs, or hostnames may appear.
5. Keep files reasonably small (< 500 KB) and update the README alt text if content changes meaningfully.

Example capture command (system Chrome, no extra dependencies):

```
chrome --headless=new --hide-scrollbars --window-size=1280,800 --virtual-time-budget=12000 --screenshot=docs/screenshots/overview-dark.png http://localhost:3000/
```
