#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  printf '[claude-gate] failed: workspace is not a git repository\n' >&2
  exit 2
fi

backend="${CLAUDE_REVIEW_BACKEND:-claude-code}"

case "$backend" in
  claude-code)
    bash scripts/claude-code-review.sh
    ;;
  api)
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
      printf '[claude-gate] failed: ANTHROPIC_API_KEY is not set\n' >&2
      exit 2
    fi
    if ! command -v python3 >/dev/null 2>&1; then
      printf '[claude-gate] failed: python3 is not available\n' >&2
      exit 2
    fi
    if ! python3 -c 'import anthropic' >/dev/null 2>&1; then
      printf '[claude-gate] failed: Python package anthropic is not installed\n' >&2
      exit 2
    fi
    python3 scripts/claude_review.py
    ;;
  *)
    printf '[claude-gate] failed: unknown CLAUDE_REVIEW_BACKEND=%s\n' "$backend" >&2
    exit 2
    ;;
esac
review_exit=$?

if [ "$review_exit" -ne 0 ]; then
  printf '[claude-gate] failed: Claude review exited with %s\n' "$review_exit" >&2
  exit "$review_exit"
fi

if [ ! -f REVIEW.md ]; then
  printf '[claude-gate] failed: REVIEW.md was not produced\n' >&2
  exit 2
fi

verdict="$(awk -F: '/VERDICT/ { gsub(/^[ \t]+|[ \t]+$/, "", $2); print toupper($2); exit }' REVIEW.md)"

# LOOP_LOG.jsonl 에 결과 기록 (대시보드 히스토리용)
sha="$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
commit_msg="$(git log -1 --pretty=%s 2>/dev/null || printf '')"
milestone="$(python3 -c "import json,sys; d=json.load(open('ai/METRICS.json')); print(d.get('active_milestone',''))" 2>/dev/null || printf '')"
ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")"
log_entry="{\"ts\":\"$ts\",\"sha\":\"$sha\",\"commit\":$(printf '%s' "$commit_msg" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))"),\"milestone\":\"$milestone\",\"verdict\":\"$verdict\"}"
printf '%s\n' "$log_entry" >> ai/LOOP_LOG.jsonl

case "$verdict" in
  PASS|WARN)
    printf '[claude-gate] passed with verdict %s\n' "$verdict"
    exit 0
    ;;
  FAIL)
    printf '[claude-gate] failed with verdict FAIL\n' >&2
    exit 1
    ;;
  *)
    printf '[claude-gate] failed: unknown or missing verdict in REVIEW.md\n' >&2
    exit 2
    ;;
esac
