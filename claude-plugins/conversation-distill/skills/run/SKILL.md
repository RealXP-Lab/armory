---
name: run
description: Extract knowledge from team conversations into structured markdown. Accepts an optional transcript file path.
argument-hint: "[transcript-file]"
---

# conversation-distill

$ARGUMENTS is an optional transcript file path.

- Empty → Daily run: fetch from MCP channels
- File path → Meeting transcript mode: process a local file

The main agent is a **pure coordinator** — it makes placement decisions, spawns subagents, and handles git/QMD operations. Subagents do all content processing AND file writing. Raw channel content and drafted documents never enter the main agent's context.

## MCP Server Detection

MCP tools must be pre-approved in the user's permissions settings for subagents to use
them (permission prompts only work in the main conversation). The setup skill
(`/conversation-distill:setup`) handles this. If MCP calls fail from subagents,
verify permissions via `/permissions`.

Detect available MCP servers by attempting lightweight calls:

- **GitHub**: try `mcp__github__*`
- **Discord**: try `mcp__discord__*` or `mcp__mcp-server__*`
- **QMD**: try `mcp__qmd__qmd_status` first, then `which qmd` for CLI fallback

Record working tool prefix for each MCP service. Skip unavailable channels gracefully.

Notion caching and QMD indexing are managed separately via `/conversation-distill:cache`.

## Reference Files

Channel-specific extraction instructions (passed to Step 2 subagents):

- `references/channel-discord.md`
- `references/channel-github.md`

Document templates (passed to Step 6 subagents, one per document type):

- `references/template-decision.md`
- `references/template-process.md`
- `references/template-resource.md`
- `references/template-troubleshooting.md`

Shared references:

- `references/extraction-rules.md` — extraction criteria and filtering rules (passed to Step 2 subagents)
- `references/scoring-rubric.md` — scoring scale + routing (passed to Step 5 subagents)
- `references/digest-format.md` — digest template (used by main agent in Step 7)

---

## Daily Run Mode

If $ARGUMENTS is empty, run the daily pipeline.

### Step 1 — Gate (main agent)

Read `config.json` and `.distill/state.json`. If either file is missing, print:
"Error: Required files not found. Run `/conversation-distill:setup` first." and exit.

Check QMD availability (try `mcp__qmd__qmd_status` first, then `which qmd`). If neither
is available, print: "Error: QMD is required but not found. Install it or run
`/conversation-distill:setup`." and exit.

Check each available channel for new content since its cursor.
If a channel has no cursor in state.json, default to 14 days ago.
If nothing new across all channels, print "No new content since last run." and exit.

### Step 2a — Ingest & Extract (all in parallel)

Launch extraction subagents in parallel:

**Extraction subagents** (Sonnet, one per available channel):
One subagent per available extraction channel (Discord, GitHub). Each receives:

- Channel cursor from state.json
- Content of `references/extraction-rules.md` (read it and pass the content)
- The channel-specific ref file content (`references/channel-discord.md` or `references/channel-github.md`)
- The detected MCP tool prefix for that channel

Each subagent fetches content via MCP and returns structured JSON:

```json
{
  "items": [
    { "type": "...", "title": "...", "content": "...", "participants": [], "source_channel": "...", "date": "...", "tags": [] }
  ],
  "new_cursors": { ... },
  "file_attachments": [
    { "url": "...", "filename": "...", "author": "...", "is_bot": false, "message_text": "...", "channel_name": "...", "channel_id": "...", "message_id": "...", "date": "..." }
  ]
}
```

The `file_attachments` array is returned by the Discord subagent only (see `references/channel-discord.md`). GitHub subagent omits it.

Error handling: if MCP call fails, the subagent returns an error object.
Main agent skips that channel, does NOT update its cursor, and notes the failure in the digest.

### Step 2b — Process File Attachments

Inspect the Discord subagent's `file_attachments` from Step 2a. If the array is empty or absent, skip to Step 3 (QMD Re-index).

If non-empty, spawn **file-processing subagents** in parallel (Sonnet, one per attachment). Each receives:

- The file attachment metadata (URL, filename, message text, author name, is_bot, channel name/ID, message ID, date)
- Content of `references/extraction-rules.md`

Each file-processing subagent:

1. **Assess relevance** from context (message text, filename, channel, author). If the file is clearly irrelevant to knowledge extraction (e.g., log dumps, config files, build output), return `{ "items": [], "skipped": true, "reason": "..." }` without downloading.
2. **Download** the file: `Bash(curl -sL "<url>" -o /tmp/file-<message_id>.txt)`
3. **Read and extract** knowledge items using the standard extraction rules.
4. Use `source_channel: "discord-file:<channel_name>/<filename>"` to distinguish file-derived items from regular Discord chat items.
5. Return `{ "items": [...] }` — no cursors (cursor management is handled by the Discord subagent in Step 2a).
6. If download fails (expired CDN URL, 404, timeout), return `{ "items": [], "error": "..." }`.

Main agent merges items from Step 2a + Step 2b, then proceeds to Step 3.

**Error handling**: File fetch failures (expired URLs, timeouts) are noted in the digest. Regular Discord items from the same run are unaffected.

### Step 3 — QMD Re-index (main agent)

Run an incremental QMD re-index to ensure files written by previous runs are indexed
and available for dedup/conflict detection in Step 4.

- Use `mcp__qmd__*` tools if available, otherwise CLI via Bash (same detection as Step 1)
- Run `qmd update` then `qmd embed` — both are incremental and operate on all collections.
- If update or embed fails, exit with an error — a stale or broken index leads to
  duplicate captures, which is worse than skipping a run.

### Step 4 — Dedupe & Enrich (single Sonnet subagent)

Receives all items from Step 2 extraction subagents.

**Deduplicate:** Cross-channel items about the same topic are merged into one item, combining content from both sources. Near-duplicates are collapsed.

**Enrich with QMD:** For each item, query QMD sequentially (captured collection first, then authored collection). Sequential because QMD's local re-ranking model bottlenecks under concurrent load.

Collection names are prefixed with the repo directory name (e.g., `team-knowledge-captured`,
`team-knowledge-authored`). Derive the prefix from `basename $(pwd)`.

- Use `mcp__qmd__qmd_deep_search` if available, else `Bash(qmd query ...)`
- Filter by collection: `-c <prefix>-captured` or `-c <prefix>-authored`
- Attach top matches to each item as `qmd_matches`

Returns enriched items:

```json
{
  "item": { "...original fields..." },
  "qmd_matches": {
    "captured": [{ "path": "...", "snippet": "..." }],
    "authored": [{ "path": "...", "snippet": "..." }]
  }
}
```

### Step 5 — Score (parallel Haiku subagents, one per item)

Each receives: one enriched item + its QMD matches + content of `references/scoring-rubric.md`.
Returns: `score` (0-100) + `conflict` (none | captured_conflict | authored_stale) + `stale_detail` (string, only when `authored_stale` — contrasts what the doc says vs what the team decided, e.g. `"doc says X, team now Y"`).

Main agent applies routing (default threshold of 80):

- **>= threshold, none** → publish
- **>= threshold, captured_conflict** → publish with `status: needs-review`, note in digest
- **>= threshold, authored_stale** → publish, flag authored doc as stale in digest
- **< threshold** → discard

### Step 6 — Place & Write (main agent coordinates, subagents write)

**Placement** (main agent):
For each passing item, determine the target folder using:

- Existing directory tree (use Glob to list)
- READMEs in top-level folders
- Item content, tags, and source channel

Group items by target file:

- **Decisions**: new file per decision, date-prefixed (e.g., `2026-03-05-title-slug.md`)
- **Process**: one file per topic, update in place
- **Resources/troubleshooting**: one file per topic, append

**Writing** (parallel Sonnet subagents, one per target file):
Each subagent receives:

- Item(s) assigned to that file
- The relevant template ref file path (e.g., `references/template-decision.md`) — subagent reads it
- Target file path (subagent reads existing content if append/update)
- For conflict items: include `status: needs-review` instruction

Each subagent:

1. Reads the template reference file
2. Reads existing target file (if updating/appending)
3. Drafts the content following the template
4. Writes the file directly

**Superseding decisions:** When a decision item supersedes an existing one (identified via QMD matches in Step 4), the subagent writing the new decision also updates the old decision file's frontmatter status to `superseded by "<new-filename>"`. The new file includes `supersedes: "<old-filename>"` in its frontmatter.

One subagent per file prevents race conditions. Main agent verifies all subagents completed.

### Step 7 — Commit & Notify (main agent)

1. **Update cursors** in state.json to the latest position fetched — only for channels
   that were successfully ingested. This includes channels that had no prior cursor
   (first run for that channel).
2. **Build digest**: Read `references/digest-format.md` and build the digest from the results.
3. **Commit and push**:
   ```bash
   git add .
   git commit -m "<digest content>"
   git push
   ```
   If push fails: `git pull --rebase && git push` (once). If still fails, leave local.
4. **Post digest** to Discord digest channel (if Discord MCP available and
   `discord_digest_channel_id` is configured in config.json).

---

## Meeting Transcript Mode

If $ARGUMENTS is a file path, run the transcript pipeline.

### Step 1 — Read & Verify

Verify the file at $ARGUMENTS exists. If not, print an error and exit.

### Step 2 — Extract (single Sonnet subagent)

Same extraction logic as daily mode but from a local file instead of MCP channels.
The subagent receives:

- The transcript file path (subagent reads it)
- Content of `references/extraction-rules.md`

The subagent reads the full transcript and extracts knowledge items holistically.
Returns the same structured JSON items as daily mode.

### Steps 3-7 — Same as Daily Run

Follow the same pipeline: QMD Re-index → Dedupe & Enrich → Score → Place & Write → Commit & Notify.
Differences:

- Skip cursor updates (no channels involved).
- Digest notes this was a transcript processing run (uses "Transcript Digest" format).
- Source field references the transcript file path.
