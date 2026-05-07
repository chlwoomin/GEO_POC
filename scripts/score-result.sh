#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

score=100
issues=0

penalize() {
  issues=$((issues + 1))
  score=$((score - "$1"))
}

for path in AGENTS.md CLAUDE.md ai/SPEC.md ai/PLAN.md ai/RUNBOOK.md ai/STATUS.md ai/METRICS.json scripts/validate.sh scripts/claude-review-gate.sh scripts/claude-code-review.sh scripts/watch-claude-gate.sh scripts/dashboard.js scripts/geo-score.py scripts/geo-dashboard.js; do
  [ -f "$path" ] || penalize 10
done

for path in .codex/skills/implement-milestone/SKILL.md .codex/skills/review-diff/SKILL.md .codex/skills/debug-failure/SKILL.md .codex/skills/update-status/SKILL.md; do
  [ -f "$path" ] || penalize 10
done

if [ -f ai/METRICS.json ]; then
  if command -v node >/dev/null 2>&1; then
    node -e "JSON.parse(require('fs').readFileSync('ai/METRICS.json', 'utf8'))" >/dev/null 2>&1 || penalize 20
  elif command -v python3 >/dev/null 2>&1; then
    python3 -m json.tool ai/METRICS.json >/dev/null 2>&1 || penalize 20
  fi
fi

if grep -R '\[TODO:' .codex/skills >/dev/null 2>&1; then
  penalize 15
fi

for path in ai/agents.md ai/claude.md ai/PROMPT.md; do
  [ ! -e "$path" ] || penalize 10
done

if grep -q 'optional advisory' AGENTS.md 2>/dev/null; then
  penalize 20
fi

if grep -q 'optional advisory' .codex/skills/review-diff/SKILL.md 2>/dev/null; then
  penalize 20
fi

if ! grep -q 'scripts/claude-review-gate.sh' AGENTS.md 2>/dev/null; then
  penalize 20
fi

if ! grep -q 'Claude Code CLI' AGENTS.md 2>/dev/null; then
  penalize 20
fi

if ! grep -q 'watch-claude-gate.sh' scripts/dashboard.js 2>/dev/null; then
  penalize 10
fi

if ! grep -q '/api/snapshot' scripts/dashboard.js 2>/dev/null; then
  penalize 10
fi

if ! grep -q 'critical_failures' scripts/geo-score.py 2>/dev/null; then
  penalize 10
fi

if ! grep -q 'scoreWithJsFallback' scripts/geo-dashboard.js 2>/dev/null; then
  penalize 10
fi

if ! grep -q 'persona' scripts/geo-score.py 2>/dev/null; then
  penalize 10
fi

if ! grep -q -- '--mode prod' scripts/validate.sh 2>/dev/null; then
  penalize 10
fi

if [ "$score" -lt 0 ]; then
  score=0
fi

status="pass"
if [ "$score" -lt 90 ]; then
  status="warn"
fi

printf '{"score":%s,"status":"%s","issues":%s,"checked_at":"%s"}\n' "$score" "$status" "$issues" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
