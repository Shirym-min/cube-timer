import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Keyboard, Maximize2, Minimize2 } from "lucide-react";
import { LastSolveActions } from "../LastSolveActions/LastSolveActions";
import { useTimer, type Phase } from "../../lib/useTimer";
import {
  average,
  formatTime,
  type Settings,
  type EventId,
  type Solve,
  type Penalty,
} from "../../lib/model";
type Props = {
  settings: Settings;
  event: EventId;
  enabled: boolean;
  onFinish: (ms: number, penalty: Penalty, splits: number[]) => void;
  onPhase: (p: Phase) => void;
  pending: Solve | null;
  retry: () => Promise<void>;
  latest: Solve | undefined;
  patch: (s: Solve, p: Partial<Solve>) => Promise<void>;
  edit: (s: Solve) => void;
  remove: (s: Solve) => Promise<void>;
  solves: Solve[];
  best: number | null;
  focus: boolean;
  setFocus: (f: boolean) => void;
  manualMode?: () => void;
};
export function TimerStage({
  settings,
  event,
  enabled,
  onFinish,
  onPhase,
  pending,
  retry,
  latest,
  patch,
  edit,
  remove,
  solves,
  best,
  focus,
  setFocus,
  manualMode,
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
  const surfacePress = useRef<{ id: number; x: number; y: number } | null>(null);
  const [stopPointer, setStopPointer] = useState<number | null>(null);
  const running = timer.phase === "running";
  const stopSurface = running || stopPointer !== null;
  useLayoutEffect(() => {
    const element = touchRef.current;
    const readout = element?.parentElement;
    if (!element || !readout || (timer.phase !== "running" && !timer.inspecting)) return;
    const position = () => {
      const rect = readout.getBoundingClientRect();
      const fixed = getComputedStyle(readout).position === "fixed";
      element.style.setProperty("--timer-shift-x", `${fixed ? 0 : (innerWidth - rect.width) / 2 - rect.left}px`);
      element.style.setProperty("--timer-shift-y", `${fixed ? 0 : (innerHeight - rect.height) / 2 - rect.top}px`);
    };
    position();
    window.addEventListener('resize', position);
    return () => { window.removeEventListener('resize', position); };
  }, [timer.phase, timer.inspecting]);
  useLayoutEffect(() => {
    if (timer.phase === "stopped") surfacePress.current = null;
    onPhase(timer.inspecting ? "inspection" : timer.phase);
  }, [timer.phase, timer.inspecting, onPhase]);
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
    timer.phase === "ready"
      ? "離してスタート"
      : timer.phase === "holding"
        ? "そのまま長押し"
        : timer.inspecting
          ? "インスペクション"
          : "";
  function press(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || surfacePress.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    surfacePress.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    timer.down();
  }

  function cancelPress(event: PointerEvent<HTMLDivElement>) {
    if (surfacePress.current?.id !== event.pointerId) return;
    surfacePress.current = null;
    timer.cancelHold();
  }

  function movePress(event: PointerEvent<HTMLDivElement>) {
    const start = surfacePress.current;
    if (event.pointerType !== "touch" || start?.id !== event.pointerId || running || timer.inspecting) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 44) cancelPress(event);
  }

  function release(event: PointerEvent<HTMLDivElement>) {
    if (surfacePress.current?.id !== event.pointerId) return;
    event.preventDefault();
    surfacePress.current = null;
    timer.up();
  }

  const gestures = {
    onPointerDown: press,
    onPointerMove: movePress,
    onPointerUp: release,
    onPointerCancel: cancelPress,
    onLostPointerCapture: cancelPress,
    onContextMenu: (event: MouseEvent) => event.preventDefault(),
  };

  return (
    <>
      <section className={`timer-stage ${timer.phase} ${timer.inspecting ? "inspecting" : ""}`} aria-label="タイマー">
        {(enabled || stopSurface) && (
          <div
            className={stopSurface ? "timer-stop-surface" : "timer-start-surface"}
            aria-hidden="true"
            {...gestures}
            onPointerDown={(e) => {
              press(e);
              if (running && surfacePress.current?.id === e.pointerId) {
                setStopPointer(e.pointerId);
              }
            }}
            onPointerUp={(e) => {
              release(e);
              if (stopPointer === e.pointerId) {
                // Keep the tap on the stop surface until its click has been dispatched.
                requestAnimationFrame(() => setStopPointer(null));
              }
            }}
            onPointerCancel={(e) => {
              cancelPress(e);
              if (stopPointer === e.pointerId) setStopPointer(null);
            }}
            onLostPointerCapture={(e) => {
              cancelPress(e);
              if (stopPointer === e.pointerId) requestAnimationFrame(() => setStopPointer(null));
            }}
          />
        )}
        <div className="timer-tools">
          {manualMode && <button type="button" className="icon-button timer-mode-button" aria-label="手入力" title="手入力"
            onClick={manualMode} disabled={!enabled || timer.active}>
            <Keyboard size={19} aria-hidden="true" />
          </button>}
          <button
            className="icon-button"
            aria-label="集中表示"
            aria-pressed={focus}
            title={focus ? "集中表示を終了" : "集中表示"}
            onClick={() => setFocus(!focus)}
          >
            {focus ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        <div className="timer-readout">
          <span className="sr-only" aria-live="polite">{status}</span>
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
            {...gestures}
          >
            {showClock ? (
              <RunningTime startedAt={timer.startedAt} precision={precision} />
            ) : (
              <TimerDigits value={timeDisplay} />
            )}
          </div>
        </div>
        {timer.phase === "running" && settings.phases > 1 && (
          <span className="sr-only" role="status">
            区間 {timer.parts.length + 1} / {settings.phases}
          </span>
        )}
        <div className="timer-details">
          {pending && timed && (
            <div className="unsaved" role="status">
              記録を保存中です。保存に失敗した場合は再試行してください。
              <button onClick={() => void retry().catch(() => {})}>再保存</button>
            </div>
          )}
          {latest && !timer.active && !pending && (
            <LastSolveActions
              key={latest.id}
              solve={latest}
              precision={precision}
              timed={timed}
              patch={patch}
              edit={edit}
              remove={remove}
            />
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
        className={`timer-digits ${!decimal ? "text-value" : integer.length > 2 ? "long-value" : ""}`}
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
