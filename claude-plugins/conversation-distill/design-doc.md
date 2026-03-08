# conversation-distill

_Open-source. For small-to-medium remote teams._

An agent that watches conversations across Discord, GitHub, and Notion — extracts decisions, process changes, troubleshooting solutions, and useful resources — and writes structured markdown files in a Git repo. When new conversations contradict existing authored docs, it flags staleness so a human can update the source of truth.

---

## Positioning

| Layer                      | Examples                                                                 | Maintained by                  |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| **Ephemeral**              | Discord messages, meeting conversations, PR comments, issue threads      | Nobody (decays in days)        |
| **Authored documentation** | Coding policies, design docs, architecture guides, onboarding curriculum | Humans (intentionally crafted) |

conversation-distill captures knowledge from the ephemeral layer and writes structured markdown. Two roles:

- **Permanent home for the long tail** — tips, resources, minor decisions, rationale. Stays as markdown.
- **Staging area for authored doc updates** — captures decisions/process changes immediately, flags when authored docs go stale so a human can update the source of truth.

---

## Knowledge Types

| Type                | What it captures                                       | Output                                             |
| ------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| **Decision**        | "We chose X because Y" or "We will NOT do X because Y" | Standalone immutable markdown (one per decision)   |
| **Process change**  | "We now do X differently"                              | New or updated runbook/process doc with change log |
| **Resource/tip**    | Proactively shared knowledge, links, patterns          | Appended to topic-grouped reference doc            |
| **Troubleshooting** | Problem → solution from real incidents                 | Appended to topic-grouped troubleshooting doc      |

All types produce markdown files with YAML frontmatter. Docs are organized by folder (the folder is the type), not by frontmatter fields.

---

## Design Decisions

- **Plain markdown in a dedicated Git repo.** Portable, renders everywhere. Metadata via YAML frontmatter. Separate from code repos because knowledge spans projects and non-engineers need access.
- **Capture rationale, not operational state.** Tasks and assignments stay in Notion/Jira/GitHub Issues. We capture the decision and reasoning, then link to the task. For authored docs: reference by URL and detect staleness, never duplicate content.
- **Filesystem is the taxonomy.** Users create top-level folders (by client, project, department). Agent creates type subfolders (`decisions/`, `process/`, `resources/`, `troubleshooting/`) as content arrives. Unmatched content → agent creates a new folder and notes it in the digest. Users rearrange freely; agent respects current state on next run.
- **Decisions are immutable.** Never edited, only superseded. Status field: accepted, rejected, deprecated, superseded by `<filename>`. Reversals create a new doc and update the old doc's status.
- **Commit-and-correct review.** Everything gets committed, including uncertain items (`status: needs-review`). Humans correct in place before the next run. No PRs, no staging branches.
- **QMD for search.** [QMD](https://github.com/tobi/qmd) (local, MIT, BM25 + vector + LLM re-ranking) indexes two collections: `captured` (our markdown) and `authored` (Notion docs cached in `.distill/authored-docs/`). Incremental re-indexing via `qmd update && qmd embed`.

---

## Input Channels (v1)

| Channel | Type                                          | Integration                                     |
| ------- | --------------------------------------------- | ----------------------------------------------- |
| Discord | Conversations, decisions, meeting transcripts | MCP (SaseQ/discord-mcp or similar)              |
| Notion  | Authored docs (for staleness detection)       | Script (`scripts/cache-notion.js`) + Notion API |
| GitHub  | PR comments, issues, discussions              | MCP (Official GitHub MCP)                       |

---

## v1 Architecture: Claude Code Skill

A Claude Code skill is a SKILL.md file — markdown instructions that teach Claude a repeatable workflow. No SDK, no app server, no container.

**Claude Code provides:** agent runtime, subagents (Agent tool), MCP support, file system access, Grep/Read tools, no per-token API costs (Max subscription).

**We build:** SKILL.md (the workflow), `config.json` (user-edited settings), `.distill/` (state + QMD cache).

### Component Stack

```
┌─────────────────────────────────────┐
│    User (Cowork / Claude Code)      │
├─────────────────────────────────────┤
│     Scheduled / manual invocation   │
│       (runs SKILL.md daily)         │
├──────────┬──────────┬─────────┬─────┤
│ MCP:     │ Script:  │ MCP:    │MCP/ │
│ Discord  │ Notion   │ GitHub  │CLI: │
│          │ (API)    │         │ QMD │
├──────────┴──────────┴─────────┴─────┤
│  config.json + .distill/            │
├─────────────────────────────────────┤
│  QMD index (BM25 + vector search)   │
│  Collections: captured, authored    │
├─────────────────────────────────────┤
│  Markdown files (knowledge output)  │
│  (dedicated Git repo, auto-commit)  │
└─────────────────────────────────────┘
```

### Automation

The skill runs interactively when invoked. For automated daily runs:

- **Claude Code scheduling**: `claude schedule add` (missed runs execute on next wake)
- **CLI**: wrap in a shell script, schedule via `cron` or `launchd`

```bash
#!/bin/bash
claude -p "Execute the conversation-distill daily run workflow." \
  --allowedTools "mcp__discord__*,mcp__mcp-server__*,mcp__github__*,mcp__qmd__*,Bash(*),Read,Write,Edit,Grep,Agent" \
  --model sonnet
```

---

## Data Structures

`config.json` and `.distill/state.json` are committed. `.distill/authored-docs/` is gitignored (reproducible from source APIs).

```
team-knowledge/
├── config.json                              ← user-edited settings (committed)
├── .distill/                                ← internal machinery (hidden)
│   ├── state.json                           ← cursors (committed)
│   └── authored-docs/                       ← QMD cache (gitignored)
│       └── notion/                          ← grouped by source
│           ├── Engineering/                 ← mirrors Notion page hierarchy
│           │   └── coding-policies.md
│           └── Product/
│               └── design-notes.md
├── project-a/                                ← user-created top-level folder
│   ├── decisions/                           ← agent-created type subfolder
│   │   ├── 2026-03-05-postgresql-user-service.md
│   │   └── settings-panel/                  ← feature subfolder
│   │       └── 2026-03-05-modal-over-drawer.md
│   ├── process/
│   │   └── deployment-process.md
│   ├── resources/
│   │   └── frontend-resources.md
│   └── troubleshooting/
│       └── unity-troubleshooting.md
├── project-b/
│   ├── decisions/
│   └── resources/
└── shared/                                  ← optional: cross-project knowledge
    ├── decisions/
    └── process/
```

### config.json

Must live at the repo root.

```json
{
  "discord_digest_channel_id": "1234567890",
  "channels": {
    "discord": { "server_id": "987654321" },
    "github": { "repos": ["org/repo1", "org/repo2"] },
    "notion": { "pages": ["page-id-1", "page-id-2"] }
  }
}
```

Discord: listens to all channels in the server. Notion: `scripts/cache-notion.js` uses the Notion API to recursively fetch all child pages under the configured root page IDs; access is controlled in Notion's integration settings. `pages` lists the 32-char hex page IDs (from the page URL) to use as roots. Requires `NOTION_TOKEN` env var (stored in `.env`). GitHub: explicit repo list.

### .distill/state.json

Per-channel cursors.

```json
{
  "last_run": "2026-03-06T00:00:00Z",
  "cursors": {
    "discord:1234567890": {
      "last_message_id": "1234567890",
      "last_message_ts": "2026-03-05T23:45:00Z"
    },
    "discord:1234567891": {
      "last_message_id": "1234567891",
      "last_message_ts": "2026-03-05T22:30:00Z"
    },
    "github:org/repo1:pulls": {
      "since": "2026-03-05T00:00:00Z"
    },
    "github:org/repo1:issues": {
      "since": "2026-03-05T00:00:00Z"
    },
    "notion": {
      "last_searched": "2026-03-05T00:00:00Z"
    }
  }
}
```

Discord cursors use channel IDs (stable snowflakes; channel names can change). `last_message_ts` stored as fallback since snowflake IDs are timestamp-encoded and survive deletion. GitHub `since` filters by `updated_at`, so edited comments reappear (deduplicate by comment ID). Edited messages after processing are missed (acceptable for v1).

**Authored doc caching:** `.distill/authored-docs/` is organized by source, then mirrors the source's own page hierarchy. For Notion, `scripts/cache-notion.js` does a full recache each time — cleans the directory and re-fetches all accessible pages. The files on disk are the source of truth; no JSON tracking in state.json is needed. Each cached file has minimal frontmatter:

```yaml
---
title: "Coding Policies"
source: notion
url: "https://www.notion.so/30ac3744a8eb80f0..."
---
```

The file path itself gives QMD context for BM25 matching (e.g., `notion/Engineering/coding-policies.md` naturally matches queries about engineering coding policies).

### Document Templates

Four output types, one per folder. No `type` frontmatter — the folder is the type. Decisions are **one decision, one file, date-prefixed** (`2026-03-05-postgresql-user-service.md`). Process, resources, and troubleshooting are **one topic, one file, topic-named** (`deployment-process.md`, `unity-troubleshooting.md`). Resources and troubleshooting are append-only; process docs are updated in place.

- **Decision (ADR):** frontmatter (title, status, date, participants, tags, optionally supersedes) + Nygard body sections: Context, Decision, Consequences, Related. Immutable — never edited, only superseded. Feature-scoped decisions grouped in subfolders (e.g., `project-a/decisions/settings-panel/`).
- **Process/runbook:** Steps, optionally Rollback and Prerequisites (included only when discussed), Change Log. One process per file, updated in place.
- **Resource doc:** topic-grouped entries with who shared, when, why useful. Append-only.
- **Troubleshooting doc:** topic-grouped entries, each with Symptoms, Root cause, Fix, optionally Prevention. Append-only.

_(See appendix for full template examples.)_

---

## Architecture Flows

### Flow 1: First-Time Setup (one-time, interactive)

1. **Install plugin** — `/plugin install conversation-distill@realxp-lab-armory` (or `--plugin-dir` for local dev)
2. **Configure MCP servers & API tokens** — user adds Discord MCP (bot token + server ID) and GitHub MCP (OAuth) to their Claude Code MCP config. For Notion, set `NOTION_TOKEN` in `.env` (integration token) and grant the integration access to relevant pages in Notion settings. Add root page IDs to `config.json` under `channels.notion.pages`.
3. **Configure permissions allowlist** — add MCP tools and `Bash(qmd *)` to `settings.json` so scheduled runs don't prompt.
4. **Initialize repo** — from the knowledge repo root, create `config.json` (digest channel ID, channel config), `.distill/state.json` (empty cursors), `.distill/authored-docs/`. Add `.distill/authored-docs/` to `.gitignore`.
5. **User creates top-level folders** — user defines the structure (by client, project, department). Optional READMEs for ambiguous folder names. Agent creates new top-level folders later when it detects unmatched content (noted in digest).
6. **Set up automation** (optional) — `claude schedule add` or external cron/launchd. Run `/conversation-distill:cache` to cache Notion pages and build the QMD index before the first run.

### Flow 2: Daily Run (automated, unattended)

An orchestrator with parallel specialized agents. Main orchestrator is Sonnet; lightweight tasks use Haiku subagents via Agent tool. Raw channel content never enters the main agent's context.

**Step 1 — Gate** _(main agent)_

Read cursors from `state.json` and channels from `config.json`. For any channel
with no cursor, default to 14 days ago. Check each channel for new content since
its cursor. If nothing new, exit.

**Step 2 — Ingest & Extract** _(parallel general-purpose Agent subagents for Discord/GitHub)_

One general-purpose Agent subagent per channel. Each fetches content via MCP and extracts knowledge items in a single pass. Each subagent receives the channel's cursor and the false positive checklist (see below). General-purpose Agent subagents (not plugin-defined custom subagents) are used because they inherit MCP tool access from the main conversation.

Returns structured items:

```json
{
  "items": [
    {
      "type": "decision",
      "title": "Use PostgreSQL for user service",
      "content": "Team chose PostgreSQL over MongoDB for the user service because of schema stability, team familiarity (3/4 backend engineers have PG experience), and lower operational cost at current scale. Trade-off: limits future multi-region options.",
      "participants": ["Alice", "Bob", "Carol"],
      "source_channel": "discord:backend",
      "date": "2026-03-05",
      "tags": ["database", "backend"]
    }
  ]
}
```

The `content` field preserves all detail from the original conversation, cleaned up for noise but not summarized.

**File attachments:** The Discord MCP server does not return file attachment contents — only message text and metadata. Users who want to process file attachments (e.g., meeting transcript `.txt` files posted by bots) must download them manually and use transcript mode (`/conversation-distill:run path/to/file.txt`).

**Error handling:** If a channel's MCP call fails, that subagent exits with an error. Main agent skips it, does not update its cursor (retried next run), and notes the failure in the digest.

**Step 3 — QMD Re-index** _(main agent)_

Before spawning the Dedupe & Enrich subagent, the main agent runs an incremental QMD re-index (`qmd update && qmd embed`) to ensure files from previous runs are searchable. Uses `mcp__qmd__*` tools if available, otherwise CLI via Bash. If update/embed fails, exit with an error — a stale index leads to duplicate captures.

**Step 4 — Dedupe & Enrich** _(single Sonnet subagent)_

Receives all items from all channels.

**Deduplicate:** Cross-channel items about the same topic are merged into one item, combining content. Near-duplicates are collapsed.

**Enrich with QMD:** For each item, query QMD sequentially (first `captured`, then `authored` collection). Sequential because QMD's local re-ranking model bottlenecks under concurrent load. Attaches top matches:

```json
{
  "item": { "...original item fields..." },
  "qmd_matches": {
    "captured": [
      { "path": "project-a/decisions/2026-02-01-mongodb-evaluation.md", "snippet": "..." }
    ],
    "authored": [
      { "path": ".distill/authored-docs/notion/Engineering/coding-policies.md", "snippet": "..." }
    ]
  }
}
```

**Step 5 — Score** _(parallel Haiku subagents, one per item)_

Each Haiku subagent receives one enriched item (title, content, type, source_channel) and its QMD matches, and the scoring rubric below. Returns:

- `score`: integer 0–100
- `conflict`: one of `none`, `captured_conflict`, `authored_stale`

**Score reference (provided to each scorer):**

| Score  | Meaning                                                                                          | Examples                                                  |
| ------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 90–100 | Clear, actionable, novel knowledge. Unambiguous decision, process change, or fix with consensus. | "We decided to use X because Y" with team agreement       |
| 70–89  | Likely valuable but somewhat ambiguous or incremental.                                           | Informal agreement, useful tip without strong context     |
| 40–69  | Uncertain value. Might be noise, might be worth capturing.                                       | Suggestion without clear resolution, vague resource share |
| 0–39   | Not knowledge. Noise, social chat, already captured, or restates existing docs.                  | Greetings, scheduling, duplicate of existing content      |

Scorers also evaluate: does the item duplicate an existing captured doc (high-similarity QMD `captured` match)? Does it contradict an authored doc (QMD `authored` match with conflicting information)? These checks set the `conflict` flag.

**Routing:**

- **≥ threshold**, `none` → **publish**
- **≥ threshold**, `captured_conflict` → write with `status: needs-review`, note conflict in digest
- **≥ threshold**, `authored_stale` → publish normally, flag the authored doc as stale in digest (advisory only, authored docs are never modified)
- **< threshold** → **discard**

**Step 6 — Place & Write** _(main agent + parallel Sonnet subagents)_

**Placement:** Main agent infers folder for each passing item using the folder tree, READMEs, and item content. Unmatched items → new folder, noted in digest. Groups items by target file (decisions/process get own files; resources/troubleshooting group by topic file).

**Writing:** Parallel Sonnet subagents, one per target file. Each receives the item(s) and the relevant template reference file path. Each subagent reads the template, reads existing file content (for appends/updates), drafts the content, and writes the file directly. One subagent per file prevents race conditions.

**Step 7 — Commit & Notify** _(main agent)_

1. Update cursors in `state.json` to the latest position fetched — only for channels
   successfully ingested in Step 2. This includes channels that had no prior cursor
   (first run for that channel).
2. Build daily digest (see Appendix).
3. `git add . && git commit` (digest as commit message) `&& git push`.
4. Post digest to Discord via MCP.

**Error handling:** If git push fails, attempt `git pull --rebase && git push` once. If that fails, leave commit local (next run includes it). If Discord post fails, digest is preserved in the commit message.

---

**False positive checklist (provided to Extract subagents):**

Do NOT extract:

- Decisions that were discussed but not concluded ("we should probably…" without resolution)
- Links shared without context ("check this out" with no explanation of why it's useful)
- Action items with no decision context (those belong in task trackers, not knowledge docs)
- Hypotheticals or brainstorming that didn't lead to a conclusion
- Scheduling, greetings, social conversation, emoji reactions
- Bug reports without a resolution (those are GitHub issues, not knowledge)

Note: duplication and staleness checks (e.g., "this restates an existing doc" or "the team already knows this") are handled by the scorer at Step 5, where QMD matches provide the necessary context.

### Flow 3: Meeting Transcript (on-demand, explicit)

Same pipeline as the daily run, but starting from a local transcript file instead of channel APIs. The transcript is segmented by speaker turns and topic shifts. Focus on explicit decisions, action items with context (the _why_), and shared resources. Ignore filler (greetings, scheduling, small talk).

---

## Operational Decisions

- **Run cadence:** Daily, cursor-based.
- **Confidence threshold:** Default to 80. See Flow 2 Step 5 for routing logic.
- **Daily digest:** Posted to Discord + stored as git commit message. `git log` is the digest history.

---

## Appendix: Document Template Examples

**Decision:** `project-a/decisions/2026-03-05-postgresql-user-service.md`

```markdown
---
title: "Use PostgreSQL for user service"
status: accepted
date: 2026-03-05
participants: [Alice, Bob, Carol]
tags: [database, backend, infrastructure]
---

# Use PostgreSQL for user service

## Context

The team needed to choose a database for the new user service. Discussed in #backend on 2026-03-05, also came up during PR #42 review.

## Decision

PostgreSQL over MongoDB.

## Consequences

- Schema stability for user data that has well-defined structure
- Team familiarity — 3 of 4 backend engineers have PostgreSQL experience
- Lower operational cost than MongoDB Atlas for our scale
- Limits future multi-region options (PostgreSQL lacks native multi-master)

## Related

- [PR #42: Initial user service setup](https://github.com/org/repo/pull/42)
- [Task: Set up PostgreSQL for user service](https://notion.so/...)
```

Variants: **rejection** uses `status: rejected` ("We will NOT use X."). **Superseding** adds `supersedes: "<old-filename>"` to frontmatter; old doc's status updated to `"superseded by <new-filename>"`. **Feature-scoped** decisions live in subfolders (e.g., `project-a/decisions/settings-panel/`).

**Process/runbook:** `project-a/process/deployment-process.md`

```markdown
---
title: "Deployment Process"
last_updated: 2026-03-05
tags: [deployment, devops, process]
---

# Deployment Process

## Steps

1. Create PR against `main`
2. Get two approvals (updated 2026-03-05 — previously required one)
3. Merge triggers CI/CD pipeline
4. Staging deploy is automatic
5. Production deploy requires manual approval in GitHub Actions

## Rollback

If production deploy fails, use the "Rollback" button in GitHub Actions to revert to the previous release. Notify #engineering.

## Change Log

- **2026-03-05:** Two approvals now required (was one). Discussed in #engineering after the March 3 incident.
```

**Resource doc:** `project-a/resources/frontend-resources.md`

```markdown
---
title: "Frontend Resources"
last_updated: 2026-03-05
tags: [frontend, react, css, performance]
---

# Frontend Resources

## Libraries

### date-fns — Date handling

Shared by Alice on 2026-02-15 in #frontend. Replaced moment.js, cut 40kb from the bundle thanks to tree-shaking.

- Link: https://date-fns.org/

## Debugging Tips

### React re-render debugging

Shared by Carol on 2026-03-05 in #frontend. Use React.Profiler with the onRender callback to log exactly which components re-render and why.

### Addressables build optimization workflow

Shared by Bob on 2026-03-10 in #dev.

When Addressables builds take too long, the issue is usually duplicate asset
dependencies across groups. Open the Addressables Event Viewer and look for
assets that appear in multiple groups — the "Bundle Layout Preview" in Build
Layout Report shows exactly which bundles share dependencies.

The fix is to create a shared group for common dependencies. Move any asset
referenced by 3+ groups into a "Shared" group. This cut our build time from
12 minutes to 4 minutes.

One gotcha: if you move a texture atlas into the shared group, make sure all
sprites referencing it are also in Addressables, otherwise you'll get pink
squares at runtime.

- Related: [Unity docs — Addressables shared group strategy](https://docs.unity3d.com/...)
```

**Troubleshooting doc:** `project-a/troubleshooting/unity-troubleshooting.md`

```markdown
---
title: "Unity Troubleshooting"
last_updated: 2026-03-05
tags: [unity, debugging, errors]
---

# Unity Troubleshooting

## NullReferenceException on scene load

**Symptoms:** Objects referencing other scene objects throw NullRef during Awake() after scene reload.
**Root cause:** Script execution order — objects using FindObjectOfType in Awake() run before the target is initialized.
**Fix:** Move to Start() or use lazy initialization.
**Prevention:** Avoid FindObjectOfType in Awake() for cross-object references; use lazy patterns by default.
**Found by:** Alice on 2026-03-05 in #dev after debugging the inventory panel crash.

- Related: [GitHub issue #87](https://github.com/org/repo/issues/87)
```

**Daily digest format (posted to Discord + used as git commit message):**

```
**conversation-distill — Daily Digest (2026-03-06)**

**Auto-committed:**
- ✅ Updated: `project-a/process/deployment-process.md` — two approvals now required
- ✅ New: `project-a/decisions/2026-03-05-postgresql-user-service.md` — decided PostgreSQL for user service
- ✅ Updated: `project-a/troubleshooting/unity-troubleshooting.md` — added Addressables build fix
- ✅ New: `project-a/decisions/settings-panel/2026-03-05-modal-over-drawer.md` — modal over drawer for settings

**Committed — needs review:**
- ⚠️ Conflict: `project-a/decisions/2026-03-06-api-versioning.md` — contradicts current doc on deprecation timeline. Edit or delete before next run.

**Stale docs detected:**
- 📄 [Coding Policies](https://www.notion.so/...) — #dev discussion suggests preprocessor directive policy has changed

**Stats:** 47 messages processed across 3 channels. 3 docs updated, 2 new docs, 1 needs-review, 1 stale doc.
```
