---
name: review-diff
description: Review AI-generated repository diffs after validation and required Claude review. Use when a Ralph Loop pass has produced changes that need REVIEW.md verdict handling, Codex-led risk review, requirement alignment checks, validation confirmation, and next-action notes.
---

# Review Diff

## Procedure

Claude 리뷰 gate (`scripts/claude-review-gate.sh`)는 Codex 샌드박스 외부에서 실행됩니다.
Codex는 이 스킬을 통해 이미 생성된 `REVIEW.md`를 읽고 처리합니다.

1. `REVIEW.md`가 존재하는지 확인합니다.
   - 없으면: 사용자에게 `bash scripts/ai-loop.sh`를 실행하도록 안내하고 대기합니다.
2. `REVIEW.md`를 읽습니다.
3. Claude verdict가 `FAIL`이면 BLOCKERS를 수정하고 재검증 후 재커밋합니다.
4. Claude verdict가 `WARN`이면 경고를 `ai/STATUS.md`에 기록하고 계속 진행합니다.
5. `ai/PLAN.md`의 마일스톤 완료 조건과 대조해 diff를 확인합니다.
6. 관련 없는 변경, secret 노출, 과도한 범위 확장이 없는지 확인합니다.
7. `ai/STATUS.md`, `ai/METRICS.json`, `ai/PLAN.md`가 실제 결과와 일치하는지 확인합니다.
8. `REVIEW.md`를 `REVIEW.resolved.md`로 이름을 바꿔 보관합니다.

## Review Checklist

- Requirement alignment: the diff advances only the selected milestone.
- Validation integrity: commands were run and results are not overstated.
- Safety: no destructive, secret, or unrelated edits.
- Maintainability: no unnecessary abstraction or stale compatibility text.
- Status accuracy: `ai/STATUS.md`, `ai/METRICS.json`, and `ai/PLAN.md` are consistent.
- Claude gate: `REVIEW.md` exists and has `PASS` or `WARN`.
