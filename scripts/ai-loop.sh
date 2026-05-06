#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

printf 'Ralph Loop preflight\n'
printf 'Root: %s\n' "$ROOT"
printf 'Read: AGENTS.md ai/SPEC.md ai/PLAN.md ai/RUNBOOK.md ai/STATUS.md ai/METRICS.json\n'
printf '\n'

printf 'Running validation...\n'
if bash scripts/validate.sh; then
  printf '\nValidation passed. Review the diff with ai/prompts/review.md, then update status with ai/prompts/update-status.md.\n'
  bash scripts/score-result.sh
  exit 0
fi

printf '\nValidation failed. Use ai/prompts/debug.md or .codex/skills/debug-failure/SKILL.md.\n'
printf 'Stop after the retry limit in ai/METRICS.json unless the user approves more work.\n'
exit 1
