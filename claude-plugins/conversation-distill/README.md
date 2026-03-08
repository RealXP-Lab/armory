# conversation-distill

Extracts decisions, process changes, resources, and troubleshooting from team conversations (Discord, GitHub, Notion) into structured markdown in a Git repo.

## Overview

conversation-distill watches your team's conversations across Discord, GitHub, and Notion. It extracts knowledge — decisions with rationale, process changes, useful resources, and troubleshooting solutions — and writes structured markdown files in a dedicated Git repo. When conversations contradict existing authored docs, it flags staleness so a human can update the source of truth.

**Two roles:**

- **Permanent home for the long tail** — tips, resources, minor decisions, rationale. Stays as markdown.
- **Staging area for authored doc updates** — captures decisions/process changes immediately, flags when authored docs go stale.

## Prerequisites

- **Node.js 18+** — required for the Notion caching script
- **Claude Code** with Max subscription (subagents require it)
- **QMD** — local search index (`npm install -g @tobilu/qmd`)
- **At least one input channel** — Discord (MCP), GitHub (MCP), or Notion — all optional, skill works with any subset
- **`NOTION_TOKEN`** in `.env` at repo root — required if using Notion (integration token from [notion.so/my-integrations](https://www.notion.so/my-integrations))

## Installation

```bash
# Add the marketplace
/plugin marketplace add realxp-lab/armory

# Install the plugin
/plugin install conversation-distill@realxp-lab-armory
```

Or test locally:

```bash
claude --plugin-dir ./claude-plugins/conversation-distill
```

## Commands

### `/conversation-distill:setup [path]`

Interactive setup wizard. Guides you through:

1. Detecting available MCP servers
2. Installing missing prerequisites (QMD, Discord bot, GitHub MCP, Notion integration)
3. Configuring MCP permissions for subagent access
4. Creating `config.json` and `.distill/` structure

Re-runnable — safe to run again after adding new MCP servers.

```bash
# Set up in current directory
/conversation-distill:setup

# Set up in a specific directory
/conversation-distill:setup ~/team-knowledge
```

### `/conversation-distill:cache`

Caches Notion pages to local markdown and rebuilds the QMD search index. Run after
setup and whenever you want fresh Notion content or updated search results.

```bash
/conversation-distill:cache
```

### `/conversation-distill:run [transcript-file]`

Runs the extraction pipeline.

**Daily run** (no arguments): Fetches new content from configured MCP channels, extracts knowledge, scores items, writes markdown files, commits, and posts a digest.

```bash
/conversation-distill:run
```

**Meeting transcript mode** (file path argument): Processes a local transcript file through the same pipeline.

```bash
/conversation-distill:run path/to/meeting-notes.md
```

## Configuration

### config.json

Lives at the knowledge repo root. Created by `/conversation-distill:setup`.

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

| Field                           | Description                                                              |
| ------------------------------- | ------------------------------------------------------------------------ |
| `discord_digest_channel_id`     | Channel for daily digest posts. Empty = skip.                            |
| `channels.discord.server_id`    | Discord server to monitor.                                               |
| `channels.github.repos`         | GitHub repos in `org/repo` format.                                       |
| `channels.notion.pages`         | Notion page IDs to cache. Empty = nothing cached.                        |

Only include channel sections for channels you want to use.

## Knowledge Types

| Type                | What it captures                     | Output                                          |
| ------------------- | ------------------------------------ | ----------------------------------------------- |
| **Decision**        | "We chose X because Y"               | One file per decision, date-prefixed, immutable |
| **Process**         | "We now do X differently"            | One file per topic, updated in place            |
| **Resource**        | Shared knowledge, links, patterns    | One file per topic, append-only                 |
| **Troubleshooting** | Problem-solution from real incidents | One file per topic, append-only                 |

## Repo Structure

```
team-knowledge/
├── config.json
├── .distill/
│   ├── state.json              (cursors)
│   └── authored-docs/          (Notion cache, gitignored)
├── project-a/
│   ├── decisions/
│   ├── process/
│   ├── resources/
│   └── troubleshooting/
├── project-b/
│   └── decisions/
└── shared/
    ├── decisions/
    └── process/
```

Top-level folders are user-created (by project, department, etc.). Type subfolders are created by the agent as content arrives.

## Automation

For recurring daily runs:

**Claude Code scheduling:**

```bash
claude schedule add --name "conversation-distill" \
  --every day --at 09:00 \
  --prompt "/conversation-distill:run"
```

Runs in the background on schedule. Missed runs execute on next wake. Use `claude schedule list` to view and `claude schedule remove` to delete.

**Alternative — cron/launchd:**

```bash
#!/bin/bash
claude -p "Execute the conversation-distill daily run workflow." \
  --allowedTools "mcp__discord__*,mcp__mcp-server__*,mcp__github__*,mcp__qmd__*,Bash(*),Read,Write,Edit,Grep,Agent" \
  --model sonnet
```

## Service Support

| Service | Integration                                    | Auto-detected variants           |
| ------- | ---------------------------------------------- | -------------------------------- |
| Discord | MCP server                                     | `mcp__discord__*` or `mcp__mcp-server__*` |
| GitHub  | MCP server                                     | `mcp__github__*`                             |
| Notion  | Script + API (`NOTION_TOKEN` in `.env`)          | N/A (no MCP needed)             |
| QMD     | MCP server or CLI                              | `mcp__qmd__*` or `which qmd`    |

## Customization

### Document templates

Edit the template files in `skills/run/references/template-*.md` to change the output format for each knowledge type.

### Extraction rules

Edit `skills/run/references/extraction-rules.md` to tune what gets extracted and what gets filtered.

### Folder structure

Rearrange top-level folders freely. The agent respects the current directory structure on each run.

## Author

Jack Guo (jack@realxplab.com)

## Version

1.0.0
