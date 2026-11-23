import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { RecallCube } from "./RecallCube";
import { topColors, type TopColor } from "../lib/recallFaces";
import {
  Pause,
  Play,
  SkipForward,
  Eye,
  ArrowLeft,
  Settings2,
} from "lucide-react";
import cases from "../data/recall-cases.json";
type SetName = keyof typeof cases;
type View = "3d" | "top" | "net";
export function RecallTrainer({ onBack }: { onBack: () => void }) {
  const [set, setSet] = useState<SetName>("PLL"),
    [view, setView] = useState<View>("3d"),
    [seconds, setSeconds] = useState(5),
    [top, setTop] = useState<TopColor>("yellow"),
    [sides, setSides] = useState(2),
    [aufEnabled, setAufEnabled] = useState(false),
    [auf, setAuf] = useState(""),
    [running, setRunning] = useState(false),
    [reveal, setReveal] = useState(false),
    [index, setIndex] = useState(() =>
      Math.floor(Math.random() * cases.PLL.length),
    ),
    [remaining, setRemaining] = useState(5),
    [settingsOpen, setSettingsOpen] = useState(false);
  const deadline = useRef(0),
    current = cases[set][index % cases[set].length];
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
          onChange={(e) => setSet(e.target.value as SetName)}
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
          onChange={(e) => setView(e.target.value as View)}
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
          onChange={(e) => setTop(e.target.value as TopColor)}
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
            onChange={(e) => setSides(Number(e.target.value))}
          >
            <option value="2">2面</option>
            <option value="3">3面</option>
            <option value="4">4面</option>
          </select>
        </label>
      )}
      <label>
        AUF
        <select
          aria-label="AUF"
          value={aufEnabled ? "random" : "none"}
          onChange={(e) => {
            const enabled = e.target.value === "random";
            setAufEnabled(enabled);
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
      <label>
        切り替え間隔
        <select
          aria-label="切り替え間隔"
          value={seconds}
          onChange={(e) => setSeconds(Number(e.target.value))}
        >
          {[2, 3, 4, 5, 7, 10, 15, 20, 30, 60].map((n) => (
            <option value={n} key={n}>
              {n}秒
            </option>
          ))}
        </select>
      </label>
    </div>
  );
  return (
    <main id="main-content" tabIndex={-1} className="recall-page">
      <header className="recall-header">
        <div>
          <button className="text-button recall-back" onClick={onBack}>
            <ArrowLeft size={15} />
            練習
          </button>
          <h1>Recall Trainer</h1>
        </div>
        <span className="recall-count">{cases[set].length} ケース</span>
      </header>
      <button
        className="recall-settings-button"
        onClick={() => {
          setRunning(false);
          setSettingsOpen(true);
        }}
      >
        <Settings2 size={17} />
        練習設定
      </button>
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
            rows={set === "OLL" || set === "PLL" ? 1 : 3}
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
