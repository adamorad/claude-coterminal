import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import NewSessionModal from "./NewSessionModal";
import SessionDetail from "./SessionDetail";
import SessionTile from "./SessionTile";
import { useWebSocket } from "./useWebSocket";

function Dashboard({
  sessions,
  connected,
}: {
  sessions: ReturnType<typeof useWebSocket>["sessions"];
  connected: boolean;
}) {
  const [showNew, setShowNew] = useState(false);

  const working = sessions.filter((s) => s.state === "working");
  const waiting = sessions.filter((s) => s.state === "waiting");
  const done = sessions.filter((s) => s.state === "done");

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px 12px",
          paddingTop: "max(16px, env(safe-area-inset-top))",
          background: "#111",
          borderBottom: "1px solid #222",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Sessions</div>
          <div
            style={{
              fontSize: 11,
              color: connected ? "#22c55e" : "#ef4444",
              marginTop: 2,
            }}
          >
            {connected ? "● live" : "● reconnecting…"}
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            background: "#1d4ed8",
            border: "none",
            borderRadius: 22,
            padding: "8px 18px",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + New
        </button>
      </div>

      {/* Session lists */}
      <div style={{ flex: 1, padding: "16px 16px 24px", overflowY: "auto" }}>
        {sessions.length === 0 && (
          <div
            style={{
              color: "#444",
              textAlign: "center",
              marginTop: 60,
              fontSize: 15,
            }}
          >
            No active sessions.
            <br />
            <span style={{ fontSize: 13 }}>
              Run <code style={{ color: "#888" }}>cc</code> in your terminal to
              start one.
            </span>
          </div>
        )}

        {waiting.length > 0 && (
          <Section label="Waiting for you" color="#eab308" sessions={waiting} />
        )}
        {working.length > 0 && (
          <Section label="Working" color="#ef4444" sessions={working} />
        )}
        {done.length > 0 && (
          <Section label="Done" color="#22c55e" sessions={done} />
        )}
      </div>

      {showNew && (
        <NewSessionModal
          onClose={() => setShowNew(false)}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}

function Section({
  label,
  color,
  sessions,
}: {
  label: string;
  color: string;
  sessions: ReturnType<typeof useWebSocket>["sessions"];
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 10,
          paddingLeft: 2,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sessions.map((s) => (
          <SessionTile key={s.id} session={s} />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const { sessions, connected } = useWebSocket();

  return (
    <Routes>
      <Route
        path="/"
        element={<Dashboard sessions={sessions} connected={connected} />}
      />
      <Route
        path="/session/:id"
        element={<SessionDetail sessions={sessions} />}
      />
    </Routes>
  );
}
