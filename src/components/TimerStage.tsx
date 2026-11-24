import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { Maximize2, X } from "lucide-react";
import { LastSolveActions } from "./LastSolveActions";
import { useTimer, type Phase } from "../lib/useTimer";
import {
  average,
  formatTime,
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
  manualMode: () => void;
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
  const running = timer.phase === "running";
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
  useLayoutEffect(() => {
    if (timer.phase === "stopped") surfacePress.current = null;
    onPhase(timer.phase);
  }, [timer.phase, onPhase]);
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
      <section className={`timer-stage ${timer.phase}`} aria-label="タイマー">
        {(enabled || running) && (
          <div
            className={running ? "timer-stop-surface" : "timer-start-surface"}
            aria-hidden="true"
            {...gestures}
          />
        )}
        <div className="timer-tools">
          <button type="button" className="text-button" onClick={manualMode} disabled={!enabled || timer.active}>
            手入力
          </button>
          <button
            className="icon-button"
            aria-label="集中表示"
            onClick={() => setFocus(!focus)}
          >
            {focus ? <X size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        <div className="timer-readout">
          <span className="timer-status" aria-live="polite">{status}</span>
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
