#!/usr/bin/env python3
"""Required Claude review helper for the Codex-first Ralph Loop.

This script writes REVIEW.md. Missing git, ANTHROPIC_API_KEY, or the anthropic
package is a gate failure unless CLAUDE_REVIEW_ALLOW_SKIP=1 is set explicitly.
"""

from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MODEL = os.environ.get("CLAUDE_REVIEW_MODEL", "claude-sonnet-4-5")


def run_git(*args: str) -> tuple[int, str, str]:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def is_git_repo() -> bool:
    code, _, _ = run_git("rev-parse", "--show-toplevel")
    return code == 0


def read_file_safe(path: Path, max_chars: int = 6000) -> str:
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return "(missing)"
    except UnicodeDecodeError:
        return "(unreadable encoding)"
    return text[:max_chars]


def get_commit_info() -> tuple[str, str]:
    code, sha, _ = run_git("rev-parse", "--short", "HEAD")
    if code != 0:
        return "uncommitted", "no git HEAD"

    _, message, _ = run_git("log", "-1", "--pretty=%s")
    return sha or "unknown", message or "no commit message"


def get_diff() -> str:
    code, diff, _ = run_git("diff", "HEAD~1", "HEAD", "--stat", "--patch", "--no-color")
    if code != 0 or not diff:
        _, diff, _ = run_git("diff", "--stat", "--patch", "--no-color", "HEAD")
    if len(diff) > 12000:
        return diff[:12000] + "\n\n... diff truncated ..."
    return diff or "(no diff found)"


def build_prompt(diff: str, sha: str, commit_message: str) -> str:
    return f"""You are the required secondary reviewer for a Codex-first repository.

Review the diff against these workflow files. Treat Codex workflow rules as authoritative.

## Commit
- SHA: {sha}
- Message: {commit_message}

## AGENTS.md
{read_file_safe(ROOT / "AGENTS.md")}

## ai/PLAN.md
{read_file_safe(ROOT / "ai" / "PLAN.md")}

## ai/STATUS.md
{read_file_safe(ROOT / "ai" / "STATUS.md")}

## Diff
{diff}

## Output format

### VERDICT: [PASS|WARN|FAIL]

### BLOCKERS
- ...

### WARNINGS
- ...

### FEEDBACK_FOR_CODEX
Concrete next actions. If there are no issues, write "proceed".
"""


def extract_verdict(response: str) -> str:
    for line in response.splitlines():
        normalized = line.strip().upper()
        if normalized.startswith("### VERDICT:"):
            value = normalized.replace("### VERDICT:", "").strip()
            if value in {"PASS", "WARN", "FAIL"}:
                return value
    return "WARN"


def write_review(content: str, verdict: str, sha: str, commit_message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    review_path = ROOT / "REVIEW.md"
    review_path.write_text(
        "# Claude Review\n"
        f"**Date**: {timestamp}\n"
        f"**Commit**: {sha} - {commit_message}\n"
        f"**VERDICT**: {verdict}\n\n"
        f"{content}\n",
        encoding="utf-8",
    )
    print(f"[claude-review] wrote REVIEW.md with verdict {verdict}")


def fail_or_skip(reason: str) -> int:
    if os.environ.get("CLAUDE_REVIEW_ALLOW_SKIP") == "1":
        print(f"[claude-review] skipped: {reason}", file=sys.stderr)
        return 0
    print(f"[claude-review] failed: {reason}", file=sys.stderr)
    return 2


def main() -> int:
    if not is_git_repo():
        return fail_or_skip("workspace is not a git repository")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return fail_or_skip("ANTHROPIC_API_KEY is not set")

    try:
        import anthropic
    except ImportError:
        return fail_or_skip("Python package 'anthropic' is not installed")

    sha, commit_message = get_commit_info()
    diff = get_diff()
    prompt = build_prompt(diff, sha, commit_message)

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    response = "".join(
        getattr(part, "text", "")
        for part in message.content
    ).strip()
    verdict = extract_verdict(response)
    write_review(response, verdict, sha, commit_message)

    if verdict == "FAIL":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
