---
name: update-status
description: Update AI workflow status and metrics after a Ralph Loop pass. Use after implementation, validation, debugging, or diff review to keep ai/STATUS.md, ai/METRICS.json, and ai/PLAN.md accurate.
---

# Update Status

## Procedure

1. Update `ai/STATUS.md` with current milestone, validation command, result, blockers, and next action.
2. Update `ai/METRICS.json` with last validation status, last score, retry counters, and active milestone.
3. Update `ai/PLAN.md` when a milestone moves between `planned`, `active`, `done`, or `blocked`.
4. Keep timestamps concrete and include timezone when human-readable.
5. Do not claim validation passed unless the command actually passed.
6. Keep status entries concise enough to scan.

## Metrics Rules

- Increment `attempts_total` after each meaningful loop pass.
- Increment `validation_failures_total` only for failed validation commands.
- Reset `debug_retries_current_milestone` when a milestone is completed or a new milestone starts.
- Set `validation.last_score` from `scripts/score-result.sh` when available.
