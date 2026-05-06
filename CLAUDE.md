# CLAUDE.md

이 저장소는 Codex 우선입니다. Claude Code가 함께 작업할 때도 먼저 `AGENTS.md`를 읽고, 같은 `ai/SPEC.md`, `ai/PLAN.md`, `ai/RUNBOOK.md`, `ai/STATUS.md`, `ai/METRICS.json` 흐름을 따릅니다.

Claude Code의 주 역할은 Codex 변경에 대한 2차 review gate입니다.

필수 review 명령:

```bash
bash scripts/claude-review-gate.sh
```

기본 backend는 로컬 Claude Code CLI의 `claude` 명령입니다. API fallback은 `CLAUDE_REVIEW_BACKEND=api`, `ANTHROPIC_API_KEY`, Python `anthropic` 패키지가 있을 때만 사용합니다.

커밋 감지 자동 리뷰는 사용자가 로컬 터미널에서 watcher를 실행합니다.

```bash
bash scripts/watch-claude-gate.sh
```

대시보드는 읽기 전용 상태판입니다.

```bash
node scripts/dashboard.js
```

Claude review가 `FAIL`을 반환하면 `REVIEW.md`의 blocker를 수정하기 전까지 마일스톤을 완료 처리하지 않습니다.
