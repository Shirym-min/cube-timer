import { useEffect, useRef, useState } from "react";
import { ToolPageHeader, type ToolBackLink } from "./ToolPageHeader";
import { Modal } from "./Modal";
import { RecallCube, recallMasks } from "./RecallCube";
import { topColors, type TopColor } from "../lib/recallFaces";
import {
  Pause,
  Play,
  SkipForward,
  Eye,
  Settings2,
} from "lucide-react";
import existingCases from "../data/recall-cases.json";
import extraCases from "../data/recall-extra-cases.json";

const cases = { ...existingCases, ...extraCases };
type SetName = keyof typeof cases;
type View = "3d" | "top" | "net";
type RecallSettings = {
  set: SetName;
  view: View;
  seconds: number;
  top: TopColor;
  sides: number;
  aufEnabled: boolean;
  grayUnneeded: boolean;
};
const settingsKey = "split-recall-settings";
const defaults: RecallSettings = {
  set: "PLL",
  view: "3d",
  seconds: 5,
  top: "yellow",
  sides: 2,
  aufEnabled: false,
  grayUnneeded: false,
};
function readSettings(): RecallSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) ?? "null") as
      | Partial<RecallSettings>
      | null;
    if (!saved) return defaults;
    const { set, view, seconds, top, sides, aufEnabled, grayUnneeded } = saved;
    return {
      set: set && Object.hasOwn(cases, set) ? set : defaults.set,
      view: view === "3d" || view === "top" || view === "net" ? view : defaults.view,
      seconds:
        typeof seconds === "number" && Number.isInteger(seconds) && seconds >= 1 && seconds <= 10
          ? seconds
          : defaults.seconds,
      top: top && topColors.some(([color]) => color === top) ? top : defaults.top,
      sides: sides === 2 || sides === 3 || sides === 4 ? sides : defaults.sides,
      aufEnabled: aufEnabled === true,
      grayUnneeded: grayUnneeded === true,
    };
  } catch {
    return defaults;
  }
}

export function RecallTrainer({ backURL, onBack }: ToolBackLink) {
  const [settings, setSettings] = useState(readSettings);
  const { set, view, seconds, top, sides, aufEnabled, grayUnneeded } = settings;
  const [auf, setAuf] = useState(""),
    [running, setRunning] = useState(false),
    [reveal, setReveal] = useState(false),
    [index, setIndex] = useState(() =>
      Math.floor(Math.random() * cases[set].length),
    ),
    [remaining, setRemaining] = useState(seconds),
    [settingsOpen, setSettingsOpen] = useState(false);
  const deadline = useRef(0),
    current = cases[set][index % cases[set].length];
  function updateSettings(patch: Partial<RecallSettings>) {
    setSettings((previous) => ({ ...previous, ...patch }));
  }
  useEffect(() => {
    try {
      localStorage.setItem(settingsKey, JSON.stringify(settings));
    } catch {}
  }, [settings]);
  function next() {
    const count = cases[set].length;
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
    setIndex(Math.floor(Math.random() * cases[set].length));
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
  const controls = (
    <div className="recall-controls">
      <label>
        パターン
        <select
          aria-label="パターン"
          value={set}
          onChange={(e) => updateSettings({ set: e.target.value as SetName })}
        >
          {Object.keys(cases).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label>
        表示
        <select
          aria-label="表示"
          value={view}
          onChange={(e) => updateSettings({ view: e.target.value as View })}
        >
          <option value="3d">3D</option>
          <option value="top">上面</option>
          <option value="net">上面と側面</option>
        </select>
      </label>
      <label>
        上面の色
        <select
          aria-label="上面の色"
          value={top}
          onChange={(e) => updateSettings({ top: e.target.value as TopColor })}
        >
          {topColors.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {view === "net" && (
        <label>
          側面の数
          <select
            aria-label="側面の数"
            value={sides}
            onChange={(e) => updateSettings({ sides: Number(e.target.value) })}
          >
            <option value="2">2面</option>
            <option value="3">3面</option>
            <option value="4">4面</option>
          </select>
        </label>
      )}
      {view === "net" && (
        <label className="recall-mask-setting">
          <input
            type="checkbox"
            checked={grayUnneeded}
            onChange={(e) => updateSettings({ grayUnneeded: e.target.checked })}
          />
          <span>判別に不要な部分を灰色にする</span>
        </label>
      )}
      <label>
        AUF
        <select
          aria-label="AUF"
          value={aufEnabled ? "random" : "none"}
          onChange={(e) => {
            const enabled = e.target.value === "random";
            updateSettings({ aufEnabled: enabled });
            setAuf(
              enabled
                ? ["", "U", "U2", "U'"][Math.floor(Math.random() * 4)]
                : "",
            );
            setReveal(false);
          }}
        >
          <option value="none">なし</option>
          <option value="random">ランダム</option>
        </select>
      </label>
      <label className="recall-interval">
        <span>切り替え間隔 <output>{seconds}秒</output></span>
        <input
          aria-label="切り替え間隔"
          aria-valuetext={`${seconds}秒`}
          type="range"
          min={1}
          max={10}
          step={1}
          value={seconds}
          onChange={(e) => updateSettings({ seconds: e.target.valueAsNumber })}
        />
      </label>
    </div>
  );
  return (
    <main id="main-content" tabIndex={-1} className="page-content tool-page recall-page">
      <ToolPageHeader title="Recall Trainer" backURL={backURL} onBack={onBack}>
        <span className="recall-count">{cases[set].length} ケース</span>
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
