# Data sources — truthful availability matrix

This matrix states what each planned source can and cannot provide. **Nothing below claims unsupported access.** Statuses: `demo` (labeled synthetic data today), `manual`, `planned`, `not implemented`.

| Source | Collection method | Expected data | Unavailable data | Privacy risk | Status |
| --- | --- | --- | --- | --- | --- |
| ChatGPT subscription | Manual entry only | Monthly fee you type in | Usage, message quotas, reset times — **no official API exists**; scraping is out of scope permanently | None (one number) | manual (demo fee seeded) |
| Claude subscription | Manual entry only | Monthly fee you type in | Usage, session limits, reset times — **no official API exists** | None (one number) | manual (demo fee seeded) |
| Claude Code local metadata | Local file collector reading Claude Code's local usage metadata | Session timestamps, model names, token counts, estimated cost | Plan quota/reset (not exposed in a supported machine-readable way) | Low — must never read prompts, file contents, file names, or repo content | planned (demo data today) |
| OpenAI API | Official OpenAI usage & costs endpoints (admin key) | Aggregate usage per model, token counts, billed costs | Per-request content (never wanted); consumer ChatGPT data | Medium — requires an API key stored locally | planned (demo data today) |
| Anthropic API | Official Anthropic Admin Usage & Cost APIs (admin key) | Aggregate usage per model, token counts, costs | Consumer claude.ai data | Medium — requires an API key stored locally | planned (demo data today) |
| Gemini API | Google Cloud monitoring/billing APIs (service credentials) | Aggregate usage, quotas, billed costs | Consumer Gemini-app data | Medium — cloud credentials stored locally | not implemented |
| Manual subscriptions (any provider) | Manual entry form | Name, fee, billing period | Anything not typed in | None | planned (schema supports it) |
| Local system collector | Unprivileged Node APIs (`os`, `fs.statfs`) + one fixed non-interactive PowerShell counter probe | CPU % + core count, memory used/free/total, disk capacity of the app's volume, aggregate network throughput, collection time/duration | Per-process data, file activity, window titles, adapter/machine identifiers (never wanted); per-disk breakdown; scheduled background sampling | Low — aggregate numeric totals only; interface names filtered in memory and discarded; raw command output never persisted; no admin rights | ✅ implemented (Windows, manual "Collect now"); other platforms truthfully unsupported |

## Ground rules for every future source

1. Official, documented interfaces only — never cookies, browser sessions, private endpoints, or scraping.
2. Metadata only — never prompts, completions, source code, file names, or message bodies.
3. Everything collected carries provenance and is visible to the user.
4. Each collector declares its privacy notes in the registry, shown on the connection page.
