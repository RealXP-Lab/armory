# Digest Format

Template for the daily digest. Used as both the git commit message and the Discord notification.

## Template

```
Daily Digest (YYYY-MM-DD)

Auto-committed:
- [check] Updated: `<path>` -- <one-line summary>
- [check] New: `<path>` -- <one-line summary>

Committed -- needs review:
- [warning] Conflict: `<path>` -- <brief conflict description>

Stale docs detected:
- [doc] <title> (<url>) -- doc says "<current doc position>", team now <new position from conversation>

Errors:
- [error] <channel>: <error description>

Stats: N messages processed across N channels. N docs updated, N new, N needs-review, N stale.
```

## Rules

- **Auto-committed**: List all files that were written or updated without conflicts.
- **Committed -- needs review**: List files with `status: needs-review` due to captured_conflict. Include a brief description of what conflicts.
- **Stale docs detected**: List authored docs where the team's discussion contradicts or updates the authored content. Include the Notion URL and use the contrastive format: `doc says "<current doc position>", team now <new position>`. Use the `stale_detail` string from the scorer output.
- **Errors**: List any channels that failed during ingestion (MCP call failures, timeouts).
- **Stats**: Summary counts of messages processed, channels used, and document actions.

## Section Omission

Omit any section that has no entries. For example, if there are no errors, omit the "Errors:" section entirely.

## Transcript Mode

When processing a meeting transcript instead of daily channels:

```
conversation-distill -- Transcript Digest (YYYY-MM-DD)

Source: <transcript file path>

Auto-committed:
...
```

Replace "Daily Digest" with "Transcript Digest" and add a "Source:" line with the transcript file path. Omit the "Stats" line about channels processed.
