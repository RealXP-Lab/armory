# MCP Server Setup Guide

Instructions for installing and configuring each MCP server used by conversation-distill.

---

## QMD (Local Search Index)

QMD provides BM25 + vector + LLM re-ranking search over your knowledge repo.

**Prerequisites:** Node.js 18+ or Bun

**Install:**

```bash
npm install -g @tobilu/qmd
# or
bun install -g @tobilu/qmd
```

**Add to Claude Code:**

```bash
claude mcp add qmd -- qmd mcp
```

**Verify:**

```bash
qmd status
```

**Common issues:**

- If `qmd status` fails, ensure the binary is on your PATH (`which qmd`).
- QMD needs to be run from within a directory that has collections configured.

---

## Discord (SaseQ/discord-mcp)

Recommended: SaseQ/discord-mcp — 30+ tools, 200+ stars, explicit Claude Code support.

**Prerequisites:** Docker

**Setup steps:**

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
2. Under "Bot", enable all three **Privileged Gateway Intents**: **PRESENCE INTENT**, **SERVER MEMBERS INTENT**, and **MESSAGE CONTENT INTENT** (all three are required for the Discord MCP server to function correctly).
3. Copy the bot token.
4. Under "OAuth2 > URL Generator", select `bot` scope with `Read Messages/View Channels` and `Read Message History` permissions. Use the generated URL to invite the bot to your server.
5. Get your server (guild) ID: enable Developer Mode in Discord settings, right-click the server name, "Copy Server ID".

**Add to Claude Code:**

```bash
claude mcp add mcp-server -- docker run --rm -i \
-e DISCORD_TOKEN=<your-bot-token> \
-e DISCORD_GUILD_ID=<optional-default-server-id> saseq/discord-mcp:latest
```

**Verify:** Try reading a channel via MCP (e.g., list channels or read recent messages).

**Common issues:**

- If messages come back empty, check that the MESSAGE CONTENT intent is enabled.
- If the bot can't see channels, verify it has been invited to the server and has Read Messages permission.
- Docker must be running before using the MCP server.

---

## GitHub (Official MCP Server)

The official GitHub MCP server requires a Personal Access Token (PAT).

**Prerequisites:**

- [GitHub Personal Access Token](https://github.com/settings/personal-access-tokens/new) with `repo` scope (classic) or fine-grained with Contents, Issues, Pull Requests read access

**Option A — Remote server (no Docker):**

```bash
claude mcp add-json github '{"type":"http","url":"https://api.githubcopilot.com/mcp","headers":{"Authorization":"Bearer YOUR_GITHUB_PAT"}}'
```

**Option B — Local server (Docker):**

```bash
claude mcp add github \
  -e GITHUB_PERSONAL_ACCESS_TOKEN=YOUR_GITHUB_PAT \
  -- docker run -i --rm \
  -e GITHUB_PERSONAL_ACCESS_TOKEN \
  ghcr.io/github/github-mcp-server
```

After adding, restart Claude Code.

**Verify:**

```bash
claude mcp list
```

Then try listing repositories or reading a PR via MCP.

**Common issues:**

- **"Incompatible auth server: does not support dynamic client registration"** — you added the HTTP URL without a PAT. Remove with `claude mcp remove github` and re-add using one of the commands above with your PAT.
- If Docker pull fails, try `docker logout ghcr.io` and retry.
- Ensure your GitHub account has access to the repos you want to monitor.

---

## Notion (API Token — no MCP needed)

Notion uses a standalone script (`scripts/cache-notion.js`) instead of MCP.
The script calls the Notion API directly using `NOTION_TOKEN`.

**Prerequisites:** Node.js 18+ (uses built-in `fetch()`, no npm dependencies)

**Setup steps:**

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration.
2. Copy the integration token (starts with `ntn_` or `secret_`).
3. In Notion, grant the integration access to the pages/databases you want indexed (Share > Invite > select your integration).
4. Set the `NOTION_TOKEN` environment variable:

```bash
export NOTION_TOKEN=ntn_your_token_here
```

Add this to your shell profile (`.zshrc`, `.bashrc`) for persistence.

**Verify:**

```bash
NOTION_TOKEN=$NOTION_TOKEN node <plugin-dir>/scripts/cache-notion.js --config config.json --output .distill
```

**Common issues:**

- If pages aren't found, verify the integration has been granted access to those pages in Notion's sharing settings.
- The integration only sees pages it's been explicitly invited to.
