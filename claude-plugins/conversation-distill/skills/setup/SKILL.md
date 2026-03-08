---
name: setup
description: Set up a knowledge repo. Interactive and re-runnable.
argument-hint: "[knowledge-repo-path]"
---

# conversation-distill Setup

Initialize a knowledge repo for conversation-distill.
$ARGUMENTS is an optional path to the knowledge repo. Default: current directory.

## Re-runnability

This skill is safe to re-run. It checks for existing files and state before each
step: existing config is shown with current values as defaults, state.json is never
overwritten, and permissions are merged (not replaced). Only missing items are created.

## Step 1 — Detect Available Services

First, verify the target directory is a git repo (`git rev-parse --git-dir`).
If not, print an error asking the user to `git init` first, and exit.

Detect which services are available.

**MCP servers** (attempt lightweight calls):

- **GitHub**: try `mcp__github__*` tools.
- **Discord**: try `mcp__discord__*` or `mcp__mcp-server__*` tools.
- **QMD**: try `mcp__qmd__qmd_status`. If unavailable, try `which qmd` via Bash.
  **QMD** ([github.com/tobi/qmd](https://github.com/tobi/qmd)) is a free, open-source local search tool (MIT license, BM25 + vector + LLM re-ranking) used for deduplication and conflict detection. It indexes your captured knowledge and authored docs so the daily run can find existing content before writing new files. Install with `npm install -g @tobilu/qmd`.

**Notion** (uses script, not MCP):
Check if `NOTION_TOKEN` is available — first check for a `.env` file at the repo root
(look for a `NOTION_TOKEN=...` line), then fall back to `echo $NOTION_TOKEN` in the shell.
Notion pages are cached by `scripts/cache-notion.js` using the Notion API directly.
The script auto-loads `.env` from the project root, so no shell env setup is needed.

If `NOTION_TOKEN` is not found but the user wants Notion, print:

```
NOTION_TOKEN not found. To set it up:
1. Create an integration at https://www.notion.so/my-integrations
2. Add NOTION_TOKEN to .env at the repo root:
   NOTION_TOKEN=ntn_your_token_here
3. Re-run /conversation-distill:setup
```

Record which servers are available and their working tool prefixes.

Print a status table:

```
Service Status:
  Notion:  [available] (NOTION_TOKEN in .env)
  GitHub:  [missing]
  Discord: [missing]
  QMD:     [available] (CLI)
```

## Step 2 — Guide Missing Prerequisites

For each missing server, read the relevant section from
`references/mcp-setup-guide.md` and print the installation instructions.

Important: MCP servers added mid-session may not be available until Claude Code is restarted.
If any servers were added during this step, tell the user:
"Restart Claude Code and re-run `/conversation-distill:setup` to pick up the new servers."

Do NOT block on missing servers — proceed with whatever is available.

## Step 3 — Configure MCP Permissions

MCP tool calls from subagents require pre-approved permissions (permission prompts
only work in the main conversation). For each available MCP server, add its tools
to the project's permission allowlist.

If `.claude/settings.json` already exists, read it and merge new entries into
the existing `permissions.allow` array (skip entries already present). If all
needed entries are already present, print "MCP permissions already configured."
and skip. If the file doesn't exist, create it with:

```json
{
  "permissions": {
    "allow": ["mcp__discord__*", "mcp__mcp-server__*", "mcp__github__*", "mcp__qmd__*", "Bash(qmd *)"]
  }
}
```

When QMD is available via CLI (not just MCP), also include `Bash(qmd *)` to allow subagent Bash fallback without permission prompts.

Only include entries for MCP servers detected in Step 1. Ask the user to confirm
before writing.

## Step 4 — Initialize Repo Structure

1. Read `references/config-reference.md` for the config template.
2. Prompt the user for values:
   - Which channels do they want to configure? (Discord, GitHub, Notion — only include sections for chosen channels)
   - For Discord: server ID, digest channel ID
   - For GitHub: list of repos (org/repo format)
   - For Notion: ask the user for Notion page IDs to cache.
     They can find page IDs in the page URL (the 32-character hex string after the page title).
     Store as `pages: ["id1", "id2", ...]` in config.json.

3. If `config.json` already exists, read it, show the current configuration, and
   ask "Update configuration? (y/n)". If yes, prompt for values using current values
   as defaults. If no, keep as-is. If it doesn't exist, create it at the repo root
   with only the configured channel sections.
4. If `.distill/state.json` does not exist, create it with:
   ```json
   {
     "last_run": null,
     "cursors": {}
   }
   ```
   If it already exists, preserve it — cursors must not be reset.
5. Create `.distill/authored-docs/` directory (via `mkdir -p`).
6. Append `.distill/authored-docs/`, `.env`, and `**/.DS_Store` to `.gitignore` (create if needed, avoid duplicates).
7. Ask the user about top-level folder structure:
   "How do you want to organize knowledge? By project (project-a, project-b), by department (engineering, product), or something else?"
   If knowledge folders already exist, show them and ask "Add more folders?" instead
   of re-prompting for the full structure.
   Create the folders they specify. Suggest adding brief READMEs for ambiguous names.

## Step 5 — Commit

Check `git status --porcelain`. If clean, print "No changes to commit." and skip.
Otherwise:

```bash
git add .
git commit -m "Initialize conversation-distill"
```

Include config.json, state.json, .gitignore updates, and any folder structure created.

## Step 6 — Summary

Print a summary of what was set up:

```
Setup complete!

Configured channels: Discord, Notion
Missing channels: GitHub (see instructions above)
Knowledge folders: project-a/, project-b/, shared/
QMD collections: <dirname>-captured, <dirname>-authored (created by /conversation-distill:cache)

Next steps:
- Run /conversation-distill:cache to cache Notion pages and build the QMD index
- Add missing MCP servers and re-run /conversation-distill:setup
- Run /conversation-distill:run to process your first batch
- For automation: use `claude schedule add` to set up a daily run
```

If channels are missing: "Add MCP servers and re-run `/conversation-distill:setup`"
Always suggest: "Run `/conversation-distill:cache` before your first run"
Always suggest: "Run `/conversation-distill:run` to process your first batch"
Mention automation: "For recurring runs, use `claude schedule add --name conversation-distill --every day --at 09:00 --prompt '/conversation-distill:run'`"
