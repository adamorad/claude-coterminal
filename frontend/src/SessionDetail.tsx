import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Message, Session } from "./types";

function formatTime(ts: string): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          background: isUser ? "#1d4ed8" : "#1e1e1e",
          border: isUser ? "none" : "1px solid #2a2a2a",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "10px 14px",
          fontSize: 14,
          lineHeight: 1.5,
          color: isUser ? "#fff" : "#e0e0e0",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {msg.text}
      </div>
      <div
        style={{ fontSize: 10, color: "#555", marginTop: 3, paddingLeft: 4 }}
      >
        {formatTime(msg.timestamp)}
      </div>
    </div>
  );
}

export default function SessionDetail({ sessions }: { sessions: Session[] }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const session = sessions.find((s) => s.id === id);

  const fetchHistory = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/sessions/${id}/history`);
      if (res.ok) setMessages(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchHistory();
    // Poll history every 3s while session is working or waiting
    pollRef.current = setInterval(fetchHistory, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !id || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail ?? "Failed to send");
      } else {
        setReply("");
        setTimeout(fetchHistory, 800);
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setSending(false);
    }
  };

  const stateColor: Record<string, string> = {
    working: "#ef4444",
    waiting: "#eab308",
    done: "#22c55e",
  };
  const color = stateColor[session?.state ?? "done"] ?? "#888";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "#0d0d0d",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "#111",
          borderBottom: "1px solid #222",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none",
            border: "none",
            color: "#aaa",
            fontSize: 22,
            cursor: "pointer",
            padding: "0 4px",
            lineHeight: 1,
          }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {session?.name ?? id?.slice(0, 8)}
          </div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>
            {session?.cwd}
          </div>
        </div>
        {session && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              color,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                display: "inline-block",
              }}
            />
            {session.state.charAt(0).toUpperCase() + session.state.slice(1)}
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 16px 8px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "#444",
              textAlign: "center",
              marginTop: 40,
              fontSize: 14,
            }}
          >
            No messages yet
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.uuid || msg.timestamp} msg={msg} />
        ))}
        {session?.state === "working" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#ef4444",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            <span style={{ animation: "pulse 1.5s infinite" }}>●</span>
            Claude is working…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {(session?.state === "waiting" ||
        session?.state === "done" ||
        !session) && (
        <div
          style={{
            padding: "12px 16px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            background: "#111",
            borderTop: "1px solid #222",
            flexShrink: 0,
          }}
        >
          {error && (
            <div
              style={{
                color: "#ef4444",
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendReply();
                }
              }}
              placeholder={
                session?.state === "done"
                  ? "Start next command…"
                  : "Reply to Claude…"
              }
              rows={1}
              style={{
                flex: 1,
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 20,
                padding: "10px 16px",
                color: "#e8e8e8",
                fontSize: 15,
                resize: "none",
                outline: "none",
                lineHeight: 1.4,
                maxHeight: 120,
                overflow: "auto",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={sendReply}
              disabled={sending || !reply.trim()}
              style={{
                background: sending || !reply.trim() ? "#333" : "#1d4ed8",
                border: "none",
                borderRadius: "50%",
                width: 42,
                height: 42,
                color: "#fff",
                fontSize: 18,
                cursor: sending || !reply.trim() ? "not-allowed" : "pointer",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
