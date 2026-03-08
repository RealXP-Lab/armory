# Scoring Rubric

Score each item on a 0-100 scale indicating confidence that it represents valuable, novel knowledge worth capturing.

## Score Scale

| Score  | Meaning                                                                                          | Examples                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 90-100 | Clear, actionable, novel knowledge. Unambiguous decision, process change, or fix with consensus. | "We decided to use X because Y" with team agreement. Clear process change with steps. Real incident with confirmed root cause and fix. |
| 70-89  | Likely valuable but somewhat ambiguous or incremental.                                           | Informal agreement without explicit consensus. Useful tip without strong context. Minor process tweak.                                 |
| 40-69  | Uncertain value. Might be noise, might be worth capturing.                                       | Suggestion without clear resolution. Vague resource share. Partial troubleshooting without confirmed fix.                              |
| 0-39   | Not knowledge. Noise, social chat, already captured, or restates existing docs.                  | Greetings, scheduling. Duplicate of existing content. Opinion without discussion.                                                      |

## Scoring Factors

Consider these factors when assigning a score:

- **Clarity**: Is the item unambiguous? Can someone act on it without further clarification?
- **Consensus**: Did the team agree, or is this one person's statement?
- **Novelty**: Is this new information, or does it repeat what's already captured?
- **Completeness**: Does the item contain enough context to stand alone?
- **Actionability**: Can someone use this information directly?

## Conflict Detection

After scoring, evaluate each item against its QMD matches to detect conflicts:

### `captured_conflict`

Set when a high-similarity QMD `captured` match exists AND the new item contains information that **contradicts** the existing captured document. Examples:

- Existing decision says "use X", new item says "stop using X" (this is a superseding decision, not a conflict — but flag it for review)
- Existing process doc says "do A then B", new item says "do B then A"

### `authored_stale`

Set when a QMD `authored` match exists AND the new item's information **conflicts with or updates** the authored document. Examples:

- Authored doc says "use 1 approval", team discussion says "now require 2 approvals"
- Authored doc describes a process that the team has clearly changed

Return a `stale_detail` string that contrasts the two positions: `"doc says <what the authored doc states>, team now <what the new item says>"`. Only required when conflict is `authored_stale`.

### `none`

No conflict detected. The item is novel or consistent with existing docs.

## Routing Rules

| Score        | Conflict          | Action                                                       |
| ------------ | ----------------- | ------------------------------------------------------------ |
| >= threshold | none              | Publish normally                                             |
| >= threshold | captured_conflict | Publish with `status: needs-review`, note conflict in digest |
| >= threshold | authored_stale    | Publish normally, flag authored doc as stale in digest       |
| < threshold  | any               | Discard                                                      |

The confidence threshold is 80.
