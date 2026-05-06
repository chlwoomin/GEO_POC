---
name: implement-milestone
description: Execute one planned Ralph Loop milestone in this repository. Use when Codex is asked to implement a scoped milestone from ai/PLAN.md, make small reviewable changes, run validation, and prepare status updates without starting unrelated feature work.
---

# Implement Milestone

## Procedure

1. Read `AGENTS.md`, `ai/SPEC.md`, `ai/PLAN.md`, `ai/RUNBOOK.md`, `ai/STATUS.md`, and `ai/METRICS.json`.
2. Select exactly one active milestone. If none is active, select the first planned milestone that is safe to start.
3. Restate the milestone goal, done criteria, validation command, and safety limits.
4. Inspect the relevant files before editing.
5. Make the smallest useful change that advances the milestone.
6. Run `bash scripts/validate.sh`.
7. If validation fails, stop implementation work and use the `debug-failure` skill.
8. If validation passes, use the `review-diff` skill before status updates.
9. Use the `update-status` skill to record the result.

## Guardrails

- Do not start unrelated application features.
- Do not mix multiple milestones in one pass.
- Do not exceed the file or line-change limits in `ai/METRICS.json` without user approval.
- Split the milestone in `ai/PLAN.md` if it is too large to review comfortably.
- Preserve user changes and record blockers instead of forcing progress.
