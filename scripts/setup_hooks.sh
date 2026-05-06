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

if [ -f "$HOOK_PATH" ] && ! grep -q 'scripts/claude_review.py' "$HOOK_PATH"; then
  BACKUP="$HOOK_PATH.codex-backup.$(date +%Y%m%d%H%M%S)"
  cp "$HOOK_PATH" "$BACKUP"
  printf '[setup-hooks] backed up existing post-commit hook to %s\n' "$BACKUP"
fi

cat > "$HOOK_PATH" << 'EOF'
#!/usr/bin/env bash
set -u

REPO_ROOT="$(git rev-parse --show-toplevel)"

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  exit 0
fi

if command -v python3 >/dev/null 2>&1; then
  python3 "$REPO_ROOT/scripts/claude_review.py" || true
fi
EOF

chmod +x "$HOOK_PATH"

printf '[setup-hooks] optional Claude review hook installed: %s\n' "$HOOK_PATH"
printf '[setup-hooks] prerequisites: ANTHROPIC_API_KEY, python3, and the anthropic package\n'
