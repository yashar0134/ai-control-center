# Support

AI Control Center is an **early-stage community project** maintained on a best-effort basis. There is **no guaranteed response time or SLA**.

## Where to get help

- **Questions and ideas:** use GitHub **Discussions** *if enabled on the repository* (it may not be yet — the maintainer decides this at release time). If Discussions is not available, open an issue with the question clearly marked.
- **Bugs:** open a GitHub **Issue** using the bug-report template. Include reproduction steps, OS, Node.js version, and sanitized logs.
- **Feature proposals:** open an issue using the feature-request template; for large features, discuss before building.
- **Security problems:** never a public issue — follow [SECURITY.md](SECURITY.md) for private reporting.

## Before filing a bug

1. Update to the latest `main` and run `npm install`.
2. Re-run setup if the database may be stale: `npx prisma migrate dev`.
3. Check [README troubleshooting](README.md#troubleshooting) and existing issues.

## Remember

Never paste API keys, tokens, personal file paths, or private data into issues or discussions.
