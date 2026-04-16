"""
Reads ~/.claude/projects/{cwd-slug}/{sessionId}.jsonl and returns parsed messages.
"""

import json
from pathlib import Path
from typing import Optional

PROJECTS_DIR = Path.home() / ".claude" / "projects"


def _cwd_to_slug(cwd: str) -> str:
    return cwd.replace("/", "-")


def _extract_text(content) -> str:
    """Extract plain text from Claude message content (list of blocks or plain string)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "tool_use":
                    parts.append(f"[tool: {block.get('name', '?')}]")
        return "\n".join(p for p in parts if p)
    return str(content)


def get_history(session_id: str, cwd: str) -> list[dict]:
    """Return list of {role, text, timestamp, uuid} for user + assistant messages."""
    slug = _cwd_to_slug(cwd)
    jsonl_path = PROJECTS_DIR / slug / f"{session_id}.jsonl"

    if not jsonl_path.exists():
        return []

    messages = []
    try:
        for line in jsonl_path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except Exception:
                continue

            entry_type = entry.get("type")
            ts = entry.get("timestamp", "")

            if entry_type == "user":
                msg = entry.get("message", {})
                content = msg.get("content", "")
                text = _extract_text(content)
                if text.strip():
                    messages.append(
                        {
                            "role": "user",
                            "text": text,
                            "timestamp": ts,
                            "uuid": entry.get("uuid", ""),
                        }
                    )

            elif entry_type == "assistant":
                msg = entry.get("message", {})
                content = msg.get("content", [])
                text = _extract_text(content)
                if text.strip():
                    messages.append(
                        {
                            "role": "assistant",
                            "text": text,
                            "timestamp": ts,
                            "uuid": entry.get("uuid", ""),
                        }
                    )
    except Exception:
        pass

    return messages
