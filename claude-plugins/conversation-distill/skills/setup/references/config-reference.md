# config.json Reference

Template and field documentation for the knowledge repo configuration file.

## Template

```json
{
  "discord_digest_channel_id": "",
  "channels": {
    "discord": {
      "server_id": ""
    },
    "github": {
      "repos": []
    },
    "notion": {
      "pages": []
    }
  }
}
```

## Fields

| Field                           | Type     | Default | Description                                                                               |
| ------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------- |
| `discord_digest_channel_id`     | string   | ""      | Discord channel ID where the daily digest is posted. Leave empty to skip Discord posting. |
| `channels.discord.server_id`    | string   | ""      | Discord server (guild) ID to monitor.                                                     |
| `channels.github.repos`         | string[] | []      | List of GitHub repos to monitor, in `org/repo` format.                                    |
| `channels.notion.pages`         | string[] | []      | Notion page IDs to cache. Empty = nothing cached. Page IDs are the 32-char hex string from the page URL. |

## Environment Variables

Store in `.env` at the repo root (gitignored). The cache script auto-loads this file.

| Variable       | Required for | Description                                                                 |
| -------------- | ------------ | --------------------------------------------------------------------------- |
| `NOTION_TOKEN` | Notion       | Notion integration token (starts with `ntn_` or `secret_`). Auto-loaded from `.env` by `scripts/cache-notion.js`. Not needed if Notion is not configured. |

## Notes

- Only include channel sections for channels the user wants to configure. For example, if only using Discord, omit the `github` and `notion` sections.
- The file must be named `config.json` and live at the repo root.
- `discord_digest_channel_id` requires the Discord MCP server to be configured.
- `pages` is required for Notion caching — if omitted or empty, the cache script does nothing.
- Notion uses a standalone script (`scripts/cache-notion.js`) which auto-loads `NOTION_TOKEN` from `.env`, not MCP.
