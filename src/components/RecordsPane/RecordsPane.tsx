import { Plus, Timer, Trophy } from "lucide-react";
import { average, effective, formatResult, formatTime, type Session, type Solve } from "../../lib/model";

export function RecordsPane({
  session, sessions, solves, best, timed, precision, locked, scrambleBusy, search, setSearch,
  setSelected, openNewSession, openManual, setEditing,
}: {
  session: Session;
  sessions: Session[];
  solves: Solve[];
  best: number | null;
  timed: boolean;
  precision: 2 | 3;
  locked: boolean;
  scrambleBusy: boolean;
  search: string;
  setSearch: (search: string) => void;
  setSelected: (id: string) => void;
  openNewSession: () => void;
  openManual: () => void;
  setEditing: (solve: Solve) => void;
}) {
  const records = solves
    .map((s, i) => ({ s, index: i + 1 }))
    .reverse()
    .filter(
      ({ s, index }) =>
        !search ||
        `${index} ${formatResult(s, precision)} ${s.comment}`.includes(search),
    );
  return (
    <aside className="records-pane" aria-label="計測記録">
      <div className="session-toolbar">
        <label className="sr-only" htmlFor="session">
          セッション
        </label>
        <select
          id="session"
          value={session?.id}
          disabled={locked}
          onChange={(e) => setSelected(e.target.value)}
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className="icon-button"
          aria-label="新しいセッション"
          disabled={locked}
          onClick={openNewSession}
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="records-heading">
        <h2>
          記録 <span>{solves.length}</span>
        </h2>
        <button
          className="icon-button"
          aria-label="タイムを手入力"
          disabled={locked || scrambleBusy}
          onClick={openManual}
        >
          <Plus size={18} />
        </button>
      </div>
      {solves.length > 10 && (
        <input
          className="record-search"
          aria-label="記録を検索"
          placeholder="タイム・コメントを検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      <div className="records-scroll">
        {records.length ? (
          <table className="records-table">
            <thead>
              <tr>
                <th>#</th>
                <th>タイム</th>
                <th>{timed ? "ao5" : "判定"}</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 1000).map(({ s, index }) => (
                <tr
                  key={s.id}
                  className={index === solves.length ? "latest" : ""}
                >
                  <td>{index.toString().padStart(2, "0")}</td>
                  <td>
                    <button
                      disabled={locked}
                      onClick={() => setEditing(s)}
                    >
                      {formatResult(s, precision)}
                      {effective(s) === best && (
                        <Trophy size={12} aria-label="ベスト" />
                      )}
                      {s.comment && (
                        <span
                          className="comment-mark"
                          aria-label="コメントあり"
                        />
                      )}
                    </button>
                  </td>
                  <td>
                    {timed
                      ? formatTime(
                          average(solves.slice(0, index), 5),
                          precision,
                        )
                      : s.penalty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-records">
            <Timer size={26} strokeWidth={1.3} />
            <p>
              {search
                ? "該当する記録がありません"
                : "まだ記録がありません"}
            </p>
            {!search && (
              <button
                className="text-button"
                disabled={locked || scrambleBusy}
                onClick={openManual}
              >
                タイムを入力する <Plus size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
