# GitHub Extraction Instructions

Instructions for the GitHub extraction subagent.

## Fetching Content

For each repo in `config.json` channels.github.repos:

1. **Pull request comments**: Fetch PR review comments and issue-style comments on PRs updated since the cursor's `since` timestamp. Use the `since` parameter to filter by `updated_at`.
2. **Issue comments**: Fetch issue comments updated since the cursor's `since` timestamp.
3. **Discussions** (if available): Fetch discussion comments similarly.

## Deduplication

The `since` parameter filters by `updated_at`, so edited comments will reappear in subsequent fetches. Deduplicate by comment ID — if a comment ID was already processed (check against items from this batch), skip it.

## Extraction

For each comment or thread, apply the extraction rules (from extraction-rules.md). Include the PR/issue title and number for context. For each extracted item, produce:

```json
{
  "type": "decision | process | resource | troubleshooting",
  "title": "<concise title>",
  "content": "<full detail, cleaned but not summarized>",
  "participants": ["<GitHub usernames involved>"],
  "source_channel": "github:<org/repo>:<pulls|issues>",
  "date": "YYYY-MM-DD",
  "tags": ["<relevant tags>"]
}
```

## Cursor Update

Return the new `since` timestamp: the latest `updated_at` from this batch, per repo and type.

```json
{
  "items": [...],
  "new_cursors": {
    "github:<org/repo>:pulls": { "since": "<latest updated_at ISO>" },
    "github:<org/repo>:issues": { "since": "<latest updated_at ISO>" }
  }
}
```

## Notes

- Include PR/issue title and number in the `content` field for context.
- Use the repo's full name (org/repo) in `source_channel`.
- Only extract from comment bodies, not from PR descriptions or issue bodies (those are authored content, not conversation).
