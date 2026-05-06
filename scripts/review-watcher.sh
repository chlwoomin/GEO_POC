#!/usr/bin/env bash
# Codex 커밋을 감지해 Claude 리뷰를 자동 실행합니다.
# 별도 터미널에서 Codex와 동시에 실행하세요.
#
# 사용법:
#   bash scripts/review-watcher.sh
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

INTERVAL="${REVIEW_WATCHER_INTERVAL:-3}"
LAST_SHA=""

printf '[watcher] Claude 리뷰 watcher 시작 (폴링 간격: %ss)\n' "$INTERVAL"
printf '[watcher] Codex가 커밋하면 자동으로 claude-review-gate.sh를 실행합니다.\n'
printf '[watcher] 종료: Ctrl+C\n\n'

while true; do
  CURRENT_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"

  if [ -z "$CURRENT_SHA" ]; then
    sleep "$INTERVAL"
    continue
  fi

  # 첫 실행 시 현재 SHA를 기준으로 설정
  if [ -z "$LAST_SHA" ]; then
    LAST_SHA="$CURRENT_SHA"
    printf '[watcher] 기준 커밋: %s\n' "$LAST_SHA"
  fi

  if [ "$CURRENT_SHA" != "$LAST_SHA" ]; then
    COMMIT_MSG="$(git -C "$ROOT" log -1 --pretty=%s 2>/dev/null || true)"
    printf '\n[watcher] 새 커밋 감지: %s — %s\n' "$CURRENT_SHA" "$COMMIT_MSG"

    # REVIEW.md 커밋이면 스킵 (watcher가 만든 커밋에 반응하지 않음)
    if printf '%s' "$COMMIT_MSG" | grep -qiE '^chore.*REVIEW|^docs.*REVIEW'; then
      printf '[watcher] 리뷰 관련 커밋 — 스킵\n'
      LAST_SHA="$CURRENT_SHA"
      sleep "$INTERVAL"
      continue
    fi

    printf '[watcher] Claude 리뷰 실행 중...\n'
    if bash "$ROOT/scripts/claude-review-gate.sh"; then
      printf '[watcher] 리뷰 완료 (PASS 또는 WARN). REVIEW.md를 확인하세요.\n'
    else
      printf '[watcher] 리뷰 FAIL. REVIEW.md의 BLOCKERS를 확인하세요.\n'
      printf '[watcher] 다음 Codex 루프가 REVIEW.md를 읽고 수정합니다.\n'
    fi

    LAST_SHA="$CURRENT_SHA"
  fi

  sleep "$INTERVAL"
done
