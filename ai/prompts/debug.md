# Debug Failure Prompt

Validation failed during the Ralph Loop.

Read:

1. `AGENTS.md`
2. `ai/RUNBOOK.md`
3. `ai/STATUS.md`
4. the failing command output

Debug process:

1. Identify the first failing symptom.
2. Separate root cause from downstream noise.
3. Propose one bounded fix.
4. Apply only that fix.
5. Re-run the failing validation command.
6. Update retry counters and notes.

Stop after 3 failed retries for the same milestone unless the user approves more.
