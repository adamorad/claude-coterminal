export type SessionState = "working" | "waiting" | "done";

export interface Session {
  id: string;
  pid: number;
  cwd: string;
  name: string;
  tmux_session: string;
  state: SessionState;
  preview: string | null;
  started_at: number;
  last_activity: number;
}

export interface Message {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  uuid: string;
}
