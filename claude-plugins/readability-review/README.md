# Readability Review Plugin

Automated readability review for pull requests using specialized agents with confidence-based scoring to filter false positives.

## Overview

The Readability Review Plugin automates pull request review by launching review agents in parallel to independently audit changes against your project's style guides. It uses confidence scoring to filter out false positives, ensuring only high-quality, actionable feedback is posted.

The plugin ships with RealXP Lab's Unity C# and shader style guides by default, but you can replace them with your own — the review engine is style-guide-agnostic.

## Installation

Add the marketplace and install the plugin:

```bash
# Add the marketplace
/plugin marketplace add realxp-lab/armory

# Install the plugin
/plugin install readability-review@realxp-lab-armory
```

Or test locally during development:

```bash
claude --plugin-dir ./claude-plugins/readability-review
```

## Commands

### `/readability-review`

Performs automated readability review on a pull request using specialized agents.

**What it does:**

1. Checks if review is needed (skips closed, draft, trivial, or already-reviewed PRs)
2. Classifies changed files and matches them to bundled style guides (skips file types with no matching guide)
3. Gathers relevant CLAUDE.md guideline files from the repository
4. Summarizes the pull request changes
5. Launches one agent per file-type bucket in parallel to independently review against the matching style guide
6. Scores each issue 0-100 for confidence level
7. Filters out issues below 80 confidence threshold
8. Posts review comment with high-confidence issues only

**Usage:**

```bash
/readability-review
/readability-review 42
/readability-review https://github.com/owner/repo/pull/42
```

**Example workflow:**

```bash
# On a PR branch, run:
/readability-review

# Claude will:
# - Classify changed files into buckets matching bundled style guides
# - Skip buckets with no files
# - Launch review agents in parallel
# - Score each issue for confidence
# - Post comment with issues ≥80 confidence
# - Skip posting if no high-confidence issues found
```

**Features:**

- Parallel review agents per file type for focused review
- Confidence-based scoring reduces false positives (threshold: 80)
- Style guide compliance checking with explicit rule verification
- CLAUDE.md compliance checking for project-level conventions
- Third-party code automatically skipped (vendor, package, and third-party directories)
- Automatic skipping of closed, draft, or already-reviewed PRs
- Links directly to code with full SHA and line ranges

**Review comment format:**

```markdown
### Readability review

Found 3 issues:

1. Private field missing underscore prefix (Unity C# style guide: "\_camelCase for private fields")

https://github.com/owner/repo/blob/abc123.../src/PlayerController.cs#L15-L18

2. Indentation uses 4 spaces instead of 2 (Unity Shader style guide: "Indent with 2 spaces")

https://github.com/owner/repo/blob/abc123.../shaders/Outline.shader#L42-L47

3. Missing XML summary on public method (CLAUDE.md says "Document all public APIs")

https://github.com/owner/repo/blob/abc123.../src/GameManager.cs#L88-L95
```

**Confidence scoring:**

- **0**: Not confident, false positive or pre-existing issue
- **25**: Somewhat confident, style guide is ambiguous on this point
- **50**: Moderately confident, real but low impact
- **75**: Highly confident, clear violation with readability impact
- **100**: Absolutely certain, unambiguous rule violation

**False positives filtered:**

- Third-party code (vendor, package, or third-party directories)
- Pre-existing issues not introduced in PR
- Issues linters or compilers will catch
- General quality issues (unless in style guides or CLAUDE.md)
- Issues silenced via lint ignore comments
- Ambiguous naming choices that could reasonably go either way

## Customization

The plugin ships with RealXP Lab's Unity C# and shader style guides by default. To use your own:

1. Replace the files in `skills/readability-review/references/` with your project's style guides
2. Update the "Bundled style guides" section in `skills/readability-review/SKILL.md` to list your files, file extensions, and descriptions

The review engine itself is style-guide-agnostic — it works with whatever guides you bundle.

## Best Practices

### Using `/readability-review`

- Maintain clear style guides in `references/` for better compliance checking
- Trust the 80+ confidence threshold — false positives are filtered
- Run on all non-trivial pull requests
- Review agent findings as a starting point for human review
- Update style guides based on recurring review patterns

### When to use

- All pull requests with meaningful code changes
- PRs touching critical code paths
- PRs from multiple contributors
- PRs where style guide compliance matters

### When not to use

- Closed or draft PRs (automatically skipped anyway)
- Trivial automated PRs (automatically skipped)
- PRs already reviewed (automatically skipped)
- PRs with no relevant source files (automatically skipped)

## Workflow Integration

### Standard PR review workflow:

```bash
# Create PR with changes
/readability-review

# Review the automated feedback
# Make any necessary fixes
# Merge when ready
```

### As part of CI/CD:

```bash
# Trigger on PR creation or update using anthropics/claude-code-action
# Automatically posts review comments
# Skip if review already exists
```

To post comments under a GitHub App identity, generate a token with `actions/create-github-app-token@v1` and pass it as `github_token`.

## Requirements

- Git repository with GitHub integration
- GitHub CLI (`gh`) installed and authenticated
- Style guides bundled in `skills/readability-review/references/`
- CLAUDE.md files (optional but recommended for project-level conventions)

## Troubleshooting

### Review takes too long

**Issue**: Agents are slow on large PRs

**Solution**:

- Normal for large changes — agents run in parallel
- Consider splitting large PRs into smaller ones

### Too many false positives

**Issue**: Review flags issues that aren't real

**Solution**:

- Default threshold is 80 (already filters most false positives)
- Make style guides more specific about what matters
- Check if third-party code paths need to be added to the exclusion list

### No review comment posted

**Issue**: `/readability-review` runs but no comment appears

**Solution**:
Check if:

- PR is closed (reviews skipped)
- PR is draft (reviews skipped)
- PR is trivial/automated (reviews skipped)
- PR already has review (reviews skipped)
- No relevant source files changed (reviews skipped)
- No issues scored ≥80 (no comment needed)

### Link formatting broken

**Issue**: Code links don't render correctly in GitHub

**Solution**:
Links must follow this exact format:

```
https://github.com/owner/repo/blob/[full-sha]/path/file.ext#L[start]-L[end]
```

- Must use full SHA (not abbreviated)
- Must use `#L` notation
- Must include line range with at least 1 line of context

### GitHub CLI not working

**Issue**: `gh` commands fail

**Solution**:

- Install GitHub CLI: `brew install gh` (macOS) or see [GitHub CLI installation](https://cli.github.com/)
- Authenticate: `gh auth login`
- Verify repository has GitHub remote

## Configuration

### Adjusting confidence threshold

The default threshold is 80. To adjust, modify `skills/readability-review/SKILL.md`:

```markdown
Filter out any issues with a score less than 80.
```

Change `80` to your preferred threshold (0-100).

## Technical Details

### Agent architecture

- **1x review agent per style guide**: One agent per file-type bucket, only launched if matching files changed
- **Nx confidence scorers**: One per issue for independent scoring
- **CLAUDE.md discovery**: Checks root and affected directories

### Scoring system

- Each issue independently scored 0-100
- Scoring considers evidence strength and verification
- Threshold (default 80) filters low-confidence issues
- For style guide issues: verifies the guide explicitly mentions the rule
- For CLAUDE.md issues: verifies the file explicitly calls it out

### GitHub integration

Uses `gh` CLI for:

- Viewing PR details and diffs
- Listing changed files
- Posting review comments

## Author

Jack Guo (jack@realxplab.com)

## Version

1.0.0
