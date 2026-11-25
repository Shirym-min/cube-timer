import { Plus } from "lucide-react";
import { SessionRow } from "../components/SessionRow/SessionRow";
import type { Session, Solve } from "../lib/model";

export function SessionsPage({ sessions, solves, selectedId, openNewSession, selectSession, saveSession }: {
  sessions: Session[];
  solves: Solve[];
  selectedId: string;
  openNewSession: () => void;
  selectSession: (id: string) => void;
  saveSession: (session: Session) => Promise<void>;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="page-content">
      <header className="page-heading">
        <h1>セッション</h1>
        <button
          type="button"
          className="primary icon-button"
          aria-label="新規セッション"
          title="新規セッション"
          onClick={openNewSession}
        >
          <Plus size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="session-list">
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            count={
              solves.filter((x) => x.sessionId === s.id).length
            }
            current={s.id === selectedId}
            select={() => selectSession(s.id)}
            save={saveSession}
            canDelete={sessions.length > 1}
          />
        ))}
      </div>
    </main>
  );
}
