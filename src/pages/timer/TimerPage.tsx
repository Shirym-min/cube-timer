import { ArrowUpRight } from "lucide-react";
import { Chart } from "../../components/Chart/Chart";
import { SolveForm } from "../../components/SolveForm";
import { TimerStage } from "../../components/TimerStage";
import type { EventId, Session, Settings, Solve } from "../../lib/model";
import { pageURL, type FollowPage } from "../../navigation";
import type { Statistics } from "../stats/useStatistics";
import { RecordsPane } from "./RecordsPane";
import { ScramblePanel } from "./ScramblePanel";
import type { useTimerSession } from "./useTimerSession";

export type MobileTimerTab = "timer" | "records";

export function TimerPage({
  session, sessions, event, solves, settings, setSelected, changeEvent,
  timer, stats, mobileTab, setMobileTab, focus, setFocus, blocked,
  manualMode, setManualMode, manualCount, incrementManualCount, search, setSearch,
  followPage, openManual, openNewSession, setEditing,
}: {
  session: Session;
  sessions: Session[];
  event: EventId;
  solves: Solve[];
  settings: Settings;
  setSelected: (id: string) => void;
  changeEvent: (event: EventId) => Promise<void>;
  timer: ReturnType<typeof useTimerSession>;
  stats: Pick<Statistics, "best" | "mean" | "finite" | "currentAverage" | "statsFormat">;
  mobileTab: MobileTimerTab;
  setMobileTab: (tab: MobileTimerTab) => void;
  focus: boolean;
  setFocus: (focus: boolean) => void;
  blocked: boolean;
  manualMode: boolean;
  setManualMode: (manual: boolean) => void;
  manualCount: number;
  incrementManualCount: () => void;
  search: string;
  setSearch: (search: string) => void;
  followPage: FollowPage;
  openManual: () => void;
  openNewSession: () => void;
  setEditing: (solve: Solve) => void;
}) {
  const { locked, timed, pending, finish, setTimerPhase, persistSolve, newSolve, patch, removeSolve } = timer;
  const { multiCount, scrambleBusy, scrambleError } = timer.scramble;
  const { best, mean, finite, currentAverage, statsFormat } = stats;
  const precision = settings.precision;
  const latest = solves.at(-1);
  return (
    <>
      <div className="mobile-tabs">
        <button
          aria-pressed={mobileTab === "timer"}
          className={mobileTab === "timer" ? "selected" : ""}
          onClick={() => setMobileTab("timer")}
        >
          計測
        </button>
        <button
          disabled={locked}
          aria-pressed={mobileTab === "records"}
          className={mobileTab === "records" ? "selected" : ""}
          onClick={() => setMobileTab("records")}
        >
          記録 <span>{solves.length}</span>
        </button>
      </div>
      <main id="main-content" tabIndex={-1} className={`timer-layout mobile-${mobileTab}`}>
        <h1 className="sr-only">タイマー</h1>
        <div className="timer-workspace">
          <ScramblePanel
            event={event} locked={locked} settings={settings}
            changeEvent={changeEvent} state={timer.scramble}
          />
          {manualMode ? (
            <section className="timer-stage manual-stage" aria-label="手入力">
              <div className="timer-tools">
                <button type="button" className="text-button" onClick={() => setManualMode(false)}>
                  タイマー
                </button>
              </div>
              <div className="manual-form">
                <SolveForm
                  key={`${session.id}:${event}:${manualCount}`}
                  event={event}
                  autoFocus={false}
                  disabled={scrambleBusy || !!scrambleError}
                  save={async (data) => {
                    await persistSolve({ ...newSolve(0, "OK", []), ...data });
                    incrementManualCount();
                  }}
                />
              </div>
            </section>
          ) : <TimerStage
            key={`${session.id}:${multiCount}`}
            settings={settings}
            event={event}
            enabled={
              !blocked &&
              !scrambleBusy &&
              !scrambleError &&
              !pending
            }
            onFinish={finish}
            onPhase={setTimerPhase}
            pending={pending}
            retry={() =>
              pending ? persistSolve(pending) : Promise.resolve()
            }
            latest={latest}
            patch={patch}
            edit={setEditing}
            remove={removeSolve}
            solves={solves}
            best={best}
            focus={focus}
            setFocus={setFocus}
            manualMode={() => { setFocus(false); setManualMode(true); }}
          />}
          <dl className="mobile-quick-stats" aria-label="セッションの統計">
            {(timed
              ? [
                  ["ao5", currentAverage(5)],
                  ["平均", statsFormat(mean)],
                  ["ao12", currentAverage(12)],
                  ["ベスト", statsFormat(best)],
                  ["ao50", currentAverage(50)],
                  ["ワースト", statsFormat(finite.length ? Math.max(...finite) : null)],
                  ["ao100", currentAverage(100)],
                  ["記録数", String(solves.length)],
                ]
              : event === "333fm"
                ? [
                    ["mo3", currentAverage(3)],
                    ["ベスト", statsFormat(best)],
                    ["記録数", String(solves.length)],
                  ]
                : [["記録数", String(solves.length)]]
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <section className="trend-panel">
            <div className="panel-heading">
              <h2>タイムの推移</h2>
              <a
                className="action-link text-button"
                href={locked ? undefined : pageURL("stats")}
                aria-disabled={locked || undefined}
                onClick={(e) => followPage(e, "stats")}
              >
                統計 <ArrowUpRight size={14} />
              </a>
            </div>
            {timed ? (
              <>
                <Chart solves={solves} />
                <div className="chart-legend">
                  <span>
                    <i />
                    タイム
                  </span>
                  <span>
                    <i />
                    ao5
                  </span>
                  <span className="muted">直近100回</span>
                </div>
              </>
            ) : (
              <p className="muted">
                {event === "333fm"
                  ? "最少手数は手数とmo3で集計します。"
                  : "複数目隠しは成功数・挑戦数・時間を記録します。"}
                統計画面で確認できます。
              </p>
            )}
          </section>
        </div>
        <RecordsPane
          session={session} sessions={sessions} solves={solves} best={best}
          timed={timed} precision={precision} locked={locked} scrambleBusy={scrambleBusy}
          search={search} setSearch={setSearch} setSelected={setSelected}
          openNewSession={openNewSession} openManual={openManual} setEditing={setEditing}
        />
      </main>
    </>
  );
}
