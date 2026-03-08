# Process Template

One process = one file, topic-named. Updated in place when the process changes.

## File Naming

`<process-name>.md` (e.g., `deployment-process.md`)

## Placement

`<project>/process/`

## Frontmatter

```yaml
---
title: "<process name>"
last_updated: YYYY-MM-DD
tags: [tag1, tag2]
---
```

## Body

```markdown
# <Process Name>

## Steps

1. <Step 1>
2. <Step 2>
3. <Step 3>

## Rollback

<Only include if rollback was discussed. How to undo or revert.>

## Prerequisites

<Only include if prerequisites were discussed. What's needed before starting.>

## Change Log

- **YYYY-MM-DD:** <What changed>. Discussed in <where>.
```

## Update Rules

- When updating an existing process doc, modify the Steps section to reflect the current process.
- Always add a Change Log entry with the date, what changed, and where it was discussed.
- Update the `last_updated` frontmatter field.
- Rollback and Prerequisites sections are only included when those topics were discussed. Do not add empty sections.
