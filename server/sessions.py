"""
Session discovery: reads ~/.claude/sessions/*.json (live PID files written by Claude)
and cross-references with ~/.claude/claude-web/states/{sessionId}.json for state.
"""

import json
import os
import time
from pathlib import Path
from typing import Optional

SESSIONS_DIR = Path.home() / ".claude" / "sessions"
STATES_DIR = Path.home() / ".claude" / "claude-web" / "states"
PROJECTS_DIR = Path.home() / ".claude" / "projects"


def _pid_is_interactive_claude(pid: int) -> bool:
    """Return True only if the PID is a user-launched interactive Claude session.
    Filters out:
    - Dead processes
    - Background daemons (--channels flag)
    - Subagents (parent process is itself claude)
    """
    import subprocess

    try:
        os.kill(pid, 0)
    except (ProcessLookupError, PermissionError):
        return False

    try:
        result = subprocess.run(
            ["ps", "-p", str(pid), "-o", "ppid=,command="],
            capture_output=True, text=True, timeout=2
        )
        out = result.stdout.strip()
        if not out:
            return False
        ppid_str, _, cmd = out.partition(" ")
        cmd = cmd.lower()

        if "claude" not in cmd:
            return False
        if "--channels" in cmd:
            return False

        # If parent process is also a claude binary → this is a subagent, skip it
        # Check executable name only (not full args) to avoid false matches like "claude-plugins-official"
        ppid = int(ppid_str.strip())
        parent = subprocess.run(
            ["ps", "-p", str(ppid), "-o", "comm="],  # comm= gives just the executable name
            capture_output=True, text=True, timeout=2
        )
        parent_exe = parent.stdout.strip().lower()
        if parent_exe in ("claude", "node") and "claude" in cmd:
            # node check: claude is sometimes a node script; if parent is node running claude → subagent
            # Be more specific: only filter if parent comm is literally "claude"
            if parent_exe == "claude":
                return False

        return True
    except Exception:
        return False


def _cwd_to_slug(cwd: str) -> str:
    """Convert /home/user/repos/foo → -home-user-repos-foo"""
    return cwd.replace("/", "-")


def _read_state(session_id: str) -> str:
    """Read state from hook-written file. Returns 'working'|'waiting'|'done'."""
    state_file = STATES_DIR / f"{session_id}.json"
    if not state_file.exists():
        return "working"
    try:
        data = json.loads(state_file.read_text())
        return data.get("state", "working")
    except Exception:
        return "working"


def _read_state_data(session_id: str) -> dict:
    state_file = STATES_DIR / f"{session_id}.json"
    if not state_file.exists():
        return {}
    try:
        return json.loads(state_file.read_text())
    except Exception:
        return {}


def _get_preview(session_id: str, cwd: str) -> Optional[str]:
    """Return the last assistant message text (truncated) for tile preview."""
    slug = _cwd_to_slug(cwd)
    jsonl_path = PROJECTS_DIR / slug / f"{session_id}.jsonl"
    if not jsonl_path.exists():
        return None
    try:
        lines = jsonl_path.read_text().strip().splitlines()
        # Walk backwards to find last assistant message
        for line in reversed(lines):
            try:
                entry = json.loads(line)
                if entry.get("type") == "assistant":
                    content = entry.get("message", {}).get("content", [])
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            text = block["text"].strip()
                            return text[:120] + "…" if len(text) > 120 else text
            except Exception:
                continue
    except Exception:
        pass
    return None


def list_sessions() -> list[dict]:
    """Return all currently active Claude sessions."""
    if not SESSIONS_DIR.exists():
        return []

    sessions = []
    for pid_file in SESSIONS_DIR.glob("*.json"):
        try:
            data = json.loads(pid_file.read_text())
        except Exception:
            continue

        pid = data.get("pid")
        session_id = data.get("sessionId")
        cwd = data.get("cwd", "")
        started_at = data.get("startedAt", 0)

        if not pid or not session_id:
            continue

        alive = _pid_is_interactive_claude(int(pid))

        # Skip dead sessions entirely — no point showing them without tmux
        if not alive:
            continue

        state_data = _read_state_data(session_id)
        state = state_data.get("state", "working")
        tmux_session = state_data.get("tmux_session", "")

        # Filter stale sessions: alive but no activity for >6h and no tmux attached
        started_ts = started_at // 1000 if started_at > 1e10 else started_at
        last_activity = state_data.get("timestamp", started_ts)
        if not tmux_session and (time.time() - last_activity) > 6 * 3600:
            continue

        preview = _get_preview(session_id, cwd)

        sessions.append(
            {
                "id": session_id,
                "pid": pid,
                "cwd": cwd,
                "name": os.path.basename(cwd) or cwd,
                "tmux_session": tmux_session,
                "state": state,
                "preview": preview,
                "started_at": started_at,
                "last_activity": last_activity,
            }
        )

    sessions.sort(key=lambda s: s["started_at"], reverse=True)
    return sessions


def get_session(session_id: str) -> Optional[dict]:
    for s in list_sessions():
        if s["id"] == session_id:
            return s
    return None
