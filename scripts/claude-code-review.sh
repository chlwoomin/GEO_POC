#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

CLAUDE_BIN="${CLAUDE_CMD:-}"
if [ -z "$CLAUDE_BIN" ]; then
  if command -v claude >/dev/null 2>&1; then
    CLAUDE_BIN="claude"
  elif command -v claude.exe >/dev/null 2>&1; then
    CLAUDE_BIN="claude.exe"
  fi
fi

if [ -z "$CLAUDE_BIN" ] || ! command -v "$CLAUDE_BIN" >/dev/null 2>&1; then
  printf '[claude-code-review] failed: claude CLI is not available. Set CLAUDE_CMD to the local Claude Code executable if needed.\n' >&2
  exit 2
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  printf '[claude-code-review] failed: workspace is not a git repository\n' >&2
  exit 2
fi

sha="$(git rev-parse --short HEAD 2>/dev/null || printf 'uncommitted')"
commit_msg="$(git log -1 --pretty=%s 2>/dev/null || printf 'no commit message')"
diff="$(git diff HEAD~1 HEAD --stat --patch --no-color 2>/dev/null)"

if [ -z "$diff" ]; then
  diff="$(git diff --stat --patch --no-color HEAD 2>/dev/null)"
fi

if [ -z "$diff" ]; then
  diff="(no diff found)"
fi

prompt_file="$(mktemp "${TMPDIR:-/tmp}/claude-review.XXXXXX.md")"
response_file="$(mktemp "${TMPDIR:-/tmp}/claude-review-response.XXXXXX.md")"

cleanup() {
  rm -f "$prompt_file" "$response_file"
}
trap cleanup EXIT

{
  printf 'You are the required secondary reviewer for a Codex-first repository.\n\n'
  printf 'Review the diff against the workflow files. Treat AGENTS.md and ai/ as authoritative.\n\n'
  printf '## Commit\n'
  printf -- '- SHA: %s\n' "$sha"
  printf -- '- Message: %s\n\n' "$commit_msg"
  printf '## AGENTS.md\n'
  sed -n '1,220p' AGENTS.md 2>/dev/null
  printf '\n\n## ai/PLAN.md\n'
  sed -n '1,220p' ai/PLAN.md 2>/dev/null
  printf '\n\n## ai/STATUS.md\n'
  sed -n '1,220p' ai/STATUS.md 2>/dev/null
  printf '\n\n## Diff\n'
  printf '%s\n' "$diff" | head -c 12000
  printf '\n\n## Output format\n'
  printf '### VERDICT: [PASS|WARN|FAIL]\n\n'
  printf '### BLOCKERS\n- ...\n\n'
  printf '### WARNINGS\n- ...\n\n'
  printf '### FEEDBACK_FOR_CODEX\nConcrete next actions. If there are no issues, write "proceed".\n'
} > "$prompt_file"

if ! "$CLAUDE_BIN" -p --output-format text --permission-mode dontAsk --tools "" < "$prompt_file" > "$response_file"; then
  printf '[claude-code-review] failed: claude CLI returned non-zero\n' >&2
  exit 2
fi

verdict="$(awk -F: '/VERDICT/ { gsub(/^[ \t]+|[ \t]+$/, "", $2); print toupper($2); exit }' "$response_file")"

if [ "$verdict" != "PASS" ] && [ "$verdict" != "WARN" ] && [ "$verdict" != "FAIL" ]; then
  verdict="WARN"
fi

{
  printf '# Claude Review\n'
  printf '**Backend**: Claude Code CLI (%s)\n' "$CLAUDE_BIN"
  printf '**Commit**: %s - %s\n' "$sha" "$commit_msg"
  printf '**VERDICT**: %s\n\n' "$verdict"
  cat "$response_file"
  printf '\n'
} > REVIEW.md

printf '[claude-code-review] wrote REVIEW.md with verdict %s\n' "$verdict"

if [ "$verdict" = "FAIL" ]; then
  exit 1
fi

exit 0
