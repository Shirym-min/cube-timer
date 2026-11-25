import { useState } from "react";
import { ChevronRight, Layers, Trash2 } from "lucide-react";
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
  const [rename, setRename] = useState(false),
    [name, setName] = useState(session.name),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
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
        {current && <span className="session-current">選択中</span>}
        <ChevronRight size={16} />
      </button>
      <div className="session-row-actions">
        {rename ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              try {
                await save({ ...session, name: name.trim() });
                setRename(false);
              } catch {
                setError("保存できません。");
              }
            }}
          >
            <input
              aria-label="新しいセッション名"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
            <button>保存</button>
          </form>
        ) : (
          <button onClick={() => setRename(true)}>名前を変更</button>
        )}
        <button
          className="danger"
          disabled={!canDelete}
          onClick={async () => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            try {
              await save({ ...session, deleted: true });
            } catch {
              setError("削除できません。");
            }
          }}
        >
          <Trash2 size={15} />
          {confirm ? "セッションを削除する" : "削除"}
        </button>
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
