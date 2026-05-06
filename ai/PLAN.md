# AI 워크플로 계획

업데이트: 2026-05-06 18:00 Asia/Seoul

## 마일스톤 상태 정의

- `planned`: 시작 가능
- `active`: 현재 작업 중
- `done`: 구현과 검증 완료
- `blocked`: 차단 이유 기록 후 대기

## 현재 우선순위

현재 목표는 김재철 대표변호사님/백상 법무법인 페르소나를 반영한 랜딩 초안을 production 배포 가능한 형태로 점진 전환하는 것입니다. 실제 등록번호·주소·전화번호·배포 URL은 임의 생성하지 않고, `ai/production-profile.example.json` 계약에 따라 확인된 값만 사용합니다.

## 마일스톤

### M0. AI 워크플로 인프라 부트스트랩

상태: `done`

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

완료 조건:

- [x] 프로젝트 구조가 `ai/STATUS.md`에 요약됨
- [x] 실제 검증 명령이 `ai/RUNBOOK.md`에 기록됨
- [x] 가능한 검증 명령이 `scripts/validate.sh`에서 실행됨
- [x] 위험과 blocker가 기록됨

### M2. 첫 기능 스펙

상태: `done`

완료 조건:

- [x] 변호사 GEO 랜딩페이지 목표가 acceptance criteria로 번역됨
- [x] scope boundary와 non-goal 명확화
- [x] 구현 및 검증 계획 정의

### M3. 변호사 GEO 랜딩페이지 로컬 slice

상태: `done`

완료 조건:

- [x] 정적 랜딩페이지 구현
- [x] JSON-LD, FAQ, 법조문·판례 인용 포함
- [x] `bash scripts/validate.sh` 통과
- [x] Claude review 통과

### M4. Agent Workflow Dashboard

상태: `done`

완료 조건:

- [x] workflow dashboard 구현
- [x] `/api/snapshot` 제공
- [x] watcher 기반 Claude review 흐름 표시
- [x] 검증 및 score 통과

### M5. GEO Scorer Hardening

상태: `done`

목표: 데모 페이지가 실제 배포 가능한 GEO 준비도처럼 과대평가되지 않도록 점수기와 대시보드 gate를 강화한다.

완료 조건:

- [x] `scripts/geo-score.py`에 `dev`/`prod` 모드 추가
- [x] `noindex,nofollow`를 dev에서는 감점, prod에서는 critical failure 처리
- [x] 데모 주소, 데모 등록번호, placeholder를 prod critical failure 처리
- [x] JSON-LD, FAQ, 법조문·판례, 광고 리스크를 critical gate로 분리
- [x] 총점만으로 통과하지 않고 critical failure가 있으면 실패
- [x] `scripts/geo-dashboard.js`가 Python 탐색 실패 시 JS fallback scorer 사용
- [x] `node scripts/geo-dashboard.js --score-json --mode dev` 통과
- [x] `node scripts/geo-dashboard.js --score-json --mode prod`가 현재 데모 페이지를 의도적으로 차단

### M6. Persona AI GEO Staging Experiment

상태: `done`

목표: 실제 변호사 정보를 만들지 않고도 AI GEO 이해도 테스트를 할 수 있는 가상 페이지 staging gate를 만든다.

완료 조건:

- [x] `scripts/geo-score.py`에 `persona` 모드 추가
- [x] persona 모드에서 `noindex,nofollow`를 필수 보호 장치로 처리
- [x] persona 모드에서 데모/placeholder는 명확한 가상 페이지 고지가 있을 때만 허용
- [x] `scripts/geo-dashboard.js --score-json --mode persona` 통과
- [x] `bash scripts/validate.sh`가 persona gate를 포함해 통과
- [x] 실제 production 검색 실험과 직접 URL AI 테스트의 차이를 `ai/RUNBOOK.md`에 기록

### M7. Production Deployment Readiness

상태: `blocked`

목표: 실제 공개 URL에 올릴 수 있는 production landing build를 만든다.

진행됨:

- 김재철 대표변호사님/백상 법무법인/블로그 URL을 랜딩 초안에 반영
- production 입력 계약 파일 `ai/production-profile.example.json` 정의

Blocker:

- 실제 배포 플랫폼이 필요함: Vercel, Netlify, Cloudflare Pages, GitHub Pages 중 하나
- 실제 공개 도메인 또는 임시 배포 URL이 필요함
- 실제 변호사/사무소 정보 중 등록번호, 주소, 전화번호, 상담 가능 지역, 실제 광고 가능 문구가 필요함
- 현재 랜딩은 `noindex,nofollow` 상태이므로 production 배포 gate를 통과할 수 없음

완료 조건:

- [x] production 정보 파일 또는 환경변수 정의
- [ ] `noindex,nofollow` 제거 또는 prod에서 indexable 처리
- [ ] 실제 도메인 기준 canonical URL 추가
- [ ] `robots.txt`와 `sitemap.xml` 생성
- [ ] `scripts/geo-score.py --mode prod` 통과
- [ ] 정적 호스팅 플랫폼에 배포
- [ ] 공개 URL 기록

### M8. Real AI GEO Experiment

상태: `planned`

목표: 실제 AI 사용 환경에서 페이지가 발견·인용되는지 추적한다.

완료 조건:

- [ ] 공개 URL이 정상 접근 가능
- [ ] sitemap 제출 또는 검색엔진 색인 요청
- [ ] 색인 상태 기록
- [ ] ChatGPT 웹 검색, Perplexity, Google AI/검색, Gemini 등에서 질의 테스트
- [x] 질의 matrix 작성: 브랜드명, 변호사명, 지역+분야, 법률 질문형 query
- [ ] AI 응답이 페이지를 인용하거나 검색 결과에 노출되는지 보고서 작성
- [ ] 실패 시 콘텐츠/스키마/색인 개선 루프 실행

## 안전 gate

- 실제 법률 광고 집행 전 변호사법·광고 규정 검토 필요
- 사용자 승인 없이 실제 개인정보, 등록번호, 주소를 임의 생성하지 않음
- production 배포 전 `geo-score --mode prod` 통과 필수
- AI 검색 노출은 즉시 보장되지 않으며 색인과 크롤링 시간이 필요함
