---
name: cache
description: Cache Notion pages and rebuild the QMD search index.
---

# conversation-distill Cache

Cache Notion pages to local markdown and rebuild the QMD search index. Run after
setup and whenever you want fresh Notion content or updated search results.

## Step 1 — Preflight

1. Verify `config.json` exists. If not, print:
   "Error: config.json not found. Run `/conversation-distill:setup` first." and exit.

2. Check QMD availability — try `mcp__qmd__qmd_status` first, then `which qmd` via Bash.
   QMD is **required**. If not found, print:
   "Error: QMD is required but not found. Install it with `npm install -g @tobilu/qmd`." and exit.

3. Check `NOTION_TOKEN` — look for a `.env` file at the repo root (look for a
   `NOTION_TOKEN=...` line), then fall back to `echo $NOTION_TOKEN` in the shell.
   If not found, Notion caching will be skipped (not an error).

Print status:

```
Preflight:
  config.json: found
  QMD:         [available] (CLI)
  NOTION_TOKEN: [available] / [not found — skipping Notion cache]
```

## Step 2 — Cache Notion Pages (if NOTION_TOKEN available)

Skip if `NOTION_TOKEN` is not available.

**Warn the user before starting:** "Caching Notion pages — this can take a few minutes
(~4 min per 100 pages). Progress is logged per page."

Run the cache-notion.js script via Bash:

```bash
node <plugin-dir>/scripts/cache-notion.js \
  --config config.json --output .distill
```

The script auto-loads `NOTION_TOKEN` from `.env` at the project root. It does a full
recache — cleans `.distill/authored-docs/notion/` and re-fetches all accessible pages.
Stats are printed to stderr.

## Step 3 — Index with QMD

Collection names are **global** in QMD (stored in `~/.cache/qmd/index.sqlite`), so prefix
them with the repo directory name to avoid collisions. Derive the prefix from
`basename $(pwd)` (e.g., for a repo at `/home/user/team-knowledge`, use
`team-knowledge-captured` and `team-knowledge-authored`).

Add collections if they don't already exist (idempotent), then update and embed.

```bash
cd <repo-root>
PREFIX=$(basename "$(pwd)")
qmd collection add . --name "${PREFIX}-captured"
qmd collection add .distill/authored-docs --name "${PREFIX}-authored"
qmd update
qmd embed
```

Use `mcp__qmd__*` tools if available, otherwise use CLI via Bash.
If `qmd collection add` reports the collection already exists, that's fine — continue.

## Step 4 — Summary

Print a summary:

```
Cache complete!

Notion pages cached: 42 (or "skipped — no NOTION_TOKEN")
QMD collections: <prefix>-captured, <prefix>-authored (updated)
```
