#!/bin/bash
# Start the claude-web server on localhost:8765 (SSH tunnel accessible)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure states dir exists
mkdir -p ~/.claude/claude-web/states

echo "Starting claude-web on http://localhost:8765"
echo "Remote access: ssh -L 8765:localhost:8765 $(whoami)@<your-machine-ip>"
echo ""

# Bind to localhost only — use SSH tunnel or cloudflared for remote access
python3 -m uvicorn server.main:app --host 127.0.0.1 --port 8765
