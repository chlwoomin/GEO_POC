---
name: debug-failure
description: Diagnose and retry failed validation during the Ralph Loop. Use when scripts/validate.sh or another required command fails and Codex needs to isolate the first symptom, apply one bounded fix, update retry counters, or stop safely.
---

# Debug Failure

## Procedure

1. Capture the exact failing command and exit status.
2. Find the first failing symptom, not the longest stack trace.
3. Classify the failure as environment, syntax, test expectation, missing file, stale status, or unknown.
4. Inspect only the files needed to explain that symptom.
5. Apply one bounded fix.
6. Re-run the failing command.
7. If it still fails, update retry counters and repeat only within the configured limit.
8. Stop and record a blocker if the next fix would exceed scope, require secrets, require network approval, or change product design.

## Status Notes

Record failure details in `ai/STATUS.md`:

- command
- symptom
- suspected cause
- fix attempted
- retry count
- next action or blocker
