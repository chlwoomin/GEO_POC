# AGENTS.md

이 저장소는 Codex 우선 Ralph Loop 워크플로를 사용합니다. 한 번에 하나의 마일스톤만 진행하고, 작은 변경을 만들고, 로컬 검증을 실행하고, 커밋 단위로 watcher가 Claude Code review gate를 실행한 뒤 상태를 갱신합니다.

## 기준 문서

작업 전 아래 파일을 순서대로 읽습니다.

1. `AGENTS.md`
2. `ai/SPEC.md`
3. `ai/PLAN.md`
4. `ai/RUNBOOK.md`
5. `ai/STATUS.md`
6. `ai/METRICS.json`

`ai/archive/` 아래 파일은 과거 참고 자료입니다. 현재 지시문으로 취급하지 않습니다.

## Agent 규칙

- Codex를 기본 구현 agent로 사용합니다.
- `ai/PLAN.md`의 마일스톤 하나만 선택해 작업합니다.
- 사람이 리뷰하기 쉬운 작은 변경 단위로 진행합니다.
- 사용자가 만든 변경을 보존하고, 관련 없는 변경을 되돌리지 않습니다.
- 막히면 억지로 진행하지 않고 blocker를 `ai/STATUS.md`에 기록합니다.
- 의미 있는 루프가 끝날 때마다 `ai/METRICS.json`을 갱신합니다.
- Codex가 만든 변경은 Claude Code 필수 review gate를 통과해야 합니다.

## Ralph Loop

Codex 루프 시작 시 `REVIEW.md`가 있으면 반드시 먼저 읽습니다.

- `VERDICT: FAIL`: BLOCKERS를 먼저 수정한 뒤 같은 마일스톤을 재검증합니다.
- `VERDICT: WARN`: 경고를 `ai/STATUS.md`에 기록하고 계속 진행할 수 있습니다.
- `VERDICT: PASS`: 상태와 메트릭을 갱신하고 다음 작업으로 이동할 수 있습니다.

Codex가 수행하는 단계:

1. 기준 문서와 `REVIEW.md`를 읽습니다.
2. `active` 또는 첫 `planned` 마일스톤 하나를 선택합니다.
3. 계획과 안전 한계를 명시합니다.
4. 작고 리뷰 가능한 변경을 만듭니다.
5. `bash scripts/validate.sh`를 실행합니다.
6. 실패하면 `.codex/skills/debug-failure/SKILL.md` 흐름으로 디버깅합니다.
7. 검증이 통과하면 작은 커밋 단위로 준비합니다.
8. `ai/STATUS.md`와 `ai/METRICS.json`을 갱신합니다.
9. 완료 조건을 만족하거나 안전 한계에 도달하면 멈춥니다.

사용자가 로컬 터미널에서 수행하는 단계:

```bash
bash scripts/watch-claude-gate.sh
```

watcher는 새 커밋을 감지하면 다음 gate를 실행합니다.

```bash
bash scripts/claude-review-gate.sh
```

## 검증 명령

기본 검증:

```bash
bash scripts/validate.sh
```

워크플로 점수:

```bash
bash scripts/score-result.sh
```

대시보드 snapshot 검증:

```bash
node scripts/dashboard.js --snapshot
```

## Claude Code 리뷰 gate

Claude Code는 Codex 변경의 필수 2차 리뷰 gate입니다. 기본 backend는 로컬 `claude` 명령을 사용하는 Claude Code CLI입니다.

필수 명령:

```bash
bash scripts/claude-review-gate.sh
```

API fallback은 명시적으로 선택할 때만 사용합니다.

```bash
CLAUDE_REVIEW_BACKEND=api bash scripts/claude-review-gate.sh
```

gate는 `REVIEW.md`를 생성합니다.

- `PASS`: 진행 가능
- `WARN`: `ai/STATUS.md`에 경고를 기록한 뒤 진행 가능
- `FAIL`: 멈추고 blocker를 수정

Claude Code CLI backend도 diff/context가 Claude 서비스로 전송될 수 있으므로, Codex가 임의로 실행하지 않고 사용자가 로컬 터미널에서 직접 실행합니다.

## Watcher

커밋을 polling으로 감지해서 gate를 자동 실행하려면 사용자가 로컬 터미널에서 watcher를 실행합니다.

```bash
bash scripts/watch-claude-gate.sh
```

PowerShell에서 시작 즉시 현재 커밋을 리뷰하려면:

```powershell
$env:CLAUDE_WATCH_RUN_ON_START="1"; bash scripts/watch-claude-gate.sh
```

## 대시보드

로컬 workflow dashboard:

```bash
node scripts/dashboard.js
```

접속:

```text
http://127.0.0.1:3131
```

대시보드는 읽기 전용입니다. watcher와 Claude gate 명령은 복사 가능한 명령으로만 표시합니다.

## 안전 한계

- 같은 마일스톤에서 디버깅 재시도는 최대 3회입니다.
- 사용자 승인 없이 한 루프에서 8개 파일 또는 400줄을 넘기지 않습니다.
- secret, network, 외부 전송 위험이 있으면 멈추고 사용자 결정을 받습니다.
- 요구사항이 불명확하거나 설계 변경이 필요하면 blocker로 기록합니다.
