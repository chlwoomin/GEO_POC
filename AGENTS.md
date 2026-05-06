# AGENTS.md

This repository uses a Codex-first Ralph Loop workflow: specify clearly, implement one milestone, validate, debug if needed, review the diff, update status, and stop at a safe boundary.

## Source Of Truth

Read these files before implementation work, in this order:

1. `AGENTS.md`
2. `ai/SPEC.md`
3. `ai/PLAN.md`
4. `ai/RUNBOOK.md`
5. `ai/STATUS.md`
6. `ai/METRICS.json`

Archived files under `ai/archive/` are historical context only. Do not treat them as active instructions.

## Agent Rules

- Use Codex as the primary implementation agent.
- Work on exactly one milestone from `ai/PLAN.md` at a time.
- Keep changes small enough for a human diff review.
- Do not implement application features until a milestone explicitly authorizes feature work.
- Prefer existing project conventions over new abstractions.
- Preserve user changes and never revert unrelated edits.
- Record blockers in `ai/STATUS.md` instead of forcing risky progress.
- Update `ai/METRICS.json` after each meaningful loop pass.
- Treat Claude Code output as optional advisory review unless the user explicitly makes it blocking.

## Ralph Loop

1. Read the source-of-truth files.
2. Select the next active or planned milestone.
3. State the planned change and safety limits.
4. Make a small, reviewable change.
5. Run `bash scripts/validate.sh`.
6. If validation fails, use `.codex/skills/debug-failure/SKILL.md`, retry within limits, and log the failure.
7. If validation passes, review the diff with `.codex/skills/review-diff/SKILL.md`.
8. Update `ai/STATUS.md` and `ai/METRICS.json`.
9. Stop when done criteria or safety limits are reached.

## Validation

Default validation command:

```bash
bash scripts/validate.sh
```

Optional project-specific checks can be added per run:

```bash
AI_VALIDATE_EXTRA="pnpm test && pnpm build" bash scripts/validate.sh
```

Use `scripts/score-result.sh` for a lightweight workflow-health score after validation.

## Safety Limits

- Maximum debug retries per milestone: 3
- Maximum changed files per loop: 8 unless the user approves more.
- Maximum changed lines per loop: 400 unless the user approves more.
- Stop immediately on unclear requirements, destructive operations, secret exposure, or validation failures that require a design change.

## Claude Code Interop

Claude Code may participate as an optional secondary reviewer, but it must follow this same workflow and treat `AGENTS.md` plus the `ai/` files as authoritative.

Claude automation is not part of the default loop. Use it only when all of these are true:

- the workspace is a git repository
- the user wants Claude review
- `ANTHROPIC_API_KEY` is set
- the `anthropic` Python package is installed

Optional commands:

```bash
python3 scripts/claude_review.py
bash scripts/setup_hooks.sh
```

Do not maintain separate Claude-specific plans.
