# AI Workflow Runbook

## Quick Start

Run the workflow preflight:

```bash
bash scripts/ai-loop.sh
```

Run validation only:

```bash
bash scripts/validate.sh
```

Score the workflow scaffold:

```bash
bash scripts/score-result.sh
```

## Loop Procedure

### 1. Preflight

Read `AGENTS.md`, `ai/SPEC.md`, `ai/PLAN.md`, `ai/STATUS.md`, and `ai/METRICS.json`.

Confirm:

- active milestone
- done criteria
- safety limits
- known validation commands
- existing user changes
- whether git is available

### 2. Select One Milestone

Pick the active milestone. If none is active, pick the first planned milestone that is not blocked.

Do not start multiple milestones in one loop pass.

### 3. Implement A Small Change

Use `.codex/skills/implement-milestone/SKILL.md`.

Keep the diff focused. If the milestone is too large, split it in `ai/PLAN.md` before implementation.

### 4. Validate

Run:

```bash
bash scripts/validate.sh
```

If the project later defines its own checks, run them through `AI_VALIDATE_EXTRA` or encode safe checks in `scripts/validate.sh`.

### 5. Debug Failure

Use `.codex/skills/debug-failure/SKILL.md`.

Record:

- failing command
- first failing symptom
- suspected cause
- retry count
- next bounded fix

Stop after 3 retries for the same milestone unless the user approves more.

### 6. Review Diff

Use `.codex/skills/review-diff/SKILL.md`.

If git is available, inspect the git diff. If git is not available, inspect changed files directly.

Review for:

- requirement drift
- unrelated changes
- missing tests or validation
- risky edits
- status and metrics accuracy

### 7. Update Status

Use `.codex/skills/update-status/SKILL.md`.

Update:

- `ai/STATUS.md`
- `ai/METRICS.json`
- `ai/PLAN.md` if milestone status changed

### 8. Stop Safely

Stop when:

- milestone done criteria are met
- validation passes and status is updated
- safety limits are reached
- a blocker needs user input

## Claude Code Interop

Claude Code is optional. It must not be required for the default Codex loop.

Use Claude review only when the workspace is a git repository and the user has provided the required Anthropic environment:

```bash
python3 scripts/claude_review.py
```

Install the optional post-commit hook only on request:

```bash
bash scripts/setup_hooks.sh
```

`REVIEW.md` is advisory output. Codex remains responsible for final diff review and status updates.
