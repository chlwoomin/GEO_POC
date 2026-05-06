---
name: review-diff
description: Review AI-generated repository diffs after validation and before status updates. Use when a Ralph Loop pass has produced changes that need Codex-led risk review, requirement alignment checks, validation confirmation, and next-action notes. Claude review is optional advisory input only.
---

# Review Diff

## Procedure

1. Identify the selected milestone and its done criteria from `ai/PLAN.md`.
2. Inspect the diff with git when available. If git is unavailable, inspect the changed files directly.
3. Confirm validation was run and record the command result.
4. Check for unrelated changes, accidental rewrites, secrets, generated noise, or excessive scope.
5. Check that docs, status, and metrics match the actual result.
6. Optionally read `REVIEW.md` if the user requested Claude review and it exists.
7. Report findings first, ordered by severity.
8. If there are no findings, state that clearly and list remaining risks or test gaps.

## Review Checklist

- Requirement alignment: the diff advances only the selected milestone.
- Validation integrity: commands were run and results are not overstated.
- Safety: no destructive, secret, or unrelated edits.
- Maintainability: no unnecessary abstraction or stale compatibility text.
- Status accuracy: `ai/STATUS.md`, `ai/METRICS.json`, and `ai/PLAN.md` are consistent.
- Interop: Claude-specific files do not override Codex workflow rules.
