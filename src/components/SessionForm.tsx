import { useState } from "react";
import { EVENTS, type EventId, type Session } from "../lib/model";

export function SessionForm({
  initialEvent,
  onSave,
}: {
  initialEvent: EventId;
  onSave: (s: Session) => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [event, setEvent] = useState(initialEvent),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
          await onSave({
            id: crypto.randomUUID(),
            name: name.trim(),
            event,
            createdAt: Date.now(),
          });
        } catch {
          setError("保存できませんでした。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        名前
        <input
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: クロス練習"
        />
      </label>
      <label>
        種目
        <select
          value={event}
          onChange={(e) => setEvent(e.target.value as EventId)}
        >
          {EVENTS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="primary" disabled={busy}>
        作成
      </button>
    </form>
  );
}
