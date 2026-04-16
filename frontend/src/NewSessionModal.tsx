import { useState } from "react";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function NewSessionModal({ onClose, onCreated }: Props) {
  const [cwd, setCwd] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cwd: cwd.trim() || undefined,
          initial_prompt: prompt.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Failed to create session");
      } else {
        onCreated();
        onClose();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1a1a1a",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
          New Session
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#888" }}>
            Working directory
          </label>
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="~/repos/my-project"
            style={{
              background: "#111",
              border: "1px solid #333",
              borderRadius: 10,
              padding: "10px 14px",
              color: "#e8e8e8",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "#888" }}>
            Initial prompt (optional)
          </label>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. what's the status of this repo?"
            style={{
              background: "#111",
              border: "1px solid #333",
              borderRadius: 10,
              padding: "10px 14px",
              color: "#e8e8e8",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}

        <button
          onClick={create}
          disabled={loading}
          style={{
            background: loading ? "#333" : "#1d4ed8",
            border: "none",
            borderRadius: 12,
            padding: "14px",
            color: "#fff",
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: 4,
          }}
        >
          {loading ? "Starting…" : "Start Session"}
        </button>
      </div>
    </div>
  );
}
