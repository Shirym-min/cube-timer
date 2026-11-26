import { useRef, useState } from "react";
import { Check, ChevronRight, Layers, Pencil, Trash2 } from "lucide-react";
import { EVENTS, type Session } from "../../lib/model";

export function SessionRow({
  session,
  count,
  current,
  select,
  save,
  canDelete,
}: {
  session: Session;
  count: number;
  current: boolean;
  select: () => void;
  save: (s: Session) => Promise<void>;
  canDelete: boolean;
}) {
  const renameButton = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [rename, setRename] = useState(false),
    [name, setName] = useState(session.name),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  function endRename() {
    setRename(false);
    setError("");
    requestAnimationFrame(() => renameButton.current?.focus());
  }

  return (
    <div className={`session-row ${current ? "current" : ""}`}>
      <button className="session-open" onClick={select}>
        <Layers size={22} />
        <span>
          <strong>{session.name}</strong>
          <small>
            {EVENTS.find((e) => e[0] === session.event)![1]} · {count}回
          </small>
        </span>
        {current && (
          <span className="session-current" title="選択中">
            <Check size={16} aria-hidden="true" />
            <span className="sr-only">選択中</span>
          </span>
        )}
        <ChevronRight size={16} />
      </button>
      <div className="session-row-actions">
        {rename ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim() || busy) return;
              setBusy(true);
              try {
                await save({ ...session, name: name.trim() });
                endRename();
              } catch {
                setError("保存できません。");
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              autoFocus
              aria-label="新しいセッション名"
              onKeyDown={(e) => {
                if (e.key === "Escape" && !e.nativeEvent.isComposing && !busy) endRename();
              }}
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
            <button disabled={busy || !name.trim()}>保存</button>
            <button type="button" disabled={busy} onClick={endRename}>キャンセル</button>
          </form>
        ) : (
          <button ref={renameButton} hidden={confirm} type="button" className="icon-button" aria-label="名前を変更" title="名前を変更"
            onClick={() => { setName(session.name); setError(""); setRename(true); }}>
            <Pencil size={16} aria-hidden="true" />
          </button>
        )}
        {!rename && <button
          className="danger"
          disabled={!canDelete || busy}
          onClick={async () => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            setBusy(true);
            try {
              await save({ ...session, deleted: true });
            } catch {
              setError("削除できません。");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Trash2 size={15} />
          {confirm ? "セッションを削除する" : "削除"}
        </button>}
        {confirm && <button type="button" disabled={busy} onClick={() => { setConfirm(false); setError(""); }}>キャンセル</button>}
      </div>
      {confirm && (
        <p className="muted">
          セッションとその記録を一覧から除きます。バックアップには履歴が残ります。
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
