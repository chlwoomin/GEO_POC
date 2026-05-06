# 변호사 GEO 랜딩페이지 스펙

## 목표

로컬에서 바로 열 수 있는 정적 변호사 랜딩페이지를 만든다. 첫 slice는 이혼·재산분할·양육 이슈를 다루는 한국어 랜딩페이지이며, legacy GEO prompt의 요구사항 중 랜딩페이지 템플릿 구조, 질문형 heading, 직접 답변, 법조문·판례 인용, 구조화 데이터, 변호사법 광고 리스크 회피를 반영한다.

## 범위

- `landing/index.html`: 랜딩페이지 본문과 JSON-LD 구조화 데이터
- `landing/styles.css`: 반응형 스타일
- `landing/assets/family-law-consultation.png`: 로컬 hero visual asset
- `scripts/validate-landing.py`: 정적 페이지 검증
- `scripts/validate.sh`: 랜딩페이지 검증 연결

## Acceptance Criteria

- 첫 화면에서 변호사/분야/상담 목적이 즉시 보인다.
- 첫 2~3문장 안에 사용자의 핵심 질문에 직접 답한다.
- 질문형 H2가 5개 이상 있다.
- FAQ가 8개 이상 있고 `FAQPage` JSON-LD가 있다.
- `LegalService`, `Attorney`, `Person`, `FAQPage`, `LocalBusiness` JSON-LD가 있다.
- 법률 주장에는 법조문 또는 판례 번호가 함께 표시된다.
- `100% 승소`, `최고 변호사`, `1위`, `보장` 같은 금지/위험 표현을 쓰지 않는다.
- 로컬 검증 명령 `bash scripts/validate.sh`가 통과한다.
- 배포는 하지 않는다.

## Non-Goals

- 실제 변호사 광고 집행
- 실제 등록번호, 실제 사무소 주소, 실제 처리사례 입력
- 서버, CMS, 배포, 결제, 상담 예약 backend 구현
- GEO 진단 엔진이나 대시보드 구현

## 검증 계획

1. `bash scripts/validate.sh`
2. `bash scripts/score-result.sh`
3. 가능한 경우 `bash scripts/claude-review-gate.sh`

Claude gate는 필수지만, 현재 실행 환경에서 외부 전송 정책으로 차단될 수 있다. 차단되면 `ai/STATUS.md`에 blocker로 기록한다.
