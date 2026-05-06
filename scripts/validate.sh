#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

failures=0

# Resolve working Python interpreter (python3 may be a stub on Windows)
ENV_PYTHON="${PYTHON:-}"
PYTHON=""
if [ -n "${GEO_PYTHON:-}" ] && "$GEO_PYTHON" -c "import sys; sys.exit(0)" 2>/dev/null; then
  PYTHON="$GEO_PYTHON"
elif [ -n "$ENV_PYTHON" ] && "$ENV_PYTHON" -c "import sys; sys.exit(0)" 2>/dev/null; then
  PYTHON="$ENV_PYTHON"
elif [ -n "${USERPROFILE:-}" ] && [ -f "$USERPROFILE/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" ] && "$USERPROFILE/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" -c "import sys; sys.exit(0)" 2>/dev/null; then
  PYTHON="$USERPROFILE/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
elif [ -n "${HOME:-}" ] && [ -f "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" ] && "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" -c "import sys; sys.exit(0)" 2>/dev/null; then
  PYTHON="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
elif python3 -c "import sys; sys.exit(0)" 2>/dev/null; then
  PYTHON="python3"
elif python -c "import sys; sys.exit(0)" 2>/dev/null; then
  PYTHON="python"
fi

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
scripts/claude-review-gate.sh
scripts/claude-code-review.sh
scripts/watch-claude-gate.sh
scripts/dashboard.js
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

if grep -q 'optional advisory' AGENTS.md 2>/dev/null; then
  printf 'invalid AGENTS.md: Claude review is still optional\n'
  failures=$((failures + 1))
fi

if grep -q 'optional advisory' .codex/skills/review-diff/SKILL.md 2>/dev/null; then
  printf 'invalid review-diff skill: Claude review is still optional\n'
  failures=$((failures + 1))
fi

if ! grep -q 'scripts/claude-review-gate.sh' AGENTS.md 2>/dev/null; then
  printf 'invalid AGENTS.md: missing required Claude gate command\n'
  failures=$((failures + 1))
fi

if ! grep -q 'Claude Code CLI' AGENTS.md 2>/dev/null; then
  printf 'invalid AGENTS.md: missing Claude Code CLI backend note\n'
  failures=$((failures + 1))
fi

for script in scripts/*.sh; do
  [ -e "$script" ] || continue
  if command -v bash >/dev/null 2>&1; then
    bash -n "$script" || failures=$((failures + 1))
  fi
done

if [ -n "$PYTHON" ] && [ -f scripts/claude_review.py ]; then
  tmp_pyc="${TMPDIR:-/tmp}/claude_review.$$.pyc"
  if "$PYTHON" -c "import py_compile, sys; py_compile.compile(sys.argv[1], cfile=sys.argv[2], doraise=True)" scripts/claude_review.py "$tmp_pyc"; then
    rm -f "$tmp_pyc"
    printf 'ok python syntax scripts/claude_review.py\n'
  else
    rm -f "$tmp_pyc"
    failures=$((failures + 1))
  fi
fi

if [ -n "$PYTHON" ] && [ -f scripts/validate-landing.py ]; then
  tmp_pyc="${TMPDIR:-/tmp}/validate_landing.$$.pyc"
  if "$PYTHON" -c "import py_compile, sys; py_compile.compile(sys.argv[1], cfile=sys.argv[2], doraise=True)" scripts/validate-landing.py "$tmp_pyc"; then
    rm -f "$tmp_pyc"
    printf 'ok python syntax scripts/validate-landing.py\n'
  else
    rm -f "$tmp_pyc"
    failures=$((failures + 1))
  fi
  "$PYTHON" scripts/validate-landing.py || failures=$((failures + 1))
fi

if [ -n "$PYTHON" ] && [ -f scripts/geo-score.py ]; then
  tmp_pyc="${TMPDIR:-/tmp}/geo_score.$$.pyc"
  if "$PYTHON" -c "import py_compile, sys; py_compile.compile(sys.argv[1], cfile=sys.argv[2], doraise=True)" scripts/geo-score.py "$tmp_pyc"; then
    rm -f "$tmp_pyc"
    printf 'ok python syntax scripts/geo-score.py\n'
  else
    rm -f "$tmp_pyc"
    failures=$((failures + 1))
  fi
  "$PYTHON" scripts/geo-score.py || failures=$((failures + 1))
  "$PYTHON" scripts/geo-score.py --mode persona || failures=$((failures + 1))
fi

if command -v node >/dev/null 2>&1; then
  if node --check scripts/dashboard.js >/dev/null 2>&1; then
    printf 'ok node syntax scripts/dashboard.js\n'
  else
    printf 'invalid node syntax scripts/dashboard.js\n'
    failures=$((failures + 1))
  fi

  if node scripts/dashboard.js --snapshot >/dev/null 2>&1; then
    printf 'ok dashboard snapshot\n'
  else
    printf 'invalid dashboard snapshot\n'
    failures=$((failures + 1))
  fi

  if node --check scripts/geo-dashboard.js >/dev/null 2>&1; then
    printf 'ok node syntax scripts/geo-dashboard.js\n'
  else
    printf 'invalid node syntax scripts/geo-dashboard.js\n'
    failures=$((failures + 1))
  fi

  if node scripts/geo-dashboard.js --score-json --mode persona >/dev/null 2>&1; then
    printf 'ok geo dashboard persona score\n'
  else
    printf 'invalid geo dashboard persona score\n'
    failures=$((failures + 1))
  fi

  if node -e "JSON.parse(require('fs').readFileSync('ai/METRICS.json', 'utf8'))" >/dev/null 2>&1; then
    printf 'ok json ai/METRICS.json\n'
  else
    printf 'invalid json ai/METRICS.json\n'
    failures=$((failures + 1))
  fi
elif [ -n "$PYTHON" ]; then
  if "$PYTHON" -m json.tool ai/METRICS.json >/dev/null 2>&1; then
    printf 'ok json ai/METRICS.json\n'
  else
    printf 'invalid json ai/METRICS.json\n'
    failures=$((failures + 1))
  fi
else
  printf 'warn no node or python found; skipped json parse\n'
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
