# Troubleshooting Template

One topic = one file, topic-named. Append-only — new entries are added, existing entries are never modified.

## File Naming

`<topic>-troubleshooting.md` (e.g., `unity-troubleshooting.md`)

## Placement

`<project>/troubleshooting/`

## Frontmatter

```yaml
---
title: "<topic> Troubleshooting"
last_updated: YYYY-MM-DD
tags: [tag1, tag2]
---
```

## Body

```markdown
# <Topic> Troubleshooting

## <Problem Title>

**Symptoms:** <What the user observed.>
**Root cause:** <Why it happened.>
**Fix:** <What resolved it.>
**Prevention:** <How to avoid it in the future. Only include if discussed.>
**Found by:** <Who> on <YYYY-MM-DD> in <where>.

- Related: <Links to issues, PRs, docs if available.>
```

## Append Rules

- Each entry gets its own ## heading with a descriptive problem title.
- Include all fields: Symptoms, Root cause, Fix. Prevention is optional (only if discussed).
- Include who found it, when, and where the discussion happened.
- Include related links if available.
- Update `last_updated` in frontmatter when appending.
- Do not create duplicate entries for the same problem — if the same issue appears again with new information, append to the existing entry.
