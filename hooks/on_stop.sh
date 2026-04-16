#!/bin/bash
# Claude hook: fires on Stop event (Claude finished responding, waiting for user)
# Writes state=waiting to ~/.claude/claude-web/states/{sessionId}.json

STATES_DIR="$HOME/.claude/claude-web/states"
mkdir -p "$STATES_DIR"

# Claude passes JSON on stdin with session context
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id', ''))" 2>/dev/null)

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

# Try to find the tmux session associated with this Claude PID
TMUX_SESSION=""
if [ -n "$TMUX" ]; then
  TMUX_SESSION=$(tmux display-message -p '#S' 2>/dev/null)
fi

TIMESTAMP=$(date +%s)
cat > "$STATES_DIR/${SESSION_ID}.json" <<EOF
{"state":"waiting","timestamp":$TIMESTAMP,"session_id":"$SESSION_ID","tmux_session":"$TMUX_SESSION"}
EOF
