import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  formatTime,
  parseTime,
  type Solve,
  type EventId,
  type Penalty,
} from "../../lib/model";
export function SolveForm({
  solve,
  event,
  save,
  remove,
  autoFocus = true,
  disabled = false,
}: {
  solve?: Solve;
  event: EventId;
  save: (data: Partial<Solve>) => Promise<void>;
  remove?: () => Promise<void>;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const [time, setTime] = useState(solve ? formatTime(solve.ms) : ""),
    [penalty, setPenalty] = useState<Penalty>(solve?.penalty ?? "OK"),
    [comment, setComment] = useState(solve?.comment ?? ""),
    [moves, setMoves] = useState(String(solve?.moves ?? "")),
    [solved, setSolved] = useState(String(solve?.solved ?? "")),
    [attempted, setAttempted] = useState(String(solve?.attempted ?? "")),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          const data: Partial<Solve> = {
            ms: event === "333fm" ? 0 : parseTime(time),
            penalty,
            comment,
          };
          if (event === "333fm") {
            if (!/^\d+$/.test(moves) || +moves > 999)
              throw Error("手数を0〜999の整数で入力してください。");
            data.moves = +moves;
          }
          if (event === "333mbf") {
            if (
              !/^\d+$/.test(solved) ||
              !/^\d+$/.test(attempted) ||
              +attempted < 2 ||
              +attempted > 100 ||
              +solved > +attempted
            )
              throw Error(
                "成功数と挑戦数を確認してください。挑戦数は2〜100です。",
              );
            data.solved = +solved;
            data.attempted = +attempted;
            const points = 2 * data.solved - data.attempted;
            if (
              data.solved < 2 ||
              points < 0 ||
              data.ms! > Math.min(data.attempted * 600000, 3600000)
            )
              data.penalty = "DNF";
          }
          await save(data);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "保存できませんでした。",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {event === "333fm" ? (
        <label>
          手数
          <input
            autoFocus={autoFocus}
            type="number"
            min="0"
            max="999"
            required
            value={moves}
            onChange={(e) => setMoves(e.target.value)}
          />
        </label>
      ) : (
        <label>
          タイム
          <input
            autoFocus={autoFocus}
            inputMode="decimal"
            placeholder="12.345 または 1:23.456"
            value={time}
            required
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      )}
      {event === "333mbf" && (
        <div className="inline-fields">
          <label>
            成功数
            <input
              type="number"
              min="0"
              required
              value={solved}
              onChange={(e) => setSolved(e.target.value)}
            />
          </label>
          <label>
            挑戦数
            <input
              type="number"
              min="2"
              max="100"
              required
              value={attempted}
              onChange={(e) => setAttempted(e.target.value)}
            />
          </label>
        </div>
      )}
      <label>
        判定
        <select
          value={penalty}
          onChange={(e) => setPenalty(e.target.value as Penalty)}
        >
          <option value="OK">ペナルティなし</option>
          {!["333fm", "333mbf"].includes(event) && (
            <option value="+2">+2秒</option>
          )}
          <option value="DNF">DNF</option>
        </select>
      </label>
      <label>
        コメント
        <textarea
          value={comment}
          maxLength={2000}
          rows={3}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      {solve && (
        <>
          <p className="muted">
            {new Date(solve.createdAt).toLocaleString("ja-JP")}
          </p>
          <p className="scramble-detail">{solve.scramble}</p>
          {solve.splits.length > 0 && (
            <p className="muted">
              区間{" "}
              {[...solve.splits, solve.ms]
                .map((v, i, a) => formatTime(v - (a[i - 1] ?? 0)))
                .join(" · ")}
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy || disabled}>
        保存
      </button>
      {remove && (
        <button
          className="danger"
          type="button"
          disabled={busy}
          onClick={async () => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            setBusy(true);
            try {
              await remove();
            } catch {
              setError("削除できませんでした。");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Trash2 size={16} />
          {confirm ? "この記録を削除する" : "記録を削除"}
        </button>
      )}
    </form>
  );
}
