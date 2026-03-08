# Resource Template

One topic = one file, topic-named. Append-only — new entries are added, existing entries are never modified.

## File Naming

`<topic>-resources.md` (e.g., `frontend-resources.md`)

## Placement

`<project>/resources/`

## Frontmatter

```yaml
---
title: "<topic> Resources"
last_updated: YYYY-MM-DD
tags: [tag1, tag2]
---
```

## Body

```markdown
# <Topic> Resources

## <Subtopic Heading>

### <Resource Title>

Shared by <who> on <YYYY-MM-DD> in <where>. <Why it's useful — context from the conversation.>

- Link: <URL if available>
```

## Append Rules

- Group entries under subtopic headings (## level).
- Each entry gets its own ### heading with a descriptive title.
- Include: what was shared, who shared it, when, where (channel/PR), and why it's useful.
- Include a link if one was shared.
- Update `last_updated` in frontmatter when appending.
- Add new subtopic headings as needed. Do not create duplicate subtopics — append under existing headings when the subtopic matches.
