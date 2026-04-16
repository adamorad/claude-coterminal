#!/bin/bash
# install.sh — wire up Claude hooks and add `cc` to PATH
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SETTINGS="$HOME/.claude/settings.json"
HOOK_STOP="$SCRIPT_DIR/hooks/on_stop.sh"
HOOK_TOOL="$SCRIPT_DIR/hooks/on_tool.sh"

# Make hooks executable
chmod +x "$HOOK_STOP" "$HOOK_TOOL" "$SCRIPT_DIR/cc" "$SCRIPT_DIR/start.sh"

echo "=== claude-coterminal install ==="
echo ""

# ── Ensure ~/.claude/settings.json exists ─────────────────────────────────
if [ ! -f "$SETTINGS" ]; then
  mkdir -p "$(dirname "$SETTINGS")"
  echo '{}' > "$SETTINGS"
  echo "Created $SETTINGS"
fi

# ── Patch ~/.claude/settings.json ─────────────────────────────────────────
echo "Patching $SETTINGS with Stop + PreToolUse hooks..."

python3 - "$SETTINGS" "$HOOK_STOP" "$HOOK_TOOL" <<'PYEOF'
import json, sys
settings_path, hook_stop, hook_tool = sys.argv[1], sys.argv[2], sys.argv[3]

with open(settings_path) as f:
    settings = json.load(f)

hooks = settings.setdefault("hooks", {})

# Stop hook → state=waiting
stop_hooks = hooks.setdefault("Stop", [])
stop_cmd = f"bash {hook_stop}"
if not any(
    any(h.get("command") == stop_cmd for h in entry.get("hooks", []))
    for entry in stop_hooks
):
    stop_hooks.append({"matcher": "", "hooks": [{"type": "command", "command": stop_cmd}]})
    print("  ✓ Added Stop hook")
else:
    print("  · Stop hook already present")

# PreToolUse hook → state=working
pre_hooks = hooks.setdefault("PreToolUse", [])
tool_cmd = f"bash {hook_tool}"
if not any(
    any(h.get("command") == tool_cmd for h in entry.get("hooks", []))
    for entry in pre_hooks
):
    pre_hooks.append({"matcher": "", "hooks": [{"type": "command", "command": tool_cmd}]})
    print("  ✓ Added PreToolUse hook")
else:
    print("  · PreToolUse hook already present")

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=2)
print("  ✓ Settings saved")
PYEOF

# ── PATH suggestion ────────────────────────────────────────────────────────
echo ""

# Detect shell RC file
if [ -n "$ZSH_VERSION" ] || [[ "$SHELL" == *zsh* ]]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ] || [[ "$SHELL" == *bash* ]]; then
  SHELL_RC="$HOME/.bashrc"
else
  SHELL_RC="$HOME/.profile"
fi

CC_PATH_LINE="export PATH=\"$SCRIPT_DIR:\$PATH\""

if grep -qF "$SCRIPT_DIR" "$SHELL_RC" 2>/dev/null; then
    echo "✓ PATH already includes $SCRIPT_DIR"
else
    echo "$CC_PATH_LINE" >> "$SHELL_RC"
    echo "✓ Added $SCRIPT_DIR to PATH in $SHELL_RC"
    echo "  Run: source $SHELL_RC"
fi

# ── Install Python deps ────────────────────────────────────────────────────
echo ""
echo "Installing Python dependencies..."
pip3 install -q -r "$SCRIPT_DIR/requirements.txt"
echo "✓ Python deps installed"

echo ""
echo "=== Done ==="
echo ""
echo "Next steps:"
echo "  1. source $SHELL_RC         (reload PATH)"
echo "  2. bash start.sh            (start server)"
echo "  3. cc [dir]                 (start a Claude session)"
echo "  4. Open http://localhost:8765 in browser"
echo ""
echo "Remote access from phone:"
echo "  ssh -L 8765:localhost:8765 $(whoami)@<your-machine-ip>"
echo "  — or —"
echo "  cloudflared tunnel --url http://localhost:8765"
