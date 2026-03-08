# Extraction Rules

False positive checklist for extraction subagents. Apply these rules when deciding whether a conversation segment contains extractable knowledge.

## Do NOT Extract

- **Inconclusive discussions**: "We should probably..." or "Maybe we could..." without a clear resolution or agreement.
- **Bare links**: Links shared without context ("check this out") or explanation of why they're useful.
- **Action items without decision context**: Task assignments and to-dos belong in task trackers, not knowledge docs. Only extract if there's a decision or rationale behind the action.
- **Hypotheticals and brainstorming**: Exploration and ideation that didn't lead to a conclusion or commitment.
- **Social conversation**: Greetings, scheduling, emoji reactions, jokes, off-topic banter.
- **Bug reports without resolution**: Unresolved bugs are GitHub issues, not knowledge. Only extract if there's a confirmed root cause and fix.
- **Restated existing knowledge**: If someone is just repeating what's already documented, it's not new knowledge. (Note: duplication detection against existing docs is handled by the scorer in Step 5 — this rule covers obvious re-statements within the conversation itself.)
- **Single-person opinions without team response**: One person's preference stated without agreement or discussion from others.
- **Bot-generated summaries and digests**: AI-generated meeting summaries, automated digests, or bot-produced "key takeaways". These are lossy re-interpretations, not primary source material. If a bot summary mentions a decision, only extract if the same information is confirmed by human participants in the conversation.

## DO Extract

- **Clear decisions with rationale**: "We decided X because Y" with visible team agreement or consensus.
- **Process changes**: "From now on, we do X" or "We're changing the process to..." with explanation.
- **Shared resources with context**: Links, tools, libraries, or patterns shared with explanation of why they're useful, who benefits, and when to use them.
- **Problem-solution pairs**: Real incidents where someone hit a problem, identified the root cause, and found a fix. Must have both problem and solution.
- **Rejections with rationale**: "We explicitly decided NOT to do X because Y" — these are decisions too.
- **Process corrections**: "Actually, the right way to do X is..." when correcting a common mistake.

## Classification Guide

- **decision**: A choice was made between alternatives, with rationale. Includes rejections.
- **process**: How something should be done going forward. Steps, workflows, procedures.
- **resource**: Something shared that others can reference — tools, links, patterns, tips.
- **troubleshooting**: A problem encountered and solved. Must have symptoms + root cause + fix.

## Content Preservation

When extracting, preserve all relevant detail from the original conversation. Clean up noise (filler words, tangents) but do not summarize or condense the substance. The `content` field should contain everything needed to understand the decision/process/resource/fix without going back to the original conversation.
