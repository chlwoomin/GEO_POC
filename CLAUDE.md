# CLAUDE.md

This repository is Codex-first. For Claude Code interoperability, read `AGENTS.md` first and follow the same `ai/SPEC.md`, `ai/PLAN.md`, `ai/RUNBOOK.md`, `ai/STATUS.md`, and `ai/METRICS.json` workflow.

Do not create a separate Claude plan. Claude output is advisory unless the user explicitly makes it blocking.

Optional Claude review requires a git repository, `ANTHROPIC_API_KEY`, and the `anthropic` Python package. The default Codex loop must still work without Claude.
