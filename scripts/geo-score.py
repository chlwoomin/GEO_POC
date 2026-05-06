#!/usr/bin/env python3
"""GEO (Generative Engine Optimization) quality analyzer for the lawyer landing page.

Checks how well the page is optimized for AI-driven search engines
(ChatGPT, Perplexity, Gemini, etc.) and outputs a scored report.

Exit codes: 0 = score >= 80, 1 = score < 80, 2 = file missing.
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = ROOT / "landing" / "index.html"


@dataclass
class Check:
    name: str
    score: int
    max_score: int
    detail: str
    passed: bool = True


@dataclass
class Report:
    checks: list[Check] = field(default_factory=list)

    @property
    def total(self) -> int:
        return sum(c.score for c in self.checks)

    @property
    def max_total(self) -> int:
        return sum(c.max_score for c in self.checks)

    def add(self, check: Check) -> None:
        self.checks.append(check)

    def print(self) -> None:
        print("\n=== GEO Quality Report ===\n")
        for c in self.checks:
            bar = "PASS" if c.passed else "FAIL"
            print(f"[{bar}] {c.name}: {c.score}/{c.max_score}pt")
            print(f"      {c.detail}")
        pct = int(self.total / self.max_total * 100) if self.max_total else 0
        print(f"\nTotal: {self.total}/{self.max_total} ({pct}%)")
        grade = "A" if pct >= 90 else "B" if pct >= 80 else "C" if pct >= 70 else "D"
        print(f"Grade: {grade}")
        print()


def extract_json_ld(html: str) -> list[dict]:
    blocks = re.findall(
        r'<script\s+type="application/ld\+json">\s*(.*?)\s*</script>',
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    result = []
    for block in blocks:
        try:
            result.append(json.loads(block))
        except json.JSONDecodeError:
            pass
    return result


def flatten_nodes(value) -> list[dict]:
    nodes = []
    if isinstance(value, dict):
        if "@type" in value:
            nodes.append(value)
        for v in value.values():
            nodes.extend(flatten_nodes(v))
    elif isinstance(value, list):
        for item in value:
            nodes.extend(flatten_nodes(item))
    return nodes


def get_all_types(payloads: list[dict]) -> set[str]:
    found: set[str] = set()
    for payload in payloads:
        for node in flatten_nodes(payload):
            t = node.get("@type")
            if isinstance(t, str):
                found.add(t)
            elif isinstance(t, list):
                found.update(str(x) for x in t)
    return found


# ──────────────────────────────────────────────
# Individual checks
# ──────────────────────────────────────────────

def check_schema_types(payloads: list[dict]) -> Check:
    """JSON-LD 필수 타입 완비 여부 (25pt)."""
    required = {"LegalService", "Attorney", "Person", "FAQPage", "LocalBusiness"}
    found = get_all_types(payloads)
    present = required & found
    score = int(len(present) / len(required) * 25)
    missing = sorted(required - found)
    detail = (
        f"필수 타입 {len(present)}/{len(required)}개 존재"
        + (f" | 누락: {', '.join(missing)}" if missing else " | 모두 충족")
    )
    return Check("JSON-LD 필수 타입", score, 25, detail, passed=not missing)


def check_faq_schema(payloads: list[dict]) -> Check:
    """FAQPage JSON-LD 질문 수 (15pt)."""
    all_nodes = []
    for p in payloads:
        all_nodes.extend(flatten_nodes(p))
    faq_questions = [n for n in all_nodes if n.get("@type") == "Question"]
    count = len(faq_questions)
    long_answers = sum(
        1 for q in faq_questions
        if len(q.get("acceptedAnswer", {}).get("text", "")) > 60
    )
    base = min(count, 8) / 8 * 10
    bonus = min(long_answers, 8) / 8 * 5
    score = int(base + bonus)
    detail = (
        f"FAQ 질문 {count}개 (목표 8개+) | "
        f"60자+ 직접 답변 {long_answers}개"
    )
    return Check("FAQPage JSON-LD 품질", score, 15, detail, passed=count >= 8)


def check_question_headings(html: str) -> Check:
    """질문형 H2 헤딩 (20pt)."""
    h2_matches = re.findall(r"<h2\b[^>]*>(.*?)</h2>", html, flags=re.IGNORECASE | re.DOTALL)
    question_h2 = [
        re.sub(r"<[^>]+>", "", h) for h in h2_matches
        if re.search(r"[?\?]|나요|인가요|하나요|보나요|인지", h)
    ]
    count = len(question_h2)
    score = min(count, 6) / 6 * 20
    detail = (
        f"질문형 H2 {count}개 (목표 5개+) | "
        + (", ".join(q[:30] + "…" if len(q) > 30 else q for q in question_h2[:3])
           if question_h2 else "없음")
    )
    return Check("질문형 H2 헤딩", int(score), 20, detail, passed=count >= 5)


def check_direct_answer(html: str) -> Check:
    """직접 답변 구조 — 첫 문단에서 핵심 답변 포함 여부 (10pt)."""
    paragraphs = re.findall(r"<p\b[^>]*>(.*?)</p>", html, flags=re.IGNORECASE | re.DOTALL)
    text_paragraphs = [re.sub(r"<[^>]+>", "", p).strip() for p in paragraphs[:6]]
    score = 0
    detail_parts = []

    has_law_in_early = any(
        re.search(r"민법 제\d+조|대법원|판결|결정", p)
        for p in text_paragraphs[:3]
    )
    if has_law_in_early:
        score += 5
        detail_parts.append("초반 문단에 법조문/판례 포함 +5")

    has_direct_answer_cue = any(
        re.search(r"^.{0,30}(입니다|합니다|됩니다|됩니다|있습니다)", p)
        for p in text_paragraphs[:4]
    )
    if has_direct_answer_cue:
        score += 5
        detail_parts.append("문장 종결형 직접 답변 포함 +5")

    detail = " | ".join(detail_parts) if detail_parts else "직접 답변 신호 미검출"
    return Check("직접 답변 구조", score, 10, detail, passed=score >= 7)


def check_citation_density(html: str) -> Check:
    """법조문·판례 인용 밀도 (20pt)."""
    text = re.sub(r"<[^>]+>", "", html)

    laws = re.findall(r"민법 제\d+조(?:의\d+)?(?:\s*제\d+항)?", text)
    cases = re.findall(r"대법원\s+\d{4}\.\s*\d+\.\s*\d+\.", text)
    case_nums = re.findall(r"\d{2,4}[므스]\d+", text)

    law_count = len(set(laws))
    case_count = len(set(cases))
    case_num_count = len(set(case_nums))

    law_score = min(law_count, 6) / 6 * 10
    case_score = min(case_count + case_num_count, 4) / 4 * 10
    score = int(law_score + case_score)

    detail = (
        f"법조문 {law_count}종 | 대법원 판결일 {case_count}건 | "
        f"사건번호 {case_num_count}건"
    )
    return Check("법조문·판례 인용 밀도", score, 20, detail, passed=score >= 14)


def check_entity_signals(html: str, payloads: list[dict]) -> Check:
    """전문가 엔티티 신호 — 저자, 기관, 지역 (10pt)."""
    nodes = []
    for p in payloads:
        nodes.extend(flatten_nodes(p))

    score = 0
    detail_parts = []

    attorney_nodes = [n for n in nodes if "Attorney" in str(n.get("@type", ""))]
    if attorney_nodes:
        name = attorney_nodes[0].get("name", "")
        knows = attorney_nodes[0].get("knowsAbout", [])
        score += 3
        detail_parts.append(f"Attorney 엔티티: {name} +3")
        if len(knows) >= 3:
            score += 2
            detail_parts.append(f"knowsAbout {len(knows)}개 +2")

    area_nodes = [n for n in nodes if n.get("areaServed")]
    if area_nodes:
        areas = area_nodes[0].get("areaServed", [])
        score += 2
        detail_parts.append(f"areaServed: {areas} +2")

    if re.search(r"서울특별시|서초구|강남구", html):
        score += 2
        detail_parts.append("지역명 본문 포함 +2")

    if re.search(r"identifier|등록번호", html, flags=re.IGNORECASE):
        score += 1
        detail_parts.append("등록번호 필드 존재 +1")

    detail = " | ".join(detail_parts) if detail_parts else "엔티티 신호 미검출"
    return Check("전문가 엔티티 신호", min(score, 10), 10, detail, passed=score >= 7)


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    if not HTML_PATH.exists():
        print(f"geo-score: {HTML_PATH} not found", file=sys.stderr)
        return 2

    html = HTML_PATH.read_text(encoding="utf-8")
    payloads = extract_json_ld(html)

    report = Report()
    report.add(check_schema_types(payloads))
    report.add(check_faq_schema(payloads))
    report.add(check_question_headings(html))
    report.add(check_direct_answer(html))
    report.add(check_citation_density(html))
    report.add(check_entity_signals(html, payloads))

    pct = int(report.total / report.max_total * 100) if report.max_total else 0
    grade = "A" if pct >= 90 else "B" if pct >= 80 else "C" if pct >= 70 else "D"

    if "--json" in sys.argv:
        print(json.dumps({
            "total": report.total,
            "max": report.max_total,
            "pct": pct,
            "grade": grade,
            "passed": pct >= 80,
            "pass_threshold": 80,
            "checks": [
                {
                    "name": c.name,
                    "score": c.score,
                    "max_score": c.max_score,
                    "detail": c.detail,
                    "passed": c.passed,
                }
                for c in report.checks
            ],
        }, ensure_ascii=False))
        return 0

    report.print()

    if pct >= 80:
        print(f"geo-score passed ({pct}% >= 80%)")
        return 0
    else:
        print(f"geo-score failed ({pct}% < 80%)", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
