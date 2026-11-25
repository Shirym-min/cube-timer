import { lazy, Suspense, useState } from "react";
import { Box, Lightbulb, RefreshCw } from "lucide-react";
import { EVENTS, type EventId, type Settings } from "../../lib/model";
import type { useTimerSession } from "./useTimerSession";

const Diagram = lazy(() =>
  import("../../components/Diagram").then((m) => ({ default: m.Diagram })),
);
const Hint = lazy(() =>
  import("../../components/Hint/Hint").then((m) => ({ default: m.Hint })),
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
    multiCount, multiIndex, setMultiCount, setMultiIndex, generate, copyScramble,
  } = state;
  return (
    <section className="scramble-panel" aria-label="スクランブル">
      <div className="scramble-main">
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
        <div className="scramble-row">
          <div className="scramble-viewport">
            <div
              className={`scramble-text ${scrambleBusy ? "loading" : ""}`}
              aria-live="polite"
              aria-busy={scrambleBusy}
            >
              {scrambleError ? (
                <span role="alert">{scrambleError}</span>
              ) : scramble ? (
                <button
                  className="scramble-copy"
                  title="スクランブルをコピー"
                  aria-label="スクランブルをコピー"
                  aria-describedby="current-scramble"
                  disabled={scrambleBusy || locked}
                  onClick={(e) => {
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
          </div>
          <button
            className="icon-button scramble-refresh"
            data-generating={scrambleBusy || undefined}
            title={scrambleError ? "再試行" : "次のスクランブル"}
            aria-label={scrambleError ? "再試行" : "次のスクランブル"}
            disabled={scrambleBusy || locked}
            onClick={(e) => {
              if (e.detail) e.currentTarget.blur();
              void generate();
            }}
          >
            <span className="scramble-refresh-icon" aria-hidden="true">
              <RefreshCw size={17} />
            </span>
          </button>
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
