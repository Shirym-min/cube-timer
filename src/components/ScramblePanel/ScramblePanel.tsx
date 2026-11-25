import { lazy, Suspense, useState, useRef, useEffect, type PointerEvent } from "react";
import { Box, Lightbulb, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { EVENTS, type EventId, type Settings } from "../../lib/model";
import type { useTimerSession } from "../../pages/timer/useTimerSession";

const Diagram = lazy(() =>
  import("../Diagram/Diagram").then((m) => ({ default: m.Diagram })),
);
const Hint = lazy(() =>
  import("../Hint/Hint").then((m) => ({ default: m.Hint })),
);

export function ScramblePanel({ event, locked, settings, changeEvent, state }: {
  event: EventId;
  locked: boolean;
  settings: Settings;
  changeEvent: (event: EventId) => Promise<void>;
  state: ReturnType<typeof useTimerSession>["scramble"];
}) {
  const {
    scramble, scrambleBusy, scrambleError, scrambles,
    multiCount, multiIndex, setMultiCount, setMultiIndex, generate, previous, canGoBack, direction, copyScramble,
  } = state;
  const main = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const scrambleText = useRef<HTMLDivElement>(null);
  const scrambleCopy = useRef<HTMLButtonElement>(null);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  function updateScrollHint() {
    const viewport = scrambleText.current;
    const copy = scrambleCopy.current;
    // The outgoing animation can extend scrollHeight beyond the current scramble.
    setHasMoreBelow(!!viewport && !!copy &&
      copy.offsetHeight - viewport.clientHeight - viewport.scrollTop > 1);
  }
  useEffect(() => {
    const element = scrambleText.current;
    if (!element) return;
    element.scrollTop = 0;
    updateScrollHint();
    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(element);
    if (scrambleCopy.current) observer.observe(scrambleCopy.current);
    return () => observer.disconnect();
  }, [scramble, scrambleBusy, scrambleError]);
  useEffect(() => {
    const outer = main.current;
    const inner = content.current;
    if (!outer || !inner) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(outer);
      const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      outer.style.height = `${Math.ceil(inner.getBoundingClientRect().height + borders)}px`;
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);
  const drag = useRef<{ x: number; y: number; time: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  function startSwipe(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch" || locked || scrambleBusy) return;
    drag.current = { x: e.clientX, y: e.clientY, time: performance.now(), moved: false };
  }
  function moveSwipe(e: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture) return;
    const x = e.clientX - gesture.x;
    const y = e.clientY - gesture.y;
    if (!gesture.moved && Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) {
      drag.current = null;
      return;
    }
    if (Math.abs(x) > 8 && !gesture.moved) {
      gesture.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (gesture.moved) {
      const frame = e.currentTarget.querySelector<HTMLElement>(".scramble-frames");
      if (frame) {
        frame.style.transition = "none";
        frame.style.transform = `translateX(${x > 0 && !canGoBack ? x * 0.2 : x}px)`;
      }
    }
  }
  function endSwipe(e: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    drag.current = null;
    if (!gesture) return;
    const x = e.clientX - gesture.x;
    const frame = e.currentTarget.querySelector<HTMLElement>(".scramble-frames");
    if (frame) {
      frame.style.transition = "";
      frame.style.transform = "";
    }
    if (!gesture.moved || e.type === "pointercancel") return;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 400);
    const velocity = Math.abs(x) / Math.max(1, performance.now() - gesture.time);
    if (Math.abs(x) > 55 || (Math.abs(x) > 20 && velocity > 0.5)) {
      if (x > 0 && canGoBack) previous();
      if (x < 0) void generate();
    }
  }
  return (
    <section className="scramble-panel" aria-label="スクランブル">
      <div className="scramble-main" ref={main}>
        <div className="scramble-content" ref={content}>
        <div className="scramble-toolbar">
          <div className="event-selector">
            <Box size={17} />
            <label className="sr-only" htmlFor="event">
              種目
            </label>
            <select
              id="event"
              value={event}
              onChange={(e) =>
                void changeEvent(e.target.value as EventId)
              }
              disabled={locked}
            >
              {EVENTS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {event === "333mbf" && (
          <div className="multi-controls">
            <label>
              個数{" "}
              <input
                type="number"
                min="2"
                max="100"
                value={multiCount}
                disabled={locked || scrambleBusy}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 2 && n <= 100) setMultiCount(n);
                }}
              />
            </label>
            <label>
              表示{" "}
              <select
                value={multiIndex}
                onChange={(e) => setMultiIndex(+e.target.value)}
              >
                {scrambles.map((_, i) => (
                  <option key={i} value={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="scramble-row" data-direction={direction}>
          <button className="icon-button scramble-arrow" aria-label="前のスクランブル"
            disabled={locked || scrambleBusy || !canGoBack} onClick={previous}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className="scramble-viewport" onPointerDown={startSwipe}
            onPointerMove={moveSwipe} onPointerUp={endSwipe} onPointerCancel={endSwipe}>
            <div
              ref={scrambleText}
              className={`scramble-text ${scrambleBusy ? "loading" : ""}`}
              aria-live="polite"
              aria-busy={scrambleBusy}
              onScroll={updateScrollHint}
            >
              {scrambleError ? (
                <span role="alert">{scrambleError}</span>
              ) : scramble ? (
                <button
                  ref={scrambleCopy}
                  className="scramble-copy"
                  title="スクランブルをコピー"
                  aria-label="スクランブルをコピー"
                  aria-describedby="current-scramble"
                  disabled={scrambleBusy || locked}
                  onClick={(e) => {
                    if (suppressClick.current) return;
                    if (e.detail) e.currentTarget.blur();
                    void copyScramble();
                  }}
                >
                  <ScrambleSequence value={scramble} busy={scrambleBusy} />
                </button>
              ) : null}
            </div>
            <span className="scramble-progress" role="status">
              {scrambleBusy ? "生成中…" : ""}
            </span>
            {hasMoreBelow && !scrambleBusy && !scrambleError && (
              <span className="scramble-scroll-hint" aria-hidden="true">
                <ChevronDown size={17} />
              </span>
            )}
          </div>
          <button className="icon-button scramble-arrow" aria-label={scrambleError ? "再試行" : "次のスクランブル"}
            disabled={scrambleBusy || locked} onClick={() => void generate()}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        </div>
      </div>
      {settings.showDiagram && (
        <div className="diagram-panel">
          <div className="panel-heading">
            {["333", "333oh", "333fm"].includes(event) && (
              <Suspense
                fallback={
                  <button className="hint-button" disabled>
                    <Lightbulb size={15} />
                    ヒント
                  </button>
                }
              >
                <Hint
                  scramble={scramble}
                  face={settings.hintFace}
                  kind={settings.hintType}
                  disabled={
                    locked || scrambleBusy || !!scrambleError
                  }
                />
              </Suspense>
            )}
          </div>
          <Suspense
            fallback={
              <div className="diagram-placeholder">
                展開図を読み込み中…
              </div>
            }
          >
            {scrambleBusy || !scramble ? (
              <div className="diagram-placeholder" aria-hidden="true" />
            ) : (
              <Diagram event={event} scramble={scramble} />
            )}
          </Suspense>
        </div>
      )}
    </section>
  );
}

function ScrambleSequence({ value, busy }: { value: string; busy: boolean }) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState("");
  if (current !== value) {
    setPrevious(current);
    setCurrent(value);
  }
  return (
    <span className="scramble-frames" translate="no">
      {[previous, value].filter(Boolean).map((sequence, index, frames) => {
        const outgoing = index < frames.length - 1;
        return (
          <span
            key={sequence}
            id={outgoing ? undefined : "current-scramble"}
            className={outgoing ? "scramble-outgoing" : "scramble-sequence"}
            aria-hidden={outgoing || busy || undefined}
          >
            {sequence}
          </span>
        );
      })}
    </span>
  );
}
