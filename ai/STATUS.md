# AI 워크플로 상태

업데이트: 2026-05-06 21:10 Asia/Seoul

## 현재 상태

배포·데이터 입력을 제외한 모든 기능을 완성했습니다. 랜딩페이지 GEO 최적화, 모바일 UX, 고급 스키마, 소셜 메타 태그, FAQ 확장, 배포 템플릿, GEO 스코어 확장이 완료되었습니다.

현재 GEO 결과:

- dev 모드: 94/118 = 94%, Grade A, 통과
- persona 모드: 118/118 = 100%, Grade A, 통과
- prod 모드: 실패 유지 (noindex 제거·실제 데이터 입력 전까지 정상)

prod 실패는 의도적입니다. 현재 페이지는 `noindex,nofollow`를 유지하고 있으며, 실제 공개 배포에는 등록번호, 주소, 전화번호, 공개 URL이 필요합니다.

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

## 구현 결과 (최신)

- `landing/index.html`: OG/Twitter 소셜 메타 태그, canonical, keywords 메타 추가
- `landing/index.html`: WebPage, HowTo, speakable(FAQPage), BreadcrumbList, hasOfferCatalog, dateModified 스키마 추가
- `landing/index.html`: knowsAbout 12개 항목으로 확장
- `landing/index.html`: FAQ 8개 → 12개 (양육비 산정, 협의이혼 vs 재판상 이혼, 혼인파탄 책임, 재산 처분 방지)
- `landing/index.html`: 양육비·위자료 섹션 신설 (새 질문형 H2 추가)
- `landing/index.html`: 모바일 햄버거 메뉴 구현 (aria-expanded, 키보드 접근성)
- `landing/index.html`: 스킵 내비게이션 링크 추가
- `landing/index.html`: hero 이미지 fetchpriority="high" 적용
- `landing/index.html`: 상담 폼에 양육비·협의이혼 옵션 추가
- `landing/styles.css`: 스킵 내비, 햄버거 메뉴, focus-visible, 모바일 드롭다운 스타일 추가
- `landing/robots.txt.template`: 배포용 robots.txt 템플릿 생성
- `landing/sitemap.xml.template`: 배포용 sitemap.xml 템플릿 생성
- `scripts/geo-score.py`: `check_social_meta` (소셜 메타·canonical, 8pt) 추가
- `scripts/geo-score.py`: `check_advanced_schema` (HowTo·speakable·dateModified·WebPage, 10pt) 추가
- `ai/GEO_QUERY_MATRIX.md`: 협의이혼, 양육비, 재산처분, 복합형 질의 4개 추가 (총 12개)

## 검증

- `bash scripts/validate.sh`: passed
- `python scripts/geo-score.py --mode dev`: 111/118 = 94%, Grade A, passed
- `python scripts/geo-score.py --mode persona`: 118/118 = 100%, Grade A, passed
- `python scripts/geo-score.py --mode prod`: expected failed (noindex, 실제 데이터 없음)
- `bash scripts/score-result.sh`: 100점, pass
- `python scripts/validate-landing.py`: passed

## 다음 액션 (배포 후 순서)

### M7 완료 — 배포 직후 즉시

1. `landing/robots.txt.template` → `landing/robots.txt` 생성 (`{PUBLIC_URL}` 치환)
2. `landing/sitemap.xml.template` → `landing/sitemap.xml` 생성 (`{PUBLIC_URL}`, `{DATE}` 치환)
3. `landing/index.html` 수정:
   - `<meta name="robots" content="noindex, nofollow">` 제거
   - `<link rel="canonical">` → 실제 공개 URL로 교체
   - JSON-LD 내 `https://blog.naver.com/kjccjk77` → 실제 URL로 전체 교체
   - `"streetAddress": "실제 공개 전 확인 필요"` → 실제 주소
   - `"telephone": "확인 필요"` → 실제 전화번호
   - `"identifier": "대한변호사협회 등록번호 확인 필요"` → 실제 등록번호
4. `python scripts/geo-score.py --mode prod` 통과 확인 (90% 이상)

### M8 시작 — M7 완료 후

5. `ai/GEO_QUERY_MATRIX.md` 의 질의 12개를 ChatGPT·Perplexity·Google AI·Gemini에 직접 검색
6. 각 도구별 결과를 GEO_QUERY_MATRIX.md 기록 테이블에 채움 (발견 여부, URL 인용, 인용 문단)
7. AI 기반 GEO 검증 스크립트 작성: Perplexity API 등에 질의 12개를 실제로 날려서 "이 페이지 URL이 응답에 인용됐는가"를 자동으로 확인하고 점수화하는 도구

## Loop Log

- 2026-05-06 11:52 Asia/Seoul | done | 워크플로 scaffold 생성, 검증 통과
- 2026-05-06 13:35 Asia/Seoul | done | 변호사 GEO 랜딩페이지 로컬 slice 구현
- 2026-05-06 13:48 Asia/Seoul | done | commit polling watcher 추가
- 2026-05-06 14:08 Asia/Seoul | done | Agent Workflow Dashboard 구현
- 2026-05-06 15:00 Asia/Seoul | done | GEO 진단 도구 추가, Claude review PASS
- 2026-05-06 17:40 Asia/Seoul | done | M5 GEO Scorer Hardening 완료, prod 배포 차단 gate 추가
- 2026-05-06 17:43 Asia/Seoul | done | 전체 `bash scripts/validate.sh`, `bash scripts/score-result.sh` 통과
- 2026-05-06 18:00 Asia/Seoul | done | M6 persona AI GEO staging gate 완료, persona 100/100 통과
- 2026-05-06 20:03 Asia/Seoul | done | M7 하위 작업: 김재철 대표변호사/백상 법무법인 랜딩 초안 반영, validate 통과
- 2026-05-06 20:25 Asia/Seoul | done | M7/M8 하위 작업: production 입력 계약과 AI GEO 질의 matrix 추가
- 2026-05-06 20:35 Asia/Seoul | done | Claude review PASS 반영, M7 blocker 유지
- 2026-05-06 21:10 Asia/Seoul | done | 랜딩 GEO 전면 개선, 고급 스키마·소셜 메타·모바일 메뉴·FAQ 12개·배포 템플릿 완성, persona 100/118pt → 118/118pt
