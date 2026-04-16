"""
FastAPI server for claude-web session monitor.
Serves the React frontend + REST API + WebSocket.
"""

import asyncio
import json
import os
import re
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

_SESSION_ID_RE = re.compile(r'^[a-zA-Z0-9_-]+$')

def _validate_sid(session_id: str):
    if not _SESSION_ID_RE.match(session_id):
        raise HTTPException(status_code=400, detail="Invalid session ID")

from . import history, sessions, tmux_manager

app = FastAPI(title="claude-web")

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
STATES_DIR = Path.home() / ".claude" / "claude-web" / "states"

# ── WebSocket manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)


manager = ConnectionManager()
_last_sessions: list[dict] = []


async def _poll_sessions():
    """Background task: poll sessions every 2s and broadcast changes."""
    global _last_sessions
    while True:
        await asyncio.sleep(2)
        current = sessions.list_sessions()
        if current != _last_sessions:
            _last_sessions = current
            await manager.broadcast({"type": "update", "sessions": current})


@app.on_event("startup")
async def startup():
    STATES_DIR.mkdir(parents=True, exist_ok=True)
    asyncio.create_task(_poll_sessions())


# ── REST API ─────────────────────────────────────────────────────────────────

@app.get("/api/sessions")
def get_sessions():
    return sessions.list_sessions()


@app.get("/api/sessions/{session_id}/history")
def get_history(session_id: str):
    _validate_sid(session_id)
    session = sessions.get_session(session_id)
    if not session:
        # Session may have ended — try to reconstruct from JSONL anyway
        # by scanning all project dirs
        from . import history as h
        projects_dir = Path.home() / ".claude" / "projects"
        for project_dir in projects_dir.iterdir():
            jsonl = project_dir / f"{session_id}.jsonl"
            if jsonl.exists():
                cwd = project_dir.name.replace("-", "/").lstrip("/")
                # Reconstruct full path: slug -home-user-... → /home/user/...
                cwd_full = "/" + project_dir.name.lstrip("-").replace("-", "/", 1)
                # Better: read cwd from first entry
                try:
                    first = json.loads(jsonl.read_text().splitlines()[0])
                    cwd_full = first.get("cwd", "/" + project_dir.name.lstrip("-"))
                except Exception:
                    pass
                return h.get_history(session_id, cwd_full)
        raise HTTPException(status_code=404, detail="Session not found")
    return history.get_history(session_id, session["cwd"])


class ReplyBody(BaseModel):
    text: str


@app.post("/api/sessions/{session_id}/reply")
def reply_to_session(session_id: str, body: ReplyBody):
    _validate_sid(session_id)
    session = sessions.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    tmux = session.get("tmux_session")
    if not tmux:
        raise HTTPException(status_code=400, detail="No tmux session associated")
    ok = tmux_manager.send_keys(tmux, body.text)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to send keys to tmux session")
    return {"ok": True}


class NewSessionBody(BaseModel):
    cwd: str = ""
    initial_prompt: Optional[str] = None


@app.post("/api/sessions")
def create_session(body: NewSessionBody):
    cwd = body.cwd or str(Path.home())
    if not Path(cwd).exists():
        raise HTTPException(status_code=400, detail=f"Directory not found: {cwd}")
    name = tmux_manager.generate_session_name()
    ok = tmux_manager.new_session(name, cwd)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to create tmux session")
    if body.initial_prompt:
        # Give claude a moment to start before sending the prompt
        import time; time.sleep(1.5)
        tmux_manager.send_keys(name, body.initial_prompt)
    return {"ok": True, "tmux_session": name}


@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    _validate_sid(session_id)
    session = sessions.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    tmux = session.get("tmux_session")
    if tmux:
        tmux_manager.kill_session(tmux)
    # Clean up state file
    state_file = STATES_DIR / f"{session_id}.json"
    if state_file.exists():
        state_file.unlink()
    return {"ok": True}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    # Send current state immediately on connect
    await ws.send_json({"type": "update", "sessions": sessions.list_sessions()})
    try:
        while True:
            # Keep connection alive; actual updates come from _poll_sessions
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ── Serve frontend ────────────────────────────────────────────────────────────

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        index = FRONTEND_DIST / "index.html"
        return FileResponse(index)
