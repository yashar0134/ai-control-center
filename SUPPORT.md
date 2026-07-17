# Support

AI Control Center is an **early-stage community project** maintained on a best-effort basis. There is **no guaranteed response time or SLA**.

## Where to get help

- **Questions and ideas:** use GitHub **Discussions** *if enabled on the repository* (it may not be yet — the maintainer decides this at release time). If Discussions is not available, open an issue with the question clearly marked.
- **Bugs:** open a GitHub **Issue** using the bug-report template. Include reproduction steps, OS, Node.js version, and sanitized logs.
- **Feature proposals:** open an issue using the feature-request template; for large features, discuss before building.
- **Security problems:** never a public issue — follow [SECURITY.md](SECURITY.md) for private reporting.

## Before filing a bug

1. Update to the latest version: `npm run app:update` (or `npm install` + `npx prisma migrate dev` in development mode).
2. Check [README troubleshooting](README.md#troubleshooting) and existing issues.

## Common questions

| Problem | What to do |
| --- | --- |
| **Claude Code shows "not detected"** | Claude Code is not installed, or has never been used on this machine, so its local data folder does not exist yet. Install it, use it once, then click "Import Claude Code usage" again. |
| **Import finishes but no usage records appear** | Look at the import result: a high "skipped" count means everything was already imported (duplicate protection). "0 session files" means Claude Code has no local session data yet. |
| **Import reports an unsupported or malformed source** | Your Claude Code version may write a format this app does not understand yet. Nothing is broken and nothing unsafe was read — please open an issue with your Claude Code version (never attach session files). |
| **"The app is already running"** | Run `npm run app:status` to see it, and `npm run app:stop` to stop it before starting again. |
| **Port unavailable** | `app:start` automatically tries ports 3000–3009. If all are busy: `PORT=4000 npm run app:start`. |
| **Database backup / restore** | `npm run app:update` creates `prisma/backups/dev-backup-<timestamp>.db` automatically before migrating. Manual backup: stop the app, copy `prisma/dev.db` somewhere safe. Restore: stop the app, copy the backup file back over `prisma/dev.db`. |

## Remember

Never paste API keys, tokens, personal file paths, or private data into issues or discussions.
