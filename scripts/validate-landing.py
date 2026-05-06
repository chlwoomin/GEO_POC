#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = ROOT / "landing" / "index.html"
CSS_PATH = ROOT / "landing" / "styles.css"
IMAGE_PATH = ROOT / "landing" / "assets" / "family-law-consultation.png"


def fail(message: str) -> None:
    print(f"landing validation failed: {message}", file=sys.stderr)
    raise SystemExit(1)


def extract_json_ld(html: str) -> list[dict]:
    blocks = re.findall(
        r'<script\s+type="application/ld\+json">\s*(.*?)\s*</script>',
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if not blocks:
        fail("missing JSON-LD block")
    payloads = []
    for block in blocks:
        try:
            payloads.append(json.loads(block))
        except json.JSONDecodeError as exc:
            fail(f"invalid JSON-LD: {exc}")
    return payloads


def flatten_types(value) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        node_type = value.get("@type")
        if isinstance(node_type, str):
            found.add(node_type)
        elif isinstance(node_type, list):
            found.update(str(item) for item in node_type)
        for child in value.values():
            found.update(flatten_types(child))
    elif isinstance(value, list):
        for item in value:
            found.update(flatten_types(item))
    return found


def main() -> int:
    if not HTML_PATH.exists():
        fail("landing/index.html is missing")
    if not CSS_PATH.exists():
        fail("landing/styles.css is missing")
    if not IMAGE_PATH.exists() or IMAGE_PATH.stat().st_size < 1000:
        fail("hero bitmap asset is missing or too small")

    html = HTML_PATH.read_text(encoding="utf-8")
    css = CSS_PATH.read_text(encoding="utf-8")

    for required in [
        "<title>",
        'meta name="description"',
        'meta name="robots" content="noindex, nofollow"',
        "family-law-consultation.png",
        "민법 제839조의2",
        "민법 제840조",
        "대법원 2021. 12. 16. 자 2017스628",
    ]:
        if required not in html:
            fail(f"missing required content: {required}")

    for forbidden in ["100% 승소", "최고 변호사", "1위", "보장합니다", "반드시 승소"]:
        if forbidden in html:
            fail(f"forbidden legal advertising phrase: {forbidden}")

    h2_count = len(re.findall(r"<h2\b", html, flags=re.IGNORECASE))
    question_h2_count = len(re.findall(r"<h2\b[^>]*>[^<]*(?:\?|나요|인가요|하나요|보나요)", html))
    if h2_count < 7:
        fail(f"expected at least 7 h2 elements, found {h2_count}")
    if question_h2_count < 5:
        fail(f"expected at least 5 question-style h2 elements, found {question_h2_count}")

    # Accept <details> accordion or div/button-based FAQ pattern
    faq_count = len(re.findall(r"<details\b", html, flags=re.IGNORECASE))
    if faq_count == 0:
        faq_count = len(re.findall(r'class="faq-item"', html, flags=re.IGNORECASE))
    if faq_count == 0:
        faq_count = len(re.findall(r'class="faq-q"', html, flags=re.IGNORECASE))
    if faq_count < 8:
        fail(f"expected at least 8 FAQ items, found {faq_count}")

    payloads = extract_json_ld(html)
    all_types = set()
    for payload in payloads:
        all_types.update(flatten_types(payload))
    required_types = {"LegalService", "Attorney", "Person", "FAQPage", "LocalBusiness"}
    missing = sorted(required_types - all_types)
    if missing:
        fail(f"missing JSON-LD types: {', '.join(missing)}")

    faq_payload_text = json.dumps(payloads, ensure_ascii=False)
    if faq_payload_text.count('"@type": "Question"') < 8:
        fail("FAQPage JSON-LD needs at least 8 questions")

    if "card" in css.lower() and "card card" in css.lower():
        fail("nested-card style smell found")

    print("landing validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
