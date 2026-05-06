# AI 워크플로 Runbook

업데이트: 2026-05-06 13:55 Asia/Seoul

## 빠른 시작

로컬 대시보드:

```bash
node scripts/dashboard.js
```

대시보드 snapshot:

```bash
node scripts/dashboard.js --snapshot
```

로컬 검증:

```bash
bash scripts/validate.sh
```

워크플로 점수:

```bash
bash scripts/score-result.sh
```

Claude watcher:

```bash
bash scripts/watch-claude-gate.sh
```

## 표준 Ralph Loop

### 1. Preflight

다음 파일을 읽습니다.

- `AGENTS.md`
- `ai/SPEC.md`
- `ai/PLAN.md`
- `ai/RUNBOOK.md`
- `ai/STATUS.md`
- `ai/METRICS.json`
- `REVIEW.md`가 있으면 가장 먼저 처리

### 2. 마일스톤 선택

`ai/PLAN.md`에서 `active` 마일스톤 하나를 선택합니다. `active`가 없으면 첫 `planned` 마일스톤을 선택합니다. 한 루프에서 여러 마일스톤을 동시에 진행하지 않습니다.

### 3. 작은 diff 구현

Codex가 구현합니다. 같은 루프에서 사용자 승인 없이 다음 예산을 넘기지 않습니다.

- 최대 변경 파일: 8개
- 최대 변경 라인: 400줄
- 같은 마일스톤 디버깅 재시도: 3회

### 4. 로컬 검증

```bash
bash scripts/validate.sh
```

검증 실패 시 `.codex/skills/debug-failure/SKILL.md` 흐름으로 원인을 좁히고 다시 검증합니다.

### 5. 커밋

로컬 검증이 통과하면 작고 리뷰 가능한 단위로 커밋합니다. watcher는 커밋 변경을 감지하므로, Claude review를 자동화하려면 커밋이 필요합니다.

### 6. Watcher 기반 Claude Gate

사용자가 별도 로컬 터미널에서 watcher를 실행합니다.

```bash
bash scripts/watch-claude-gate.sh
```

PowerShell에서 시작 즉시 현재 커밋을 리뷰하려면:

```powershell
$env:CLAUDE_WATCH_RUN_ON_START="1"; bash scripts/watch-claude-gate.sh
```

watcher는 새 커밋을 감지하면 다음 명령을 실행합니다.

```bash
bash scripts/claude-review-gate.sh
```

Claude Code CLI backend는 로컬 CLI를 사용하지만 diff/context가 Claude 서비스로 전송될 수 있습니다. 그래서 watcher와 gate는 사용자가 직접 실행합니다.

### 7. REVIEW.md 처리

`REVIEW.md` verdict 처리 규칙:

- `PASS`: 상태와 메트릭 갱신 후 다음 루프 진행
- `WARN`: 경고를 `ai/STATUS.md`에 기록하고 진행 가능
- `FAIL`: blocker를 먼저 수정하고 로컬 검증 및 Claude gate 재실행

### 8. 상태 갱신

다음을 갱신합니다.

- `ai/STATUS.md`
- `ai/METRICS.json`
- 필요 시 `ai/PLAN.md`

## 대시보드 운영

대시보드는 읽기 전용입니다. 명령 실행 버튼 대신 복사 가능한 명령을 제공합니다.

```bash
node scripts/dashboard.js
```

접속:

```text
http://127.0.0.1:3131
```

포트 변경:

```bash
node scripts/dashboard.js --port 3132
```

확인 가능한 항목:

- 활성 마일스톤
- 로컬 검증 상태
- Claude review verdict
- watcher 명령
- gate 준비도
- 변경 파일과 라인 예산
- `REVIEW.md`
- `ai/LOOP_LOG.jsonl`
- `ai/STATUS.md`
- 중복 watcher 경고

## 중복 watcher 기준

표준 watcher는 다음 파일입니다.

```bash
scripts/watch-claude-gate.sh
```

`scripts/review-watcher.sh`가 있으면 legacy 또는 실험용 watcher로 취급합니다. 삭제는 자동으로 하지 않고, 대시보드에서 경고로 표시합니다.

## 안전 중단 조건

- 검증 실패가 같은 마일스톤에서 3회 반복됨
- 변경 예산 초과
- secret 또는 외부 전송 위험 감지
- Claude verdict가 `FAIL`
- `REVIEW.md`가 현재 HEAD와 불일치
- 사용자의 추가 결정이 필요한 요구사항 발견
