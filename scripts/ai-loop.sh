#!/usr/bin/env bash
# Post-Codex review script — run this AFTER Codex finishes and exits.
# Codex 종료 후 로컬 셸에서 실행합니다. Codex 샌드박스 내에서 실행하지 마세요.
#
# 사용법:
#   bash scripts/ai-loop.sh
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

printf '[ai-loop] Codex 작업 후 Claude 리뷰 실행\n'
printf '[ai-loop] Root: %s\n' "$ROOT"
printf '\n'

printf '[ai-loop] Claude 리뷰 gate 실행 중...\n'
if bash scripts/claude-review-gate.sh; then
  printf '\n[ai-loop] Claude 리뷰 통과. REVIEW.md를 확인하세요.\n'
  printf '[ai-loop] 다음 Codex 루프가 REVIEW.md를 읽고 처리합니다.\n'
  bash scripts/score-result.sh
  exit 0
fi

printf '\n[ai-loop] Claude 리뷰 FAIL. REVIEW.md의 BLOCKERS를 확인하세요.\n'
printf '[ai-loop] Codex를 다시 실행하면 REVIEW.md를 읽고 수정 작업을 진행합니다.\n'
exit 1
