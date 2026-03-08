# Discord Extraction Instructions

Instructions for the Discord extraction subagent.

## Fetching Messages

1. List all text channels in the server using the Discord MCP `list_channels` tool.
2. For each text channel, fetch recent messages using `read_messages` with `channelId` and `count`.
   - The Discord MCP tool only accepts `channelId` and `count` — there is no `after` parameter.
   - Filter client-side: compare each message's ID to the cursor (`last_message_id`). Discord snowflake IDs are chronologically sortable integers — only process messages with IDs greater than the cursor.
   - If no cursor exists for a channel (new channel), fetch messages from the last 14 days (filter by timestamp).
3. For each message with a thread, fetch the full thread context using `read_thread` or equivalent.

## Bot Message Handling

- **Skip bot message text for extraction.** Bot status messages ("Recording started"), AI-generated summaries, automated digests, and operational noise are not primary source material. Identify bots from message metadata (the `bot` flag, or `[BOT]` tags) and context (e.g., known bot usernames like Otter, Fireflies, MEE6).
- **Still collect file attachments from bot messages** — see File Attachments section below.
- **Never filter human messages** — only bot message *text* is skipped for extraction.
- **Cursor advancement**: The cursor must advance past ALL messages including skipped bot messages. The `new_cursors` value reflects the latest message ID seen, regardless of whether that message was from a bot.

## File Attachments

When **any message** (bot or human) has a `.txt` file attachment, record the attachment metadata in the `file_attachments` array in the return value. This enables the main agent to spawn file-processing subagents.

- Include context so the file-processing subagent can assess relevance:
  - The message text (what the author said about the file)
  - Author name and whether they are a bot
  - Channel name and ID
- Do **NOT** download or read the file content — that is the file-processing subagent's job.
- Human messages with attachments are still extracted normally for their **text content**; the attachment is collected *in addition* to any text-based extraction.

## Extraction

For each message or thread, apply the extraction rules (from extraction-rules.md) to identify knowledge items. For each extracted item, produce:

```json
{
  "type": "decision | process | resource | troubleshooting",
  "title": "<concise title>",
  "content": "<full detail from the conversation, cleaned but not summarized>",
  "participants": ["<usernames involved>"],
  "source_channel": "discord:<channel-name>",
  "date": "YYYY-MM-DD",
  "tags": ["<relevant tags>"]
}
```

## Cursor Update

Return the new cursor value: the latest message ID from this batch, per channel.

```json
{
  "items": [...],
  "new_cursors": {
    "discord:<channel_id>": {
      "last_message_id": "<latest message ID>",
      "last_message_ts": "<latest message timestamp ISO>"
    }
  },
  "file_attachments": [
    {
      "url": "https://cdn.discordapp.com/attachments/.../filename.txt",
      "filename": "meeting-notes.txt",
      "author": "Alice",
      "is_bot": false,
      "message_text": "Here are the notes from today's standup",
      "channel_name": "engineering",
      "channel_id": "123456789",
      "message_id": "987654321",
      "date": "YYYY-MM-DD"
    }
  ]
}
```

## Limitation: No Attachment Content from MCP

The Discord MCP server does not return file attachment contents — only message text and metadata. Attachment URLs, filenames, and surrounding context are not available through the MCP tools.

**Workaround:** Users download `.txt` files manually and process them with `/conversation-distill:run path/to/file.txt`.

## Notes

- Extract channel name (not ID) for the `source_channel` field for readability.
- Include the channel ID in cursor keys (IDs are stable; names can change).
- Preserve full context from threads — don't truncate conversation chains.
