#!/usr/bin/env python3
"""GEO quality analyzer for the lawyer landing page.

Modes:
  dev  - local/demo scoring. noindex and demo data are warnings with score loss.
  persona - public staging scoring for an explicitly fictional AI GEO test page.
  prod - deployment scoring. noindex and demo data are critical failures.

Exit codes:
  0 = score meets the mode threshold and no critical failures
  1 = score below threshold or critical failures
  2 = required file missing
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = ROOT / "landing" / "index.html"

MODE_THRESHOLDS = {
    "dev": 80,
    "persona": 90,
    "prod": 90,
}

FORBIDDEN_AD_PHRASES = [
    "100% 승소",
    "반드시 승소",
    "무조건 승소",
    "최고 변호사",
    "1위",
    "보장합니다",
    "결과를 보장",
]

DEMO_MARKERS = [
    "데모",
    "가상의",
    "제XXXXX",
    "local.example",
    "02-000-0000",
    "010-0000-0000",
    "000-0000",
    "데모 주소",
]


@dataclass
class Check:
    name: str
    score: int
    max_score: int
    detail: str
    passed: bool = True
    critical: bool = False


@dataclass
class Report:
    mode: str
    checks: list[Check] = field(default_factory=list)

    @property
    def total(self) -> int:
        return sum(c.score for c in self.checks)

    @property
    def max_total(self) -> int:
        return sum(c.max_score for c in self.checks)

    @property
    def pct(self) -> int:
        return int(self.total / self.max_total * 100) if self.max_total else 0

    @property
    def grade(self) -> str:
        if self.pct >= 90:
            return "A"
        if self.pct >= 80:
            return "B"
        if self.pct >= 70:
            return "C"
        return "D"

    @property
    def threshold(self) -> int:
        return MODE_THRESHOLDS[self.mode]

    @property
    def critical_failures(self) -> list[str]:
        return [c.name for c in self.checks if c.critical and not c.passed]

    @property
    def passed(self) -> bool:
        return self.pct >= self.threshold and not self.critical_failures

    def add(self, check: Check) -> None:
        self.checks.append(check)

    def to_json(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "total": self.total,
            "max": self.max_total,
            "pct": self.pct,
            "grade": self.grade,
            "passed": self.passed,
            "pass_threshold": self.threshold,
            "critical_failures": self.critical_failures,
            "checks": [
                {
                    "name": c.name,
                    "score": c.score,
                    "max_score": c.max_score,
                    "detail": c.detail,
                    "passed": c.passed,
                    "critical": c.critical,
                }
                for c in self.checks
            ],
        }

    def print(self) -> None:
        print(f"\n=== GEO Quality Report ({self.mode}) ===\n")
        for c in self.checks:
            state = "PASS" if c.passed else "FAIL"
            marker = " CRITICAL" if c.critical else ""
            print(f"[{state}{marker}] {c.name}: {c.score}/{c.max_score}pt")
            print(f"      {c.detail}")
        print(f"\nTotal: {self.total}/{self.max_total} ({self.pct}%)")
        print(f"Grade: {self.grade}")
        if self.critical_failures:
            print("Critical failures: " + ", ".join(self.critical_failures))
        print()


def strip_html(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", value)).strip()


def extract_json_ld(html: str) -> tuple[list[dict[str, Any]], list[str]]:
    blocks = re.findall(
        r'<script\s+type="application/ld\+json">\s*(.*?)\s*</script>',
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    payloads: list[dict[str, Any]] = []
    errors: list[str] = []

    for idx, block in enumerate(blocks, start=1):
        try:
            parsed = json.loads(block)
        except json.JSONDecodeError as exc:
            errors.append(f"JSON-LD block {idx}: {exc}")
            continue
        if isinstance(parsed, dict):
            payloads.append(parsed)
        else:
            errors.append(f"JSON-LD block {idx}: root must be an object")

    return payloads, errors


def flatten_nodes(value: Any) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if "@type" in value:
            nodes.append(value)
        for child in value.values():
            nodes.extend(flatten_nodes(child))
    elif isinstance(value, list):
        for item in value:
            nodes.extend(flatten_nodes(item))
    return nodes


def get_all_types(payloads: list[dict[str, Any]]) -> set[str]:
    found: set[str] = set()
    for payload in payloads:
        for node in flatten_nodes(payload):
            node_type = node.get("@type")
            if isinstance(node_type, str):
                found.add(node_type)
            elif isinstance(node_type, list):
                found.update(str(item) for item in node_type)
    return found


def check_schema_types(payloads: list[dict[str, Any]], errors: list[str]) -> Check:
    required = {"LegalService", "Attorney", "Person", "FAQPage", "LocalBusiness"}
    found = get_all_types(payloads)
    present = required & found
    missing = sorted(required - found)
    score = int(len(present) / len(required) * 20)

    details = [f"필수 타입 {len(present)}/{len(required)}개 존재"]
    if missing:
        details.append("누락: " + ", ".join(missing))
    if errors:
        details.append("JSON-LD 오류: " + "; ".join(errors[:3]))

    return Check(
        "JSON-LD 필수 타입",
        score if not errors else 0,
        20,
        " | ".join(details),
        passed=not missing and not errors,
        critical=True,
    )


def check_faq_schema(payloads: list[dict[str, Any]]) -> Check:
    nodes: list[dict[str, Any]] = []
    for payload in payloads:
        nodes.extend(flatten_nodes(payload))

    faq_questions = [n for n in nodes if n.get("@type") == "Question"]
    count = len(faq_questions)
    long_answers = sum(
        1
        for q in faq_questions
        if len(str(q.get("acceptedAnswer", {}).get("text", ""))) >= 60
    )

    base = min(count, 8) / 8 * 8
    bonus = min(long_answers, 8) / 8 * 4
    score = int(base + bonus)
    return Check(
        "FAQPage JSON-LD 품질",
        score,
        12,
        f"FAQ 질문 {count}개 (목표 8개+) | 60자+ 직접 답변 {long_answers}개",
        passed=count >= 8 and long_answers >= 6,
        critical=True,
    )


def check_question_headings(html: str) -> Check:
    h2_matches = re.findall(r"<h2\b[^>]*>(.*?)</h2>", html, flags=re.IGNORECASE | re.DOTALL)
    question_h2 = [
        strip_html(h)
        for h in h2_matches
        if re.search(r"[?]|나요|인가요|하나요|보나요|언제|무엇", strip_html(h))
    ]
    count = len(question_h2)
    score = int(min(count, 6) / 6 * 12)
    sample = ", ".join(question_h2[:3]) if question_h2 else "없음"
    return Check(
        "질문형 H2 헤딩",
        score,
        12,
        f"질문형 H2 {count}개 (목표 5개+) | {sample}",
        passed=count >= 5,
    )


def check_direct_answer(html: str) -> Check:
    paragraphs = re.findall(r"<p\b[^>]*>(.*?)</p>", html, flags=re.IGNORECASE | re.DOTALL)
    text_paragraphs = [strip_html(p) for p in paragraphs[:8]]
    score = 0
    detail_parts: list[str] = []

    has_law_in_early = any(
        re.search(r"민법 제\d+조|대법원|판결|결정", p)
        for p in text_paragraphs[:4]
    )
    if has_law_in_early:
        score += 5
        detail_parts.append("초반 문단에 법조문/판례 포함 +5")

    has_direct_answer_cue = any(
        re.search(r"(합니다|됩니다|입니다|없습니다|있습니다)\.?", p)
        for p in text_paragraphs[:4]
    )
    if has_direct_answer_cue:
        score += 5
        detail_parts.append("문장 종결형 직접 답변 포함 +5")

    return Check(
        "직접 답변 구조",
        score,
        10,
        " | ".join(detail_parts) if detail_parts else "직접 답변 신호 미검출",
        passed=score >= 7,
    )


def check_citation_density(html: str) -> Check:
    text = strip_html(html)
    laws = re.findall(r"민법 제\d+조(?:의\d+)?(?:\s*제\d+항)?", text)
    cases = re.findall(r"대법원\s+\d{4}\.\s*\d+\.\s*\d+\.", text)
    case_nums = re.findall(r"\d{2,4}[므스]\d+", text)

    law_count = len(set(laws))
    case_count = len(set(cases))
    case_num_count = len(set(case_nums))

    law_score = min(law_count, 6) / 6 * 8
    case_score = min(case_count + case_num_count, 4) / 4 * 7
    score = int(law_score + case_score)

    return Check(
        "법조문·판례 인용 밀도",
        score,
        15,
        f"법조문 {law_count}종 | 대법원 판결일 {case_count}건 | 사건번호 {case_num_count}건",
        passed=score >= 11,
        critical=True,
    )


def check_entity_signals(html: str, payloads: list[dict[str, Any]]) -> Check:
    nodes: list[dict[str, Any]] = []
    for payload in payloads:
        nodes.extend(flatten_nodes(payload))

    score = 0
    detail_parts: list[str] = []

    attorney_nodes = [n for n in nodes if "Attorney" in str(n.get("@type", ""))]
    if attorney_nodes:
        attorney = attorney_nodes[0]
        name = attorney.get("name", "")
        knows = attorney.get("knowsAbout", [])
        score += 3
        detail_parts.append(f"Attorney 엔티티: {name} +3")
        if isinstance(knows, list) and len(knows) >= 3:
            score += 2
            detail_parts.append(f"knowsAbout {len(knows)}개 +2")

    area_nodes = [n for n in nodes if n.get("areaServed")]
    if area_nodes:
        areas = area_nodes[0].get("areaServed", [])
        score += 2
        detail_parts.append(f"areaServed: {areas} +2")

    if re.search(r"서울|서초구|강남구|경기|인천", html):
        score += 2
        detail_parts.append("지역명 본문 포함 +2")

    if re.search(r"identifier|등록번호", html, flags=re.IGNORECASE):
        score += 1
        detail_parts.append("등록번호 필드 존재 +1")

    return Check(
        "전문가 엔티티 신호",
        min(score, 10),
        10,
        " | ".join(detail_parts) if detail_parts else "엔티티 신호 미검출",
        passed=score >= 7,
    )


def check_legal_compliance(html: str) -> Check:
    found = [phrase for phrase in FORBIDDEN_AD_PHRASES if phrase in html]
    score = 0 if found else 8
    detail = "금지/고위험 표현 없음" if not found else "위험 표현: " + ", ".join(found)
    return Check(
        "변호사 광고 리스크",
        score,
        8,
        detail,
        passed=not found,
        critical=True,
    )


def check_indexability(html: str, mode: str) -> Check:
    robots_match = re.search(
        r'<meta\s+name=["\']robots["\']\s+content=["\']([^"\']+)["\']',
        html,
        flags=re.IGNORECASE,
    )
    robots = robots_match.group(1).lower() if robots_match else ""
    blocked = "noindex" in robots or "nofollow" in robots

    if mode == "persona":
        protected = "noindex" in robots and "nofollow" in robots
        detail = (
            f"robots meta: {robots}"
            if robots
            else "robots meta 없음"
        )
        detail += " | persona 모드에서는 검색 노출 방지를 위해 noindex,nofollow가 필요"
        return Check(
            "페르소나 색인 보호",
            7 if protected else 0,
            7,
            detail,
            passed=protected,
            critical=True,
        )

    score = 0 if blocked else 7
    detail = (
        f"robots meta: {robots}"
        if robots
        else "robots meta 없음. 배포 모드에서는 index,follow 또는 noindex 부재를 허용"
    )
    if blocked and mode == "dev":
        detail += " | dev 모드에서는 데모 보호용 noindex를 경고로 처리"

    return Check(
        "색인 가능성",
        score,
        7,
        detail,
        passed=not blocked,
        critical=mode == "prod",
    )


def has_persona_disclosure(html: str) -> bool:
    text = strip_html(html)
    has_demo_context = "데모" in text or "가상의" in text or "가상" in text
    clear_not_service = any(
        phrase in text
        for phrase in [
            "실제 법률 서비스가 아닙니다",
            "실제로 전송되지",
            "변호사·사무소 정보는 가상",
            "AI GEO 테스트",
        ]
    )
    return has_demo_context and clear_not_service


def check_demo_data(html: str, mode: str) -> Check:
    found = [marker for marker in DEMO_MARKERS if marker in html]

    if mode == "persona":
        disclosed = has_persona_disclosure(html)
        score = 6 if not found or disclosed else 0
        detail = "데모/placeholder 없음" if not found else "데모 marker: " + ", ".join(found[:8])
        detail += " | persona 모드에서는 명확한 가상 페이지/비서비스 고지가 필요"
        return Check(
            "페르소나 데모 고지",
            score,
            6,
            detail,
            passed=not found or disclosed,
            critical=True,
        )

    score = 0 if found else 6
    detail = "데모/placeholder 없음" if not found else "데모 marker: " + ", ".join(found[:8])
    if found and mode == "dev":
        detail += " | dev 모드에서는 경고로 처리"

    return Check(
        "데모 데이터 배포 차단",
        score,
        6,
        detail,
        passed=not found,
        critical=mode == "prod",
    )


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score lawyer landing page GEO readiness.")
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    parser.add_argument(
        "--mode",
        choices=sorted(MODE_THRESHOLDS),
        default=os.environ.get("GEO_SCORE_MODE", "dev"),
        help="scoring mode. persona requires demo protection; prod requires deployment readiness",
    )
    return parser.parse_args(argv)


def build_report(html: str, mode: str) -> Report:
    payloads, json_errors = extract_json_ld(html)

    report = Report(mode=mode)
    report.add(check_schema_types(payloads, json_errors))
    report.add(check_faq_schema(payloads))
    report.add(check_question_headings(html))
    report.add(check_direct_answer(html))
    report.add(check_citation_density(html))
    report.add(check_entity_signals(html, payloads))
    report.add(check_legal_compliance(html))
    report.add(check_indexability(html, mode))
    report.add(check_demo_data(html, mode))
    return report


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args(argv or sys.argv[1:])

    if not HTML_PATH.exists():
        print(f"geo-score: {HTML_PATH} not found", file=sys.stderr)
        return 2

    html = HTML_PATH.read_text(encoding="utf-8")
    report = build_report(html, args.mode)

    if args.json:
        print(json.dumps(report.to_json(), ensure_ascii=False))
        return 0 if report.passed else 1

    report.print()
    if report.passed:
        print(f"geo-score passed ({report.pct}% >= {report.threshold}%, mode={args.mode})")
        return 0

    reason = "critical failures" if report.critical_failures else "score below threshold"
    print(
        f"geo-score failed ({report.pct}% / threshold {report.threshold}%, {reason}, mode={args.mode})",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
