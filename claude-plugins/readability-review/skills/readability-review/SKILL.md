---
name: readability-review
description: This skill should be used when the user asks to "check readability", "run a style check", "audit code quality", or "readability review". Also trigger when the user mentions "style guide check" or "readability" in the context of code that has bundled style guides in the references/ directory. Provides parallel review agents, confidence scoring, and false positive filtering.
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh pr comment:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(gh pr list:*)
argument-hint: "[pr-number-or-url]"
disable-model-invocation: false
---

Review pull request $ARGUMENTS for readability and style guide compliance.

If no PR number or URL is provided, detect the current branch's open PR using `gh pr view`.

## Bundled style guides

The style guides are bundled in the `references/` directory alongside this SKILL.md file. Each entry
maps file extensions to a guide. Only load guides for file types present in the PR (step 4).

- `references/unity-csharp-style-guide.md` — covers `.cs` files (Unity C# conventions: naming, whitespace, organization, inspector attributes, coding guidelines)
- `references/unity-shader-style-guide.md` — covers `.shader`, `.hlsl`, `.cginc`, `.compute` files (Unity shader conventions: naming, whitespace, SRP Batcher compatibility, keywords, performance)

> **Customization**: Replace or add style guides for your project. Each guide should specify which
> file extensions it covers. Update the list above to match, and the review agents will use them.

## Steps

To do this, follow these steps precisely:

1. Use a Haiku agent to check if the pull request (a) is closed, (b) is a draft, (c) does not need a readability review (eg. because it is an automated pull request, or contains no relevant source files), or (d) already has a readability review from you from earlier (look for a comment containing "🤖 Generated with"). If so, do not proceed.
2. Use a Haiku agent to classify the changed files. Run `gh pr diff <number> --name-only` and split into buckets by file extension, matching against the bundled style guides listed above. If no changed files match any guide, do not proceed.
3. Use a Haiku agent to view the pull request, and ask the agent to return a summary of the change
4. Read the bundled style guides for the file types present (see "Bundled style guides" above). Also use a Haiku agent to give you a list of file paths to (but not the contents of) any relevant CLAUDE.md files from the codebase: the root CLAUDE.md file (if one exists), as well as any CLAUDE.md files in the directories whose files the pull request modified. Then, launch one Sonnet agent per file-type bucket in parallel — skip any bucket with no files. Each agent reviews only its file types against the matching style guide and any CLAUDE.md files, returning a list of issues with the violated rule cited. CLAUDE.md is guidance for Claude as it writes code, so not all instructions will be applicable — but agents should check for project-level conventions it specifies. Focus on clear style guide violations; avoid ambiguous naming calls and likely false positives. Ignore third-party code — only review code written by the team. Files under vendor, package, or third-party directories should be skipped entirely. Third-party code will follow its own conventions which differ from your style guide — that's expected, not a violation. If a style guide calls out rules with runtime impact, pay special attention to those.
5. For each issue found in #4, launch a parallel Haiku agent that takes the PR, issue description, the relevant style guide, and list of CLAUDE.md files (from step 4), and returns a score to indicate the agent's level of confidence for whether the issue is real or false positive. To do that, the agent should score each issue on a scale from 0-100, indicating its level of confidence. For issues that were flagged due to style guide rules, the agent should double check that the style guide actually calls out that issue specifically. For issues that were flagged due to CLAUDE.md instructions, the agent should double check that the CLAUDE.md actually calls out that issue specifically. The scale is (give this rubric to the agent verbatim):
   a. 0: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
   b. 25: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant style guide or CLAUDE.md.
   c. 50: Moderately confident. The agent was able to verify this is a real issue, but it may not happen very often in practice. Relative to the rest of the PR, it's not very important.
   d. 75: Highly confident. The agent double checked the issue, and verified that it is very likely it is a real issue that will be hit in practice. The existing approach in the PR is insufficient. The issue is very important and will directly impact the code's readability, or it is an issue that is directly mentioned in the relevant style guide or CLAUDE.md.
   e. 100: Absolutely certain. The agent double checked the issue, and confirmed that it is definitely a real issue, that will happen frequently in practice. The evidence directly confirms this.
6. Filter out any issues with a score less than 80. If there are no issues that meet this criteria, do not proceed.
7. Use a Haiku agent to repeat the eligibility check from #1, to make sure that the pull request is still eligible for review.
8. Finally, use the gh bash command to comment back on the pull request with the result. When writing your comment, keep in mind to:
   a. Keep your output brief
   b. Avoid emojis
   c. Link and cite relevant code, files, and URLs
   d. Cite the specific style guide rule or CLAUDE.md instruction for each issue

Examples of false positives, for steps 4 and 5:

- Third-party code: anything under vendor, package, or third-party directories. These follow their own conventions which differ from your style guide — skip them entirely.
- Pre-existing issues
- General code quality issues (eg. lack of test coverage, general security issues, poor documentation), unless explicitly required in the style guides or CLAUDE.md
- Issues that are called out in the style guides or CLAUDE.md, but explicitly silenced in the code (eg. due to a lint ignore comment)
- Real issues, but on lines that the user did not modify in their pull request
- Naming choices that are ambiguous and could reasonably go either way

Notes:

- Do not check build signal or attempt to build or typecheck the app. These will run separately, and are not relevant to your readability review.
- Use `gh` to interact with Github (eg. to fetch a pull request, or to create inline comments), rather than web fetch
- Make a todo list first
- You must cite and link each issue (eg. if referring to a style guide section, you must quote the specific rule; if referring to a CLAUDE.md, you must link it)
- For your final comment, follow the following format precisely (assuming for this example that you found 3 issues):

---

### Readability review

Found 3 issues:

1. <brief description of issue> (<style guide name>: "<relevant rule>")

<link to file and line with full sha1 + line range for context, note that you MUST provide the full sha and not use bash here, eg. https://github.com/anthropics/claude-code/blob/1d54823877c4de72b2316a64032a54afc404e619/README.md#L13-L17>

2. <brief description of issue> (<style guide name>: "<relevant rule>")

<link to file and line with full sha1 + line range for context>

3. <brief description of issue> (CLAUDE.md says "<...>")

<link to file and line with full sha1 + line range for context>

🤖 Generated with [Claude Code](https://claude.ai/code)

<sub>- If this readability review was useful, please react with 👍. Otherwise, react with 👎.</sub>

---

- Or, if you found no issues:

---

### Readability review

No issues found. Checked for style guide compliance.

🤖 Generated with [Claude Code](https://claude.ai/code)

---

- When linking to code, follow the following format precisely, otherwise the Markdown preview won't render correctly: https://github.com/anthropics/claude-cli-internal/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15
  - Requires full git sha
  - You must provide the full sha. Commands like `https://github.com/owner/repo/blob/$(git rev-parse HEAD)/foo/bar` will not work, since your comment will be directly rendered in Markdown.
  - Repo name must match the repo you're reviewing
  - # sign after the file name
  - Line range format is L[start]-L[end]
  - Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if you are commenting about lines 5-6, you should link to `L4-7`)
