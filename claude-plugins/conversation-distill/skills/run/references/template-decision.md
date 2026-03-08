# Decision Template

One decision = one file, date-prefixed. Immutable — never edited, only superseded.

## File Naming

`YYYY-MM-DD-title-slug.md` (e.g., `2026-03-05-postgresql-user-service.md`)

## Placement

- Architectural decisions: `<project>/decisions/`
- Feature-scoped decisions: `<project>/decisions/<feature>/` (e.g., `<project>/decisions/settings-panel/`)

## Frontmatter

```yaml
---
title: "<decision title>"
status: accepted
date: YYYY-MM-DD
participants: [Name1, Name2]
tags: [tag1, tag2]
---
```

### Status Variants

- `accepted` — default for new decisions
- `rejected` — team explicitly decided NOT to do something ("We will NOT use X because Y")
- `deprecated` — no longer relevant but was once accepted
- `superseded by "<new-filename>"` — replaced by a newer decision

### Superseding Fields

When this decision supersedes an older one, add:

```yaml
supersedes: "<old-filename>"
```

Also update the old decision file's frontmatter status to:

```yaml
status: superseded by "<new-filename>"
```

## Body

```markdown
# <Decision Title>

## Context

<Why this decision was needed. Where it was discussed (channel, PR, etc.).>

## Decision

<What was decided, concisely.>

## Consequences

<Bullet list: benefits, trade-offs, risks.>

## Related

<Links to PRs, issues, tasks, or other decisions.>
```

## Notes

- Decisions are immutable once written. To reverse or update, create a new decision that supersedes the old one.
- For rejections, use the same template but with `status: rejected` and frame the Decision section as "We will NOT do X."
