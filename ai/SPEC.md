# AI 워크플로 스펙

업데이트: 2026-05-06 13:55 Asia/Seoul

## 목적

이 저장소는 Codex 우선 AI-agent 워크플로를 사용합니다. 목표는 명확한 스펙, 마일스톤 계획, 반복 가능한 검증, 상태 추적, diff review, 디버깅 루프, 안전한 중단 조건, 재사용 가능한 Codex instruction과 skill을 통해 구현 품질을 높이는 것입니다.

## 비목표

- 사용자 승인 없이 애플리케이션 기능을 확장하지 않습니다.
- 배포 자동화를 만들지 않습니다.
- 외부 전송이 필요한 Claude 명령을 Codex가 몰래 실행하지 않습니다.

## 요구사항

### R1. 기준 지시문

루트 `AGENTS.md`는 모든 AI agent가 따라야 하는 작업 규칙을 설명해야 합니다.

### R2. 프로젝트 스펙

`ai/SPEC.md`는 워크플로 목적, 파일 계약, 완료 조건, 비목표를 설명해야 합니다.

### R3. 마일스톤 계획

`ai/PLAN.md`는 작업을 마일스톤으로 나누고 현재 진행 상태를 기록해야 합니다.

### R4. Runbook

`ai/RUNBOOK.md`는 검증 명령, watcher 운영, Claude gate, 디버깅, 상태 갱신, 중단 조건을 설명해야 합니다.

### R5. 상태 추적

`ai/STATUS.md`와 `ai/METRICS.json`은 현재 상태, 검증 결과, 루프 시도, 안전 counter, dashboard 상태를 기록해야 합니다.

### R6. Prompt 재사용

`ai/prompts/`는 구현, 리뷰, 디버깅, 상태 갱신, 최종 보고 prompt template을 포함해야 합니다.

### R7. 검증 harness

`scripts/validate.sh`는 반복 가능한 워크플로 검증을 제공하고, 프로젝트별 검증이 생기면 안전하게 연결해야 합니다.

### R8. 결과 scoring

`scripts/score-result.sh`는 워크플로 준비 상태를 machine-readable score로 출력해야 합니다.

### R9. Codex skill

`.codex/skills/`는 마일스톤 구현, diff review, 실패 디버깅, 상태 갱신 skill을 포함해야 합니다.

### R10. 필수 Claude review gate

Codex가 만든 변경은 deterministic 검증 후 상태 완료 전에 `scripts/claude-review-gate.sh`를 통과해야 합니다. 기본 backend는 로컬 Claude Code CLI의 `claude` 명령입니다. API fallback은 `CLAUDE_REVIEW_BACKEND=api`로 명시적으로 선택할 때만 사용합니다.

### R11. Commit watcher

`scripts/watch-claude-gate.sh`는 새 커밋을 polling으로 감지해 Claude gate를 실행해야 합니다. watcher는 사용자가 로컬 터미널에서 직접 실행합니다.

### R12. Workflow dashboard

`scripts/dashboard.js`는 로컬 읽기 전용 대시보드와 `/api/snapshot`을 제공해야 합니다. 대시보드는 watcher 명령, Claude review 상태, local validation 상태, 변경 예산, milestone, `REVIEW.md`, `ai/LOOP_LOG.jsonl`을 표시해야 합니다.

## 파일 계약

- `AGENTS.md`: 모든 AI agent의 필수 작업 규칙
- `CLAUDE.md`: Claude Code 호환 지시문
- `ai/SPEC.md`: 안정적인 워크플로 요구사항
- `ai/PLAN.md`: 마일스톤 queue와 완료 조건
- `ai/RUNBOOK.md`: 운영 절차
- `ai/STATUS.md`: 사람이 읽는 현재 상태
- `ai/METRICS.json`: 기계가 읽는 상태와 counter
- `ai/prompts/*.md`: 재사용 prompt template
- `ai/specs/*.md`: 기능 또는 인프라 slice별 세부 스펙
- `ai/archive/PROMPT.legacy.md`: 보관용 과거 prompt
- `scripts/ai-loop.sh`: 안전한 one-pass loop helper
- `scripts/validate.sh`: 검증 entrypoint
- `scripts/score-result.sh`: 워크플로 score helper
- `scripts/claude-review-gate.sh`: 필수 Claude review gate
- `scripts/claude-code-review.sh`: 기본 Claude Code CLI review backend
- `scripts/claude_review.py`: API fallback용 Claude review helper
- `scripts/watch-claude-gate.sh`: commit polling watcher
- `scripts/dashboard.js`: 로컬 workflow dashboard
- `.codex/config.toml`: repo-local Codex 설정
- `.codex/skills/*/SKILL.md`: agent 절차 skill

## 완료 조건

- 모든 필수 워크플로 파일이 존재함
- skill frontmatter가 유효함
- `ai/METRICS.json`이 JSON으로 parse됨
- `scripts/validate.sh`가 통과함
- `scripts/score-result.sh`가 90점 이상 반환함
- `node scripts/dashboard.js --snapshot`이 성공함
- top-level legacy duplicate `ai/PROMPT.md`, `ai/agents.md`, `ai/claude.md`가 없음
- Claude review gate는 상태 완료 전 필수로 남아 있음
