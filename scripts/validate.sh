#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

failures=0

check_file() {
  if [ -f "$1" ]; then
    printf 'ok file %s\n' "$1"
  else
    printf 'missing file %s\n' "$1"
    failures=$((failures + 1))
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    printf 'ok dir  %s\n' "$1"
  else
    printf 'missing dir  %s\n' "$1"
    failures=$((failures + 1))
  fi
}

required_files="
AGENTS.md
CLAUDE.md
ai/SPEC.md
ai/PLAN.md
ai/RUNBOOK.md
ai/STATUS.md
ai/METRICS.json
ai/prompts/implement.md
ai/prompts/review.md
ai/prompts/debug.md
ai/prompts/update-status.md
ai/prompts/final-report.md
scripts/ai-loop.sh
scripts/validate.sh
scripts/score-result.sh
.codex/config.toml
.codex/skills/implement-milestone/SKILL.md
.codex/skills/review-diff/SKILL.md
.codex/skills/debug-failure/SKILL.md
.codex/skills/update-status/SKILL.md
"

required_dirs="
ai/prompts
scripts
.codex/skills
"

forbidden_files="
ai/agents.md
ai/claude.md
ai/PROMPT.md
"

for path in $required_dirs; do
  check_dir "$path"
done

for path in $required_files; do
  check_file "$path"
done

for path in $forbidden_files; do
  if [ -e "$path" ]; then
    printf 'forbidden legacy file %s\n' "$path"
    failures=$((failures + 1))
  fi
done

if [ -f "ai/archive/PROMPT.legacy.md" ]; then
  printf 'ok archive ai/archive/PROMPT.legacy.md\n'
fi

for skill in .codex/skills/*/SKILL.md; do
  [ -e "$skill" ] || continue
  if grep -q '\[TODO:' "$skill"; then
    printf 'todo placeholder found in %s\n' "$skill"
    failures=$((failures + 1))
  fi
  if ! awk 'NR==1 { ok = ($0 == "---") } NR==2 { ok = ok && ($0 ~ /^name: [a-z0-9-]+$/) } NR==3 { ok = ok && ($0 ~ /^description: .+/) } NR==4 { ok = ok && ($0 == "---") } END { exit ok ? 0 : 1 }' "$skill"; then
    printf 'invalid skill frontmatter in %s\n' "$skill"
    failures=$((failures + 1))
  else
    printf 'ok skill %s\n' "$skill"
  fi
done

if grep -q 'post-commit hook will automatically invoke Claude' AGENTS.md 2>/dev/null; then
  printf 'invalid AGENTS.md: Claude hook is mandatory\n'
  failures=$((failures + 1))
fi

if grep -q 'Runs the Claude review pipeline' .codex/skills/review-diff/SKILL.md 2>/dev/null; then
  printf 'invalid review-diff skill: Claude review is mandatory\n'
  failures=$((failures + 1))
fi

for script in scripts/*.sh; do
  [ -e "$script" ] || continue
  if command -v bash >/dev/null 2>&1; then
    bash -n "$script" || failures=$((failures + 1))
  fi
done

if command -v python3 >/dev/null 2>&1 && [ -f scripts/claude_review.py ]; then
  python3 -m py_compile scripts/claude_review.py || failures=$((failures + 1))
fi

if command -v node >/dev/null 2>&1; then
  if node -e "JSON.parse(require('fs').readFileSync('ai/METRICS.json', 'utf8'))" >/dev/null 2>&1; then
    printf 'ok json ai/METRICS.json\n'
  else
    printf 'invalid json ai/METRICS.json\n'
    failures=$((failures + 1))
  fi
elif command -v python3 >/dev/null 2>&1; then
  if python3 -m json.tool ai/METRICS.json >/dev/null 2>&1; then
    printf 'ok json ai/METRICS.json\n'
  else
    printf 'invalid json ai/METRICS.json\n'
    failures=$((failures + 1))
  fi
else
  printf 'warn no node or python3 found; skipped json parse\n'
fi

if [ -f package.json ] && command -v node >/dev/null 2>&1; then
  package_scripts="$(node -e "const p=require('./package.json'); console.log(['lint','typecheck','test','build'].filter((k)=>p.scripts && p.scripts[k]).join(' '))")"
  for script_name in $package_scripts; do
    if command -v pnpm >/dev/null 2>&1; then
      pnpm run "$script_name" || failures=$((failures + 1))
    elif command -v npm >/dev/null 2>&1; then
      npm run "$script_name" || failures=$((failures + 1))
    else
      printf 'warn package.json has %s but no pnpm or npm is available\n' "$script_name"
    fi
  done
else
  printf 'info no package.json checks discovered\n'
fi

if [ -n "${AI_VALIDATE_EXTRA:-}" ]; then
  printf 'running extra validation: %s\n' "$AI_VALIDATE_EXTRA"
  if ! sh -lc "$AI_VALIDATE_EXTRA"; then
    failures=$((failures + 1))
  fi
fi

if [ "$failures" -eq 0 ]; then
  printf 'validation passed\n'
  exit 0
fi

printf 'validation failed with %s issue(s)\n' "$failures"
exit 1
