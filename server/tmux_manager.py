"""
tmux interactions: create sessions, send keys, read pane output.
"""

import secrets
import subprocess
from pathlib import Path


def _run(cmd: list[str]) -> tuple[int, str, str]:
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def new_session(session_name: str, cwd: str, initial_cmd: str = "claude") -> bool:
    """Create a new detached tmux session running `initial_cmd` in `cwd`."""
    code, _, _ = _run(
        ["tmux", "new-session", "-d", "-s", session_name, "-c", cwd, initial_cmd]
    )
    return code == 0


def send_keys(session_name: str, text: str) -> bool:
    """Send text + Enter to a tmux session.
    Uses -l (literal) flag so tmux does not interpret special characters."""
    if not session_name:
        return False
    code, _, _ = _run(["tmux", "send-keys", "-l", "-t", session_name, text])
    if code != 0:
        return False
    code, _, _ = _run(["tmux", "send-keys", "-t", session_name, "Enter"])
    return code == 0


def capture_pane(session_name: str, lines: int = 50) -> str:
    """Return the last N lines of the tmux pane as a string."""
    code, out, _ = _run(
        ["tmux", "capture-pane", "-p", "-t", session_name, "-S", f"-{lines}"]
    )
    if code != 0:
        return ""
    return out


def kill_session(session_name: str) -> bool:
    code, _, _ = _run(["tmux", "kill-session", "-t", session_name])
    return code == 0


def session_exists(session_name: str) -> bool:
    code, _, _ = _run(["tmux", "has-session", "-t", session_name])
    return code == 0


def list_tmux_sessions() -> list[str]:
    code, out, _ = _run(["tmux", "list-sessions", "-F", "#{session_name}"])
    if code != 0:
        return []
    return [s for s in out.splitlines() if s]


def generate_session_name() -> str:
    return f"claude-{secrets.token_hex(6)}"
