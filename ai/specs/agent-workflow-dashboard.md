# Agent Workflow Dashboard Spec

업데이트: 2026-05-06 13:55 Asia/Seoul

## 목적

GEOPOC 작업자는 Codex 구현 루프, 로컬 검증, 커밋 기반 watcher, Claude Code review gate, 상태 갱신을 한 화면에서 확인할 수 있어야 한다. 대시보드는 실행 상태를 보여주는 읽기 전용 조종석이며, 외부 전송이 발생할 수 있는 Claude 명령을 직접 실행하지 않는다.

## 핵심 사용자

- Codex로 구현을 진행하는 작업자
- Claude Code CLI로 2차 리뷰를 받는 작업자
- Ralph Loop 상태를 빠르게 점검해야 하는 리뷰어

## 필요한 기능

### D1. 루프 요약

대시보드는 다음 상태를 상단 요약으로 보여야 한다.

- 활성 마일스톤
- 마지막 로컬 검증 상태
- 마지막 Claude review verdict
- 변경 파일 수
- 변경 라인 수
- 최근 score

### D2. Ralph Loop 경로

대시보드는 실제 작업 순서를 명확히 보여야 한다.

1. 규칙과 `REVIEW.md` 읽기
2. 마일스톤 하나 선택
3. 작은 diff 구현
4. `bash scripts/validate.sh`
5. 커밋 생성
6. `bash scripts/watch-claude-gate.sh`가 커밋 감지
7. `REVIEW.md` 처리
8. `ai/STATUS.md`, `ai/METRICS.json` 갱신

### D3. Gate 준비도

다음 항목을 pass, warn, fail로 표시해야 한다.

- 필수 워크플로 파일 존재 여부
- 로컬 검증 상태
- score 기준 충족 여부
- `REVIEW.md` 존재 여부와 현재 HEAD 일치 여부
- watcher 존재 여부
- 파일 변경 예산
- 라인 변경 예산
- 중복 watcher 존재 여부

### D4. Claude watcher 실행 지원

대시보드는 watcher를 직접 실행하지 않고, 복사 가능한 명령을 제공한다.

- `bash scripts/watch-claude-gate.sh`
- `$env:CLAUDE_WATCH_RUN_ON_START="1"; bash scripts/watch-claude-gate.sh`
- `bash scripts/claude-review-gate.sh`

Claude Code CLI backend는 diff/context를 Claude 서비스로 전송할 수 있으므로, 사용자가 로컬 터미널에서 명시적으로 실행해야 한다.

### D5. 리뷰와 히스토리

대시보드는 다음 파일을 읽어 표시해야 한다.

- `REVIEW.md`
- `ai/LOOP_LOG.jsonl`
- `ai/METRICS.json`
- `ai/STATUS.md`

### D6. Git 변경 가시성

대시보드는 현재 branch, HEAD, dirty 여부, 변경 파일 목록을 표시해야 한다.

## 범위 제외

- 대시보드에서 Claude CLI를 직접 실행하지 않는다.
- 대시보드에서 git commit, git add, validate 명령을 직접 실행하지 않는다.
- 배포 기능을 만들지 않는다.
- 애플리케이션 기능을 추가하지 않는다.

## 검증

- `node --check scripts/dashboard.js`
- `node scripts/dashboard.js --snapshot`
- `node scripts/dashboard.js --port 3132`
- `bash scripts/validate.sh`
- `bash scripts/score-result.sh`

## 완료 조건

- 대시보드가 `node scripts/dashboard.js`로 실행 가능하다.
- `/api/snapshot`이 JSON 상태를 반환한다.
- 외부 CDN 없이 로컬에서 UI가 렌더링된다.
- watcher 기반 Claude review 흐름이 명령 패널에 표시된다.
- deterministic 검증과 score가 통과한다.
