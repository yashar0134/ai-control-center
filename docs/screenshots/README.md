# Screenshots

This directory holds the public screenshots referenced by the main README. **No screenshots have been captured yet** — the placeholders below define what to add before (or shortly after) the first public release.

## Screenshots to capture

| File name | Page | Notes |
| --- | --- | --- |
| `overview-dark.png` | `/` Overview | Default dark theme, seeded demo data visible with demo badges |
| `providers-dark.png` | `/providers` | Show the different truthful connection states |
| `connection-detail-dark.png` | `/providers/claude-code` | Capabilities + collector card |
| `activity-dark.png` | `/activity` | With a filter applied (visible in the URL) |
| `costs-dark.png` | `/costs` | Totals, trend chart, provider breakdown |
| `system-dark.png` | `/system` | Demo machine tiles with demo badges visible |
| `settings-light.png` | `/settings` | Light theme, to show theme support |
| `mobile-nav.png` | any page ≤ 768px wide | Open mobile navigation menu |

## Capture requirements (privacy-safe)

1. Use **only the seeded demo database** (`npx prisma migrate dev` on a fresh `prisma/dev.db`) — never a database containing real personal usage or costs.
2. Capture the browser content area only — no desktop, taskbar, bookmarks, other tabs, or OS user name.
3. Verify no personal information is visible: no real file paths, account names, or emails (the demo data contains none by design).
4. Use a standard window width (~1280 px desktop, ~375 px mobile) and PNG format.
5. Keep file sizes reasonable (< 500 KB each; compress if needed).

## After adding files

Update the Screenshots section in the main [README.md](../../README.md) to embed them with descriptive alt text, e.g.:

```markdown
![Overview dashboard showing demo cost and usage metrics](docs/screenshots/overview-dark.png)
```
