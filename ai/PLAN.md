# AI Workflow Plan

## Milestone Status

- `planned`: ready to pick up
- `active`: currently being worked
- `done`: completed and validated
- `blocked`: stopped with a recorded reason

## Current Priority

Workflow scaffold and repository baseline cleanup are complete. Application features remain out of scope until the user approves a feature milestone.

## Milestones

### M0. Bootstrap AI Workflow Infrastructure

Status: `done`

Goal: Create the Codex-first Ralph Loop workflow scaffold.

Done criteria:

- [x] Root `AGENTS.md` exists.
- [x] Canonical `ai/` workflow files exist.
- [x] Reusable prompt templates exist.
- [x] Loop scripts exist.
- [x] Repo-local Codex config exists.
- [x] Repo-local Codex skills exist and validate.
- [x] Workflow validation passes.

### M1. Repository Baseline Discovery

Status: `done`

Goal: Discover the actual application stack, package manager, validation commands, and existing test surface without changing app behavior.

Done criteria:

- [x] Project structure is summarized in `ai/STATUS.md`.
- [x] Real validation commands are recorded in `ai/RUNBOOK.md`.
- [x] `scripts/validate.sh` runs those commands when available.
- [x] Risks and blockers are recorded.

### M2. First Feature Spec

Status: `planned`

Goal: Convert the next user-approved application objective into a clear implementation spec.

Done criteria:

- [ ] User goal is translated into acceptance criteria.
- [ ] Scope boundaries and non-goals are explicit.
- [ ] Validation plan is known before coding starts.

### M3. First Implementation Milestone

Status: `planned`

Goal: Implement the first approved feature milestone using the Ralph Loop.

Done criteria:

- [ ] One small feature slice is implemented.
- [ ] Validation passes.
- [ ] Diff is reviewed.
- [ ] Status and metrics are updated.

## Safety Gates

- Stop after 3 failed validation retries for the same milestone.
- Stop if a milestone needs more than 8 changed files or 400 changed lines without user approval.
- Stop if requirements conflict with existing project rules.
- Stop if validation requires network, secrets, or destructive operations that the user has not approved.
