#!/bin/bash
# cc — Claude Code session wrapper
# Usage: cc [directory]
# Creates a named tmux session running `claude`, attaches to it.
# The claude-web server can monitor and interact with the session.

WORK_DIR="${1:-$(pwd)}"

if [ ! -d "$WORK_DIR" ]; then
  echo "Error: directory not found: $WORK_DIR"
  exit 1
fi

SESSION_NAME="claude-$(date +%s)"

# Create detached tmux session
tmux new-session -d -s "$SESSION_NAME" -c "$WORK_DIR" "claude"

echo "Started session: $SESSION_NAME in $WORK_DIR"
echo "Attaching... (detach with Ctrl+B D)"

# Attach — user sees normal Claude terminal
tmux attach-session -t "$SESSION_NAME"
