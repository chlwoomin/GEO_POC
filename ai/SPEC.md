# AI Workflow Specification

## Purpose

Provide a durable AI-agent workflow system for this repository. The system improves implementation quality through clear specs, milestone planning, repeatable validation, status tracking, diff review, debugging loops, safe stopping conditions, and reusable Codex skills.

## Non-Goals

- Do not implement application features yet.
- Do not choose the product architecture beyond what is needed to run the AI workflow.
- Do not add external dependencies just for the workflow scaffold.

## Requirements

### R1. Canonical Instructions

The repository must have a root `AGENTS.md` that tells Codex and compatible agents how to operate safely.

### R2. Project Spec

`ai/SPEC.md` must describe workflow intent, file contracts, done criteria, and non-goals.

### R3. Milestone Plan

`ai/PLAN.md` must break work into milestones and identify the next safe milestone.

### R4. Runbook

`ai/RUNBOOK.md` must describe the loop, validation commands, debugging steps, diff review, status updates, and stop conditions.

### R5. Status Tracking

`ai/STATUS.md` and `ai/METRICS.json` must record current state, validation results, loop attempts, and safety counters.

### R6. Prompt Reuse

`ai/prompts/` must contain reusable prompts for implementation, review, debugging, status updates, and final reporting.

### R7. Validation Harness

`scripts/validate.sh` must provide repeatable workflow validation and should run project checks when the project later defines them.

### R8. Result Scoring

`scripts/score-result.sh` must emit a lightweight machine-readable score for workflow readiness.

### R9. Codex Skills

`.codex/skills/` must include repo-local skills for milestone implementation, diff review, failure debugging, and status updates.

## File Contracts

- `AGENTS.md`: mandatory rules for all AI agents.
- `CLAUDE.md`: optional compatibility pointer for Claude Code only.
- `ai/SPEC.md`: stable workflow requirements.
- `ai/PLAN.md`: milestone queue and done criteria.
- `ai/RUNBOOK.md`: operational procedure.
- `ai/STATUS.md`: human-readable current status.
- `ai/METRICS.json`: machine-readable status and counters.
- `ai/prompts/*.md`: reusable prompt templates.
- `ai/archive/PROMPT.legacy.md`: archived historical prompt, not active instructions.
- `scripts/ai-loop.sh`: safe one-pass loop helper.
- `scripts/validate.sh`: validation entrypoint.
- `scripts/score-result.sh`: workflow score helper.
- `scripts/claude_review.py`: optional advisory Claude review helper.
- `scripts/setup_hooks.sh`: optional Claude hook installer for git repositories.
- `.codex/config.toml`: repo-local Codex configuration notes and supported Codex settings.
- `.codex/skills/*/SKILL.md`: compact procedural skills.

## Done Criteria

- All required workflow files exist.
- Skills have valid `SKILL.md` frontmatter.
- `ai/METRICS.json` parses as JSON.
- `scripts/validate.sh` succeeds on the scaffold.
- `scripts/score-result.sh` returns a score of at least 90.
- Status files identify the next milestone and safe stop conditions.
- Top-level legacy duplicates such as `ai/PROMPT.md`, `ai/agents.md`, and `ai/claude.md` do not exist.
- Claude review is optional and does not block the default Codex loop.
