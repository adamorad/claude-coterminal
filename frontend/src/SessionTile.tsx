import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session } from "./types";

const STATE_COLOR: Record<string, string> = {
  working: "#ef4444",
  waiting: "#eab308",
  done: "#22c55e",
};

const STATE_LABEL: Record<string, string> = {
  working: "Working",
  waiting: "Waiting",
  done: "Done",
};

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function SessionTile({ session }: { session: Session }) {
  const navigate = useNavigate();
  const [killing, setKilling] = useState(false);
  const color = STATE_COLOR[session.state] ?? "#888";

  const kill = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Kill session "${session.name}"?`)) return;
    setKilling(true);
    await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
  };

  return (
    <div
      onClick={() => navigate(`/session/${session.id}`)}
      style={{
        background: "#1a1a1a",
        border: `1px solid #2a2a2a`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 12,
        padding: "16px 18px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "background 0.15s",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        opacity: killing ? 0.4 : 1,
      }}
      onTouchStart={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "#222")
      }
      onTouchEnd={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "#1a1a1a")
      }
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: 15,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {session.name}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
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
                boxShadow:
                  session.state === "working" ? `0 0 6px ${color}` : undefined,
              }}
            />
            {STATE_LABEL[session.state]}
          </span>
          <button
            onClick={kill}
            title="Kill session"
            style={{
              background: "none",
              border: "none",
              color: "#555",
              fontSize: 16,
              cursor: "pointer",
              padding: "0 2px",
              lineHeight: 1,
              borderRadius: 4,
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#ef4444")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#555")
            }
          >
            ×
          </button>
        </span>
      </div>

      {/* CWD */}
      <div
        style={{
          fontSize: 11,
          color: "#666",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {session.cwd}
      </div>

      {/* Preview */}
      {session.preview && (
        <div
          style={{
            fontSize: 13,
            color: "#aaa",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            lineHeight: 1.4,
          }}
        >
          {session.preview}
        </div>
      )}

      {/* Footer */}
      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
        {timeAgo(session.last_activity)} · {session.tmux_session || "no tmux"}
      </div>
    </div>
  );
}
