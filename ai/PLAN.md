# AI 워크플로 계획

업데이트: 2026-05-06 14:08 Asia/Seoul

## 마일스톤 상태 정의

- `planned`: 시작 가능
- `active`: 현재 작업 중
- `done`: 구현과 검증 완료
- `blocked`: 차단 이유 기록 후 대기

## 현재 우선순위

현재 저장소는 Codex 우선 Ralph Loop를 사용합니다. 구현은 Codex가 수행하고, 로컬 검증이 통과한 뒤 커밋 단위로 watcher가 Claude Code review gate를 실행하는 흐름을 표준으로 둡니다.

## 마일스톤

### M0. AI 워크플로 인프라 부트스트랩

상태: `done`

목표: Codex 우선 Ralph Loop 워크플로 scaffold를 만든다.

완료 조건:

- [x] 루트 `AGENTS.md` 존재
- [x] canonical `ai/` 워크플로 파일 존재
- [x] 재사용 가능한 prompt template 존재
- [x] loop script 존재
- [x] repo-local Codex config 존재
- [x] repo-local Codex skill 존재
- [x] 워크플로 검증 통과

### M1. 저장소 baseline 점검

상태: `done`

목표: 애플리케이션 동작을 바꾸지 않고 실제 스택, 패키지 매니저, 검증 명령, 중복 파일을 파악한다.

완료 조건:

- [x] 프로젝트 구조가 `ai/STATUS.md`에 요약됨
- [x] 실제 검증 명령이 `ai/RUNBOOK.md`에 기록됨
- [x] 가능한 검증 명령이 `scripts/validate.sh`에서 실행됨
- [x] 위험과 blocker가 기록됨

### M2. 첫 기능 스펙

상태: `done`

목표: 변호사 GEO 랜딩페이지 첫 slice를 구현 가능한 스펙으로 정리한다.

완료 조건:

- [x] 사용자 목표가 acceptance criteria로 번역됨
- [x] scope boundary와 non-goal 명확화
- [x] 구현 및 검증 계획 정의

### M3. 변호사 GEO 랜딩페이지 로컬 slice

상태: `done`

목표: 승인된 첫 기능 slice를 Ralph Loop로 구현한다.

완료 조건:

- [x] 작은 기능 slice 구현
- [x] `bash scripts/validate.sh` 통과
- [x] Claude review 통과 (VERDICT: PASS — `REVIEW.md` 참고)
- [x] diff review 완료
- [x] 상태와 메트릭 갱신

### M4. Agent Workflow Dashboard

상태: `done`

목표: Codex, watcher, Claude Gate, 상태 파일, 메트릭, diff budget을 한 화면에서 확인하는 로컬 읽기 전용 대시보드를 만든다.

완료 조건:

- [x] `ai/specs/agent-workflow-dashboard.md` 작성
- [x] `scripts/dashboard.js` 구현
- [x] `/api/snapshot` 제공
- [x] watcher 기반 Claude review 흐름을 명령 패널에 표시
- [x] `scripts/validate.sh`가 dashboard syntax와 snapshot을 검사
- [x] `bash scripts/validate.sh` 통과
- [x] `bash scripts/score-result.sh` 90점 이상
- [x] Claude review 통과 (VERDICT: PASS — `REVIEW.md` 참고)

## 안전 gate

- 같은 마일스톤에서 검증 실패 디버깅은 최대 3회
- 사용자 승인 없이 한 루프에서 8개 파일 또는 400줄 초과 금지
- network, secret, 외부 전송이 필요한 작업은 사용자 승인 또는 직접 실행 필요
- Claude watcher는 사용자가 로컬 터미널에서 직접 실행
