# Update Status Prompt

Update workflow state after a loop pass.

Required updates:

- `ai/STATUS.md`: current milestone, validation result, blockers, next action, loop log.
- `ai/METRICS.json`: active milestone, retry counters, last validation status, last score.
- `ai/PLAN.md`: milestone status changes and any newly discovered work.

Keep status factual. Do not claim validation passed unless the command actually passed.
