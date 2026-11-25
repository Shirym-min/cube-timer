import { ArrowLeft } from "lucide-react";
import type { EventId, Session, Solve } from "../../lib/model";
import { pageURL, type FollowPage } from "../../navigation";
import { StatsRecords } from "./StatsRecords";
import type { Statistics } from "./useStatistics";

export function StatsRecordsPage({ session, event, precision, stats, followPage, setEditing }: {
  session: Session;
  event: EventId;
  precision: 2 | 3;
  stats: Pick<Statistics, "statsRecords" | "statsFrom" | "statsTo">;
  followPage: FollowPage;
  setEditing: (solve: Solve) => void;
}) {
  const { statsRecords, statsFrom, statsTo } = stats;
  return (
    <main id="main-content" tabIndex={-1} className="page-content">
      <header className="page-heading">
        <div>
          <a className="action-link stats-record-back" href={pageURL("stats")} onClick={(e) => followPage(e, "stats")}>
            <ArrowLeft size={16} aria-hidden="true" />統計に戻る
          </a>
          <h1>すべての記録</h1>
          <p className="muted">{session.name} · {statsRecords.length}件</p>
          {(statsFrom || statsTo) && <p className="muted">{statsFrom || "開始日なし"} ～ {statsTo || "終了日なし"}</p>}
        </div>
      </header>
      <StatsRecords
        items={statsRecords} className="stats-record-grid"
        hasDateRange={Boolean(statsFrom || statsTo)} event={event}
        precision={precision} setEditing={setEditing}
      />
    </main>
  );
}
