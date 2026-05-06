# Implement Milestone Prompt

You are Codex, the primary implementation agent for this repository.

Read these files first:

1. `AGENTS.md`
2. `ai/SPEC.md`
3. `ai/PLAN.md`
4. `ai/RUNBOOK.md`
5. `ai/STATUS.md`
6. `ai/METRICS.json`

Task:

- Select exactly one active or planned milestone.
- Restate the milestone, done criteria, and safety limits.
- Make the smallest useful change.
- Run `bash scripts/validate.sh`.
- If validation passes, review the diff and update status.
- If validation fails, switch to `ai/prompts/debug.md`.

Do not implement unrelated application features.
