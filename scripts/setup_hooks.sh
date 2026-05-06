#!/usr/bin/env bash
set -u

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  printf '[setup-hooks] skipped: workspace is not a git repository\n'
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
HOOK_PATH="$HOOKS_DIR/post-commit"

mkdir -p "$HOOKS_DIR"

if [ -f "$HOOK_PATH" ] && ! grep -q 'scripts/claude-review-gate.sh' "$HOOK_PATH"; then
  BACKUP="$HOOK_PATH.codex-backup.$(date +%Y%m%d%H%M%S)"
  cp "$HOOK_PATH" "$BACKUP"
  printf '[setup-hooks] backed up existing post-commit hook to %s\n' "$BACKUP"
fi

cat > "$HOOK_PATH" << 'EOF'
#!/usr/bin/env bash
set -u

REPO_ROOT="$(git rev-parse --show-toplevel)"

bash "$REPO_ROOT/scripts/claude-review-gate.sh"
EOF

chmod +x "$HOOK_PATH"

printf '[setup-hooks] required Claude review hook installed: %s\n' "$HOOK_PATH"
printf '[setup-hooks] default backend: Claude Code CLI via claude command\n'
printf '[setup-hooks] API fallback: set CLAUDE_REVIEW_BACKEND=api with ANTHROPIC_API_KEY and anthropic package\n'
