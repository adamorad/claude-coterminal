#!/bin/bash
# Claude hook: fires on PreToolUse event (Claude is actively working)
# Writes state=working to ~/.claude/claude-web/states/{sessionId}.json

STATES_DIR="$HOME/.claude/claude-web/states"
mkdir -p "$STATES_DIR"

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id', ''))" 2>/dev/null)

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

TMUX_SESSION=""
if [ -n "$TMUX" ]; then
  TMUX_SESSION=$(tmux display-message -p '#S' 2>/dev/null)
fi

# Only write if state is not already "working" (avoid file churn on every tool call)
STATE_FILE="$STATES_DIR/${SESSION_ID}.json"
CURRENT=$(STATE_FILE="$STATE_FILE" python3 -c "import json,os; d=json.load(open(os.environ['STATE_FILE'])); print(d.get('state',''))" 2>/dev/null)
if [ "$CURRENT" = "working" ]; then
  exit 0
fi

TIMESTAMP=$(date +%s)
cat > "$STATE_FILE" <<EOF
{"state":"working","timestamp":$TIMESTAMP,"session_id":"$SESSION_ID","tmux_session":"$TMUX_SESSION"}
EOF
