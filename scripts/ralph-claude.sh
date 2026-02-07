#!/usr/bin/env bash
set -euo pipefail

PROMPT_FILE="${1:-prompt.md}"

if ! command -v claude >/dev/null 2>&1; then
  echo "claude CLI not found in PATH" >&2
  exit 1
fi

# Typical usage (BUILD):
#   ./scripts/ralph-claude.sh
# Planning mode:
#   ./scripts/ralph-claude.sh .ralph/prompt.planning.md

require_clean_git() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Not a git repository. Run 'git init' (and ideally set a remote) first." >&2
    exit 1
  fi

  if [ -n "$(git status --porcelain)" ]; then
    echo "Refusing to run: working tree is not clean." >&2
    echo "Commit/stash/discard changes, then re-run." >&2
    git status --porcelain >&2
    exit 1
  fi
}

while :; do
  require_clean_git
  claude -p "$(cat "$PROMPT_FILE")" --dangerously-skip-permissions
  echo "\n--- (iteration complete; ctrl+c to stop) ---\n"
done
