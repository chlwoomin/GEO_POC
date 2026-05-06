#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

interval="${CLAUDE_WATCH_INTERVAL:-5}"
run_on_start="${CLAUDE_WATCH_RUN_ON_START:-0}"

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  printf '[claude-watch] failed: workspace is not a git repository\n' >&2
  exit 2
fi

case "$interval" in
  ''|*[!0-9]*)
    printf '[claude-watch] failed: CLAUDE_WATCH_INTERVAL must be a positive integer\n' >&2
    exit 2
    ;;
esac

if [ "$interval" -lt 1 ]; then
  printf '[claude-watch] failed: CLAUDE_WATCH_INTERVAL must be >= 1\n' >&2
  exit 2
fi

current_head="$(git rev-parse HEAD 2>/dev/null || true)"
if [ -z "$current_head" ]; then
  printf '[claude-watch] failed: cannot resolve current HEAD\n' >&2
  exit 2
fi

last_head="$current_head"

printf '[claude-watch] watching commits every %ss\n' "$interval"
printf '[claude-watch] initial HEAD %s\n' "$(git rev-parse --short HEAD)"
printf '[claude-watch] backend %s\n' "${CLAUDE_REVIEW_BACKEND:-claude-code}"

run_gate() {
  local head_short
  local exit_code
  head_short="$(git rev-parse --short HEAD 2>/dev/null || printf unknown)"
  printf '[claude-watch] running Claude gate for %s\n' "$head_short"
  bash scripts/claude-review-gate.sh
  exit_code=$?
  if [ "$exit_code" -eq 0 ]; then
    printf '[claude-watch] Claude gate passed for %s\n' "$head_short"
    return 0
  fi
  printf '[claude-watch] Claude gate failed for %s with exit %s\n' "$head_short" "$exit_code" >&2
  return "$exit_code"
}

if [ "$run_on_start" = "1" ]; then
  run_gate || true
fi

while :; do
  sleep "$interval"
  current_head="$(git rev-parse HEAD 2>/dev/null || true)"
  if [ -z "$current_head" ]; then
    printf '[claude-watch] warning: cannot resolve HEAD; retrying\n' >&2
    continue
  fi
  if [ "$current_head" != "$last_head" ]; then
    printf '[claude-watch] commit changed: %s -> %s\n' "${last_head:0:12}" "${current_head:0:12}"
    last_head="$current_head"
    run_gate || true
  fi
done
