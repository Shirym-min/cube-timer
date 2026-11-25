import { useEffect, useRef, useState } from "react";
import { ToolPageHeader, type ToolBackLink } from "../ToolPageHeader/ToolPageHeader";
import { Modal } from "../Modal/Modal";
import { RecallCube, recallMasks } from "../RecallCube";
import { RecallControls, readSettings, recallCases, settingsKey, type RecallSettings } from "../RecallSettings";
import {
  Pause,
  Play,
  SkipForward,
  Eye,
  Settings2,
} from "lucide-react";

export function RecallTrainer({ backURL, onBack }: ToolBackLink) {
  const [settings, setSettings] = useState(readSettings);
  const { set, view, seconds, top, sides, aufEnabled, grayUnneeded } = settings;
  const [auf, setAuf] = useState(""),
    [running, setRunning] = useState(false),
    [reveal, setReveal] = useState(false),
    [index, setIndex] = useState(() =>
      Math.floor(Math.random() * recallCases[set].length),
    ),
    [remaining, setRemaining] = useState(seconds),
    [settingsOpen, setSettingsOpen] = useState(false);
  const deadline = useRef(0),
    current = recallCases[set][index % recallCases[set].length];
  function updateSettings(patch: Partial<RecallSettings>) {
    setSettings((previous) => ({ ...previous, ...patch }));
  }
  useEffect(() => {
    try {
      localStorage.setItem(settingsKey, JSON.stringify(settings));
    } catch {}
  }, [settings]);
  function next() {
    const count = recallCases[set].length;
    let n = Math.floor(Math.random() * Math.max(1, count - 1));
    if (n >= index && count > 1) n++;
    setIndex(n % count);
    setAuf(
      aufEnabled ? ["", "U", "U2", "U'"][Math.floor(Math.random() * 4)] : "",
    );
    setReveal(false);
    deadline.current = performance.now() + seconds * 1000;
    setRemaining(seconds);
  }
  useEffect(() => {
    setRunning(false);
    setAuf(
      aufEnabled ? ["", "U", "U2", "U'"][Math.floor(Math.random() * 4)] : "",
    );
    setIndex(Math.floor(Math.random() * recallCases[set].length));
    setReveal(false);
    setRemaining(seconds);
  }, [set]);
  useEffect(() => {
    deadline.current = performance.now() + seconds * 1000;
    setRemaining(seconds);
  }, [seconds, running]);
  useEffect(() => {
    if (!running) return;
    const update = () => {
      const left = deadline.current - performance.now();
      if (left <= 0) {
        next();
      } else setRemaining(Math.ceil(left / 1000));
    };
    const id = window.setInterval(update, 100);
    return () => clearInterval(id);
  }, [running, seconds, index, set]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.shiftKey ||
        settingsOpen ||
        document.querySelector("dialog[open], :popover-open")
      )
        return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      if (
        e.code === "Space" &&
        e.target instanceof HTMLElement &&
        e.target.closest("button, a")
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setRunning((value) => !value);
      } else if (e.code === "KeyN" || e.code === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.code === "KeyA") {
        e.preventDefault();
        setReveal((value) => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [settingsOpen, set, index, seconds, aufEnabled]);

  function changeAuf(enabled: boolean) {
    updateSettings({ aufEnabled: enabled });
    setAuf(enabled ? ["", "U", "U2", "U'"][Math.floor(Math.random() * 4)] : "");
    setReveal(false);
  }

  const controls = <RecallControls settings={settings} updateSettings={updateSettings} changeAuf={changeAuf} />;
  return (
    <main id="main-content" tabIndex={-1} className="page-content tool-page recall-page">
      <ToolPageHeader title="Recall Trainer" backURL={backURL} onBack={onBack}>
        <span className="recall-count">{recallCases[set].length} ケース</span>
        <button
          className="recall-settings-button"
          onClick={() => {
            setRunning(false);
            setSettingsOpen(true);
          }}
        >
          <Settings2 size={17} aria-hidden="true" />
          練習設定
        </button>
      </ToolPageHeader>
      <div className="recall-controls-desktop">{controls}</div>
      {settingsOpen && (
        <Modal title="練習設定" onClose={() => setSettingsOpen(false)}>
          {controls}
        </Modal>
      )}
      <section className="recall-stage" aria-label="キューブのパターン">
        <div className="recall-stage-top">
          <span className="recall-badge">{set}</span>
          <span aria-live="off">
            {running ? `${remaining} 秒` : "一時停止中"}
          </span>
        </div>
        <div className="recall-cube">
          <RecallCube
            alg={current.alg}
            auf={auf}
            view={view}
            top={top}
            sides={sides}
            rows={set === "F2L" ? 3 : 1}
            mask={view === "net" && grayUnneeded ? recallMasks[set] : undefined}
          />
        </div>
        <div className="recall-answer">
          {reveal ? (
            <>
              <strong>{current.name}</strong>
              <span>
                {auf
                  ? `${auf === "U" ? "U'" : auf === "U'" ? "U" : "U2"} `
                  : ""}
                {current.alg}
              </span>
            </>
          ) : (
            <span></span>
          )}
        </div>
      </section>
      <div className="recall-actions">
        <button
          className="primary"
          title="Space"
          onClick={() => setRunning(!running)}
        >
          {running ? <Pause size={17} /> : <Play size={17} />}{" "}
          {running ? "一時停止" : "開始"}
          <kbd className="shortcut-hint" aria-hidden="true">Space</kbd>
        </button>
        <button title="N / →" onClick={next}>
          <SkipForward size={17} />
          次のケース
          <kbd className="shortcut-hint" aria-hidden="true">N</kbd>
        </button>
        <button title="A" onClick={() => setReveal(!reveal)}>
          <Eye size={17} />
          {reveal ? "答えを隠す" : "答えを見る"}
          <kbd className="shortcut-hint" aria-hidden="true">A</kbd>
        </button>
      </div>
      <p className="recall-note">
        パターンの切り替えに合わせて、手元のキューブも持ち替えてください。
      </p>
    </main>
  );
}
