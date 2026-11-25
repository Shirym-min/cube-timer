import { formatResult, type EventId, type Solve } from "../../lib/model";

export function StatsRecords({ items, className, hasDateRange, event, precision, setEditing }: {
  items: Solve[];
  className: string;
  hasDateRange: boolean;
  event: EventId;
  precision: 2 | 3;
  setEditing: (solve: Solve) => void;
}) {
  if (!items.length) return (
    <p className="muted">{hasDateRange ? "指定期間の記録はありません。" : "まだ記録がありません。"}</p>
  );
  return (
    <div className={className}>
      {items.map((solve) => (
        <button type="button" key={solve.id} onClick={() => setEditing(solve)}>
          <span>{new Date(solve.createdAt).toLocaleDateString("ja-JP")}</span>
          <strong>{formatResult(solve, precision)}</strong>
          {event === "333mbf" && <span>{2 * (solve.solved ?? 0) - (solve.attempted ?? 0)}点</span>}
          {solve.comment && <span>{solve.comment}</span>}
        </button>
      ))}
    </div>
  );
}
