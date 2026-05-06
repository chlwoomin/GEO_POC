# AI 워크플로 상태

업데이트: 2026-05-06 20:25 Asia/Seoul

## 현재 상태

김재철 대표변호사님 페르소나 반영 작업의 첫 단계로 `landing/index.html`을 백상 법무법인 김재철 대표변호사 랜딩 초안으로 수정했습니다. 이어서 M7/M8의 남은 준비 작업 중 임의 정보 없이 진행 가능한 production 입력 계약과 AI GEO 질의 matrix를 추가했습니다.

현재 GEO 결과:

- dev 모드: 93/100, Grade A, 통과
- persona 모드: 100/100, Grade A, 통과
- prod 모드: 87/100, 실패
- prod 실패 이유: `색인 가능성`, `데모 데이터 배포 차단`

prod 실패는 아직 정상입니다. 현재 페이지는 `noindex,nofollow`를 유지하고 있으며, 실제 공개 배포에는 등록번호, 주소, 전화번호, 광고 가능 문구, 공개 URL이 필요합니다.

Claude Code review gate는 이번 랜딩 변경 이후 아직 실행되지 않았습니다. 다음 커밋 후 사용자가 watcher 또는 gate를 로컬 터미널에서 실행해야 합니다.

## 완료된 마일스톤

- M0. AI 워크플로 인프라 부트스트랩: `done`
- M1. 저장소 baseline 점검: `done`
- M2. 첫 기능 스펙: `done`
- M3. 변호사 GEO 랜딩페이지 로컬 slice: `done`
- M4. Agent Workflow Dashboard: `done`
- M5. GEO Scorer Hardening: `done`
- M6. Persona AI GEO Staging Experiment: `done`

## 현재 마일스톤

- M7. Production Deployment Readiness: `blocked`

## M7 Blocker

김재철 대표변호사님 페르소나로 일부 입력이 해소되었습니다.

확인됨:

- 실제 변호사명: 김재철 변호사
- 실제 사무소명: 백상 법무법인
- 직위: 대표변호사
- 공개 블로그 URL: https://blog.naver.com/kjccjk77
- production 입력 계약 파일: `ai/production-profile.example.json`
- AI GEO 질의 matrix: `ai/GEO_QUERY_MATRIX.md`

남은 입력:

- 배포 플랫폼: Vercel, Netlify, Cloudflare Pages, GitHub Pages 중 하나
- 공개 도메인 또는 임시 배포 URL 허용 여부
- 실제 대한변호사협회 등록번호
- 실제 주소와 전화번호
- 실제 상담 가능 지역
- 배포 가능한 광고 문구 범위

## 구현 결과

- `landing/index.html`: 기존 가상 변호사/가상 사무소 신호를 백상 법무법인 김재철 대표변호사 페르소나로 교체했습니다.
- `landing/index.html`: JSON-LD `LegalService`, `Attorney`, `LocalBusiness`, `FAQPage` 엔티티에 블로그 URL과 확인된 이름/사무소명을 반영했습니다.
- `landing/index.html`: 등록번호·주소·전화번호는 임의 생성하지 않고 "실제 공개 전 확인 필요"로 남겼습니다.
- `ai/production-profile.example.json`: M7 production 배포 전에 채워야 할 실제 입력 계약을 정의했습니다.
- `ai/GEO_QUERY_MATRIX.md`: M8 실제 AI GEO 실험용 질의와 기록 양식을 정의했습니다.
- `ai/PLAN.md`, `ai/RUNBOOK.md`: M7/M8 진행 상태와 새 파일 경로를 연결했습니다.
- `scripts/geo-score.py`: `persona` 모드 추가. `noindex,nofollow`와 가상 페이지 고지를 critical gate로 검사합니다.
- `scripts/geo-dashboard.js`: `dev`, `persona`, `prod` 모드를 모두 지원하고 Python 실행 실패 시 JS fallback으로 같은 기준을 계산합니다.
- `scripts/validate.sh`: Codex 번들 Python 탐색과 persona gate 검증을 추가했습니다.
- `scripts/score-result.sh`: persona gate가 워크플로 점수 기준에 포함되도록 확인합니다.
- `landing/index.html`: title, description, schema description, 데모 안내, 폼 완료 문구를 AI GEO 테스트용 가상 페이지에 맞게 조정했습니다.
- `ai/PLAN.md`, `ai/RUNBOOK.md`, `ai/METRICS.json`: M6/M7/M8 트랙과 persona 테스트 절차를 갱신했습니다.

## 검증

- `bash scripts/validate.sh`: passed
- `python scripts/geo-score.py --mode dev`: 93/100, Grade A, passed
- `python scripts/geo-score.py --mode persona`: 100/100, Grade A, passed
- `node scripts/geo-dashboard.js --score-json --mode persona`: 100/100, passed, JS fallback 동작
- `node -e "JSON.parse(...)"`: production profile example 및 metrics JSON parse 통과
- `python scripts/geo-score.py --json --mode persona`: 100/100, passed
- `python scripts/geo-score.py --json --mode prod`: expected failed, critical failures 존재
- `node --check scripts/geo-dashboard.js`: passed
- `bash scripts/score-result.sh`: 100점, pass

## 다음 액션

1. 변경 사항을 커밋한 뒤 사용자가 로컬 터미널에서 `bash scripts/watch-claude-gate.sh` 또는 `bash scripts/claude-review-gate.sh`를 실행합니다.
2. 김재철 대표변호사님 실제 등록번호, 주소, 전화번호, 상담 가능 지역, 공개 가능한 광고 문구를 확인합니다.
3. 실제 배포 플랫폼과 공개 URL을 정한 뒤 M7 production gate를 재실행합니다.

## Loop Log

- 2026-05-06 11:52 Asia/Seoul | done | 워크플로 scaffold 생성, 검증 통과
- 2026-05-06 13:35 Asia/Seoul | done | 변호사 GEO 랜딩페이지 로컬 slice 구현
- 2026-05-06 13:48 Asia/Seoul | done | commit polling watcher 추가
- 2026-05-06 14:08 Asia/Seoul | done | Agent Workflow Dashboard 구현
- 2026-05-06 15:00 Asia/Seoul | done | GEO 진단 도구 추가, Claude review PASS
- 2026-05-06 17:40 Asia/Seoul | done | M5 GEO Scorer Hardening 완료, prod 배포 차단 gate 추가
- 2026-05-06 17:43 Asia/Seoul | done | 전체 `bash scripts/validate.sh`, `bash scripts/score-result.sh` 통과
- 2026-05-06 18:00 Asia/Seoul | done | M6 persona AI GEO staging gate 완료, persona 100/100 통과
- 2026-05-06 20:03 Asia/Seoul | active | 김재철 대표변호사/백상 법무법인 랜딩 초안 반영, validate 통과
- 2026-05-06 20:25 Asia/Seoul | active | M7 production 입력 계약과 M8 AI GEO 질의 matrix 추가
