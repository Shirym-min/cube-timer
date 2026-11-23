import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, X, MoreHorizontal } from "lucide-react";
import { useTimer, type Phase } from "../lib/useTimer";
import {
  average,
  formatTime,
  formatResult,
  type Settings,
  type EventId,
  type Solve,
  type Penalty,
} from "../lib/model";
type Props = {
  settings: Settings;
  event: EventId;
  enabled: boolean;
  onFinish: (ms: number, penalty: Penalty, splits: number[]) => void;
  onPhase: (p: Phase) => void;
  scrambleBusy: boolean;
  pending: Solve | null;
  retry: () => Promise<void>;
  latest: Solve | undefined;
  patch: (s: Solve, p: Partial<Solve>) => Promise<void>;
  edit: (s: Solve) => void;
  solves: Solve[];
  best: number | null;
  focus: boolean;
  setFocus: (f: boolean) => void;
};
export function TimerStage({
  settings,
  event,
  enabled,
  onFinish,
  onPhase,
  scrambleBusy,
  pending,
  retry,
  latest,
  patch,
  edit,
  solves,
  best,
  focus,
  setFocus,
}: Props) {
  const timer = useTimer(
    {
      ...settings,
      inspection:
        settings.inspection &&
        !["333bf", "444bf", "555bf", "333mbf", "333fm"].includes(event),
    },
    enabled,
    onFinish,
  );
  const touchRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = touchRef.current;
    if (!element || timer.phase !== "running") return;
    const position = () => {
      const rect = element.getBoundingClientRect();
      const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      const centerX = rect.left + rect.width / 2 - transform.m41;
      const centerY = rect.top + rect.height / 2 - transform.m42;
      element.style.setProperty('--timer-shift-x', `${innerWidth / 2 - centerX}px`);
      element.style.setProperty('--timer-shift-y', `${innerHeight / 2 - centerY}px`);
    };
    position();
    window.addEventListener('resize', position);
    return () => { window.removeEventListener('resize', position); };
  }, [timer.phase]);
  useEffect(() => {
    if (timer.phase !== "running") return;
    let pointer: number | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || pointer !== null) return;
      pointer = e.pointerId;
      e.preventDefault();
      e.stopPropagation();
      timer.down();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      e.preventDefault();
      e.stopPropagation();
      timer.up();
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      timer.cancelHold();
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
    };
  }, [timer.phase]);
  useLayoutEffect(() => onPhase(timer.phase), [timer.phase, onPhase]);
  const precision = settings.precision,
    timed = !["333fm", "333mbf"].includes(event);
  const statsFormat = (n: number | null) =>
    event === "333fm"
      ? n === null
        ? "—"
        : Number.isFinite(n)
          ? n.toFixed(2)
          : "DNF"
      : formatTime(n, precision);
  const showClock = timer.phase === "running" && !settings.hideRunning;
  const timeDisplay = timer.inspecting
    ? timer.elapsed >= 17000
      ? "DNF"
      : timer.elapsed >= 15000
        ? "+2"
        : String(Math.ceil((15000 - timer.elapsed) / 1000))
    : timer.phase === "running"
      ? "計測中"
      : formatTime(timer.elapsed, precision);
  const status =
    timer.phase === "running"
      ? settings.phases > 1
        ? `区間 ${timer.parts.length + 1} / ${settings.phases}`
        : "計測中"
      : timer.phase === "ready"
        ? "離してスタート"
        : timer.phase === "holding"
          ? "そのまま長押し"
          : timer.inspecting
            ? "インスペクション"
            : scrambleBusy
              ? "スクランブルを生成中"
              : timer.phase === "stopped"
                ? "計測完了"
                : "準備完了";
  return (
    <>
      <section className={`timer-stage ${timer.phase}`} aria-label="タイマー">
        <div className="timer-tools">
          <button
            className="icon-button"
            aria-label="集中表示"
            onClick={() => setFocus(!focus)}
          >
            {focus ? <X size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        <span className="timer-status" aria-live="polite">
          <i />
          {status}
        </span>
        <div
          className="timer-touch"
          ref={touchRef}
          role="button"
          aria-disabled={!enabled && timer.phase !== "running"}
          tabIndex={0}
          aria-label="長押しして離すと計測開始。計測中に押すと停止"
          onKeyDown={(e) => {
            if (e.code === "Enter" && !e.repeat) {
              e.preventDefault();
              timer.down();
            }
          }}
          onKeyUp={(e) => {
            if (e.code === "Enter") {
              e.preventDefault();
              timer.up();
            }
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            timer.down();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            timer.up();
          }}
          onPointerCancel={timer.cancelHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          {showClock ? (
            <RunningTime startedAt={timer.startedAt} precision={precision} />
          ) : (
            <TimerDigits value={timeDisplay} />
          )}
        </div>
        <div className="timer-instruction">
          {timer.phase === "running" ? (
            "タップ / Space で停止"
          ) : timer.inspecting ? (
            "長押しして離すと計測開始"
          ) : (
            <>
              <kbd>space</kbd>
              <span>または画面を長押しして離す</span>
            </>
          )}
        </div>
        {pending && timed && (
          <div className="unsaved" role="status">
            記録を保存中です。保存に失敗した場合は再試行してください。
            <button onClick={() => void retry().catch(() => {})}>再保存</button>
          </div>
        )}
        {latest && !timer.active && !pending && (
          <div className="last-actions">
            <span>直前 {formatResult(latest, precision)}</span>
            {timed && (
              <button
                className={latest.penalty === "+2" ? "selected" : ""}
                onClick={() =>
                  void patch(latest, {
                    penalty: latest.penalty === "+2" ? "OK" : "+2",
                  })
                }
              >
                +2
              </button>
            )}
            <button
              className={latest.penalty === "DNF" ? "selected" : ""}
              onClick={() =>
                void patch(latest, {
                  penalty: latest.penalty === "DNF" ? "OK" : "DNF",
                })
              }
            >
              DNF
            </button>
            <button aria-label="直前の記録を編集" onClick={() => edit(latest)}>
              <MoreHorizontal size={16} />
            </button>
          </div>
        )}
        <div className="quick-stats">
          {[
            ["ベスト", best],
            ["mo3", average(solves, 3)],
            ["ao5", average(solves, 5)],
            ["ao12", average(solves, 12)],
          ]
            .filter(
              (_, i) => event !== "333mbf" && (event !== "333fm" || i < 2),
            )
            .map(([label, value]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong>{statsFormat(value as number | null)}</strong>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}

function RunningTime({
  startedAt,
  precision,
}: {
  startedAt: number;
  precision: Settings["precision"];
}) {
  const [value, setValue] = useState(() => formatTime(0, precision));
  useEffect(() => {
    let frame = requestAnimationFrame(tick);
    function tick() {
      setValue(formatTime(Math.floor(performance.now() - startedAt), precision));
      frame = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(frame);
  }, [startedAt, precision]);
  return <TimerDigits value={value} />;
}

function TimerDigits({ value }: { value: string }) {
  const [integer, decimal] = value.split(".");
  return (
    <>
      <div
        className={`timer-digits ${!decimal ? "text-value" : ""}`}
        aria-hidden="true"
      >
        <span>{integer}</span>
        {decimal && (
          <>
            <span className="decimal-dot">.</span>
            <span className="decimals">{decimal}</span>
          </>
        )}
      </div>
      <span className="sr-only">{value}</span>
    </>
  );
}
