# AI 워크플로 Runbook

업데이트: 2026-05-06 17:57 Asia/Seoul

## 빠른 시작

워크플로 대시보드:

```bash
node scripts/dashboard.js
```

GEO 분석 대시보드:

```bash
node scripts/geo-dashboard.js
```

GEO dev 점수:

```bash
python scripts/geo-score.py --mode dev
```

GEO persona staging 점수:

```bash
python scripts/geo-score.py --mode persona
```

GEO prod 배포 점수:

```bash
python scripts/geo-score.py --mode prod
```

Python 실행이 막힌 환경에서 GEO 대시보드 점수 경로만 확인:

```bash
node scripts/geo-dashboard.js --score-json --mode dev
node scripts/geo-dashboard.js --score-json --mode persona
node scripts/geo-dashboard.js --score-json --mode prod
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

1. `AGENTS.md`, `ai/SPEC.md`, `ai/PLAN.md`, `ai/RUNBOOK.md`, `ai/STATUS.md`, `ai/METRICS.json`을 읽습니다.
2. `REVIEW.md`가 있으면 가장 먼저 처리합니다.
3. `ai/PLAN.md`에서 마일스톤 하나만 선택합니다.
4. 작은 diff를 구현합니다.
5. `bash scripts/validate.sh`를 실행합니다.
6. 실패하면 디버깅 루프를 최대 3회까지 수행합니다.
7. 통과하면 커밋 단위로 정리합니다.
8. 사용자가 watcher를 실행해 Claude review gate를 돌립니다.
9. `ai/STATUS.md`, `ai/METRICS.json`, 필요 시 `ai/PLAN.md`를 갱신합니다.

## GEO 점수 모드

### dev 모드

로컬 데모와 개발 중 페이지를 평가합니다.

- pass threshold: 80
- `noindex,nofollow`: 감점, 하지만 critical failure는 아님
- 데모 주소/등록번호: 감점, 하지만 critical failure는 아님
- JSON-LD, FAQ, 법조문·판례, 광고 리스크는 critical gate

### persona 모드

AI GEO 테스트용 가상 페이지를 공개 staging 또는 직접 URL 테스트에 사용할 때 평가합니다.

- pass threshold: 90
- `noindex,nofollow`: 필수 보호 장치이며 없으면 critical failure
- 데모 주소, 데모 등록번호, placeholder: 명확한 가상 페이지/비서비스 고지가 있을 때만 허용
- 실제 검색 노출을 목표로 하지 않음
- JSON-LD, FAQ, 법조문·판례, 광고 리스크는 critical gate

### prod 모드

실제 배포 전에 반드시 통과해야 하는 모드입니다.

- pass threshold: 90
- `noindex,nofollow`: critical failure
- 데모 주소, 데모 등록번호, placeholder: critical failure
- 금지/고위험 광고 표현: critical failure
- JSON-LD, FAQ, 법조문·판례 인용 누락: critical failure

현재 데모 페이지는 prod 모드에서 실패해야 정상입니다.

## 페르소나 AI GEO 테스트 절차

M6은 실제 검색 색인이 아니라 직접 URL 기반 AI 이해도 테스트입니다.

1. `python scripts/geo-score.py --mode persona`를 통과시킵니다.
2. `node scripts/geo-dashboard.js --score-json --mode persona`로 대시보드 fallback 경로를 확인합니다.
3. 로컬 또는 임시 staging URL을 AI 도구에 직접 제공합니다.
4. 질문형, 법조문형, FAQ형 query에 대해 페이지 구조와 출처를 제대로 읽는지 기록합니다.
5. 결과를 실제 변호사 광고 성과로 표현하지 않습니다.
6. production 검색 노출 실험은 실제 변호사/사무소 정보가 준비된 뒤 M7/M8에서 진행합니다.

## 실제 배포 절차

M7에서 다음 정보를 받은 뒤 진행합니다.

- 배포 플랫폼: Vercel, Netlify, Cloudflare Pages, GitHub Pages 중 하나
- 도메인 또는 임시 URL 허용 여부
- 실제 변호사명과 등록번호
- 실제 사무소명, 주소, 전화번호
- 실제 상담 가능 지역
- 실제 광고 가능 문구 범위

배포 전 gate:

```bash
python scripts/geo-score.py --mode prod
```

이 명령이 실패하면 배포하지 않습니다.

## 실제 AI GEO 실험 절차

배포 직후 AI 검색 노출은 보장되지 않습니다. 보통 다음 순서로 추적합니다.

1. 공개 URL 접근 확인
2. `robots.txt`, `sitemap.xml`, canonical URL 확인
3. Google Search Console 또는 플랫폼 색인 제출
4. 브랜드명·변호사명·지역+분야·법률 질문형 query matrix 작성
5. ChatGPT 웹 검색, Perplexity, Google 검색/AI, Gemini 등에서 반복 질의
6. 인용 여부, 검색 결과 노출 여부, 인용 문맥을 보고서에 기록
7. 실패하면 콘텐츠, schema, 내부 링크, 외부 신뢰 신호를 개선

## 안전 중단 조건

- 같은 마일스톤에서 검증 실패가 3회 반복됨
- 사용자 승인 없이 한 루프에서 8개 파일 또는 400줄 초과
- 실제 개인정보, 등록번호, 주소를 임의 생성해야 하는 상황
- 외부 전송 또는 배포 credentials가 필요한 상황
- Claude verdict가 `FAIL`
- prod GEO gate가 실패
