import { useState, type MouseEvent } from "react";
import { ArrowLeft, BookOpen, Copy, Settings2 } from "lucide-react";
import {
  BUFFERS, FACES, ORBITS, ORBIT_LABELS, bufferLetter, generateBld,
  generateRandomBld, loadBldScramble, traceMemoSteps, verifyMemo, type BldOptions, type MemoStep, type Orbit,
} from "../lib/bld";
import { formatTime } from "../lib/model";
import { BldReview } from "./BldReview";
import { Diagram } from "./Diagram";
import { Modal } from "./Modal";
import "./BldTrainer.css";

const defaultOptions: BldOptions = {
  EDGES: { min: 4, max: 8, buffer: "UF", breaks: "any" },
  CORNERS: { min: 3, max: 6, buffer: "UBL", breaks: "any" },
};
const limits = { EDGES: 16, CORNERS: 10 };
const faceColors = { U: "#f4f4f5", L: "#ff9b52", F: "#77d6a3", R: "#ff8585", B: "#89baff", D: "#ffdd70" };
const stickerOrder = {
  EDGES: [-1, 0, -1, 3, -1, 1, -1, 2, -1],
  CORNERS: [0, -1, 1, -1, -1, -1, 3, -1, 2],
};
const emptyMemo = { EDGES: "", CORNERS: "" };
const groupMemo = (memo: string) => memo.match(/.{1,2}/g)?.join(" ") ?? "交換なし";
type Exercise = Awaited<ReturnType<typeof generateBld>> & { steps: Record<Orbit, MemoStep[]> };
type Recall = { phase: "memo"; started: number } | { phase: "recall"; elapsed: number };

export function BldTrainer({ active, backURL, onBack, guideURL, onGuide }: {
  active: boolean;
  guideURL: string;
  onGuide: (event: MouseEvent<HTMLAnchorElement>) => void;
  backURL: string;
  onBack: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [mode, setMode] = useState<"random" | "conditions">("random");
  const [options, setOptions] = useState(defaultOptions);
  const [exercise, setExercise] = useState<Exercise>();
  const [popup, setPopup] = useState<"settings" | "letters" | "scramble" | "review">();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inputs, setInputs] = useState(emptyMemo);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showNet, setShowNet] = useState(() => matchMedia("(min-width: 1000px)").matches);
  const [feedback, setFeedback] = useState("");
  const [recall, setRecall] = useState<Recall>();
  const [scrambleInput, setScrambleInput] = useState("");
  const [scrambleInputError, setScrambleInputError] = useState("");
  const hidden = recall?.phase === "recall";
  const memorizing = recall?.phase === "memo";

  function setPuzzle(next: Awaited<ReturnType<typeof generateBld>>) {
    const steps = {
      EDGES: traceMemoSteps(next.pattern, "EDGES", next.options.EDGES.buffer),
      CORNERS: traceMemoSteps(next.pattern, "CORNERS", next.options.CORNERS.buffer),
    };
    setExercise({ ...next, steps });
    setInputs(emptyMemo);
    setFeedback("");
    setNotice("");
    setShowAnswer(false);
    setRecall(undefined);
  }

  async function importScramble() {
    setBusy(true);
    setScrambleInputError("");
    try {
      setPuzzle(await loadBldScramble(scrambleInput, options));
      setError("");
      setPopup(undefined);
    } catch (failure) {
      setScrambleInputError(failure instanceof Error ? failure.message : "スクランブルを読み込めませんでした。");
    } finally {
      setBusy(false);
    }
  }

  function advanceRecall() {
    if (recall?.phase === "memo") {
      setRecall({ phase: "recall", elapsed: performance.now() - recall.started });
      return;
    }
    if (recall?.phase === "recall") {
      setRecall(undefined);
      return;
    }
    setShowAnswer(false);
    setFeedback("");
    setInputs(emptyMemo);
    setRecall({ phase: "memo", started: performance.now() });
  }

  async function generate() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setPuzzle(await (mode === "random" ? generateRandomBld(options) : generateBld(options)));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "スクランブルを作成できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  function check() {
    if (!exercise || memorizing || busy) return;
    try {
      const [edges, corners] = ORBITS.map((orbit) =>
        verifyMemo(exercise.pattern, orbit, exercise.options[orbit].buffer, inputs[orbit]));
      setFeedback(edges || corners
        ? `揃っていないピースがエッジに ${edges} 個、コーナーに ${corners} 個あります。`
        : "エッジとコーナーがすべて揃いました。");
    } catch (failure) {
      setFeedback(failure instanceof Error ? failure.message : "交換文字列を検証できませんでした。");
    }
  }

  function closePopup() {
    setPopup(undefined);
  }

  return (
    <main id={active ? "main-content" : undefined} hidden={!active} tabIndex={-1} className="page-content bld-page">
      <div className="bld-workspace">
        <a className="action-link text-button bld-back" href={backURL} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> 練習
        </a>
        <header className="page-heading">
          <h1>BLD トレーナー</h1>
          <a className="action-link" href={guideURL} onClick={onGuide}>
            <BookOpen size={16} aria-hidden="true" /> ガイド
          </a>
        </header>
        <div className="bld-card">
          <div className="bld-section bld-solve">
            <div className="bld-heading">
              <h2>スクランブル</h2>
              <button type="button" className="text-button" aria-label="スクランブル設定"
                disabled={busy || !!recall} onClick={() => setPopup("settings")}>
                <Settings2 size={16} aria-hidden="true" /> 設定
              </button>
            </div>
            <div className="bld-generation">
              <select aria-label="スクランブルの種類" name="scramble-mode" value={mode} disabled={busy || !!recall}
                onChange={(event) => {
                  setMode(event.target.value === "random" ? "random" : "conditions");
                  setError("");
                }}>
                <option value="random">ランダム</option>
                <option value="conditions">条件付き</option>
              </select>
              <button type="button" className="primary" disabled={busy || !!recall} onClick={() => void generate()}>
                {busy ? "生成中…" : "スクランブルを生成"}
              </button>
            </div>
            <div className="bld-actions">
              <button className="text-button" type="button" disabled={busy || !!recall} onClick={() => {
                setScrambleInput("");
                setScrambleInputError("");
                setPopup("scramble");
              }}>スクランブルを入力</button>
              {exercise && (
                <button className={memorizing ? undefined : "text-button"} type="button"
                  disabled={busy} onClick={advanceRecall}>
                  {hidden ? "スクランブルを再表示" : memorizing ? "暗記完了" : "暗記を計る"}
                </button>
              )}
              {memorizing && <button className="text-button" type="button" onClick={() => setRecall(undefined)}>計測を中止</button>}
            </div>
            {hidden && <p role="status">暗記タイム {formatTime(recall.elapsed, 2)}</p>}
            {error && <p className="error-text" role="alert">{error}</p>}
            {exercise && !hidden && (
              <div className="bld-scramble">
                <div className="bld-heading">
                  <p className="bld-mono" translate="no" role="status">{exercise.scramble}</p>
                  <button type="button" className="icon-button" aria-label="スクランブルをコピー"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(exercise.scramble);
                        setNotice("コピーしました。");
                      } catch {
                        setNotice("コピーできませんでした。");
                      }
                    }}><Copy size={17} aria-hidden="true" /></button>
                </div>
                <button className="text-button" type="button" aria-expanded={showNet}
                  aria-controls="bld-scramble-net" onClick={() => setShowNet(!showNet)}>
                  {showNet ? "展開図を隠す" : "展開図を見る"}
                </button>
                <div id="bld-scramble-net" hidden={!showNet}>
                  {showNet && <Diagram event="333" scramble={exercise.scramble} />}
                </div>
              </div>
            )}
            <p className="muted" role="status">{notice}</p>
          </div>
          <section className="bld-section bld-memo" aria-labelledby="bld-memo-title">
            <div className="bld-heading">
              <h2 id="bld-memo-title">交換文字列</h2>
              <button type="button" className="text-button bld-letters-trigger" disabled={!!recall} onClick={() => setPopup("letters")}>文字の対応図</button>
            </div>
            <form className="bld-section" onSubmit={(event) => { event.preventDefault(); check(); }}>
              <div className="bld-fields">
                {ORBITS.map((orbit) => (
                  <label key={orbit}>{ORBIT_LABELS[orbit]}（{(exercise?.options ?? options)[orbit].buffer}）
                    <input className="bld-mono" type="text" name={`${orbit}-memo`} placeholder="例 AB CD…"
                      value={inputs[orbit]} disabled={!exercise || busy || memorizing}
                      autoCapitalize="characters" autoComplete="off" spellCheck={false}
                      onChange={(event) => { setInputs({ ...inputs, [orbit]: event.target.value }); setFeedback(""); }} />
                  </label>
                ))}
              </div>
              <div className="bld-actions">
                <button type="submit" disabled={!exercise || busy || memorizing}>揃うか検証</button>
                <button type="button" className="text-button" aria-expanded={showAnswer} aria-controls="bld-answer"
                  disabled={!exercise || busy || !!recall} onClick={() => setShowAnswer(!showAnswer)}>
                  {showAnswer ? "答えを隠す" : "答えを見る"}
                </button>
                <button type="button" className="text-button" disabled={!exercise || busy || !!recall}
                  onClick={() => setPopup("review")}>交換を振り返る</button>
              </div>
            </form>
            <p role="status">{feedback}</p>
            <div id="bld-answer" hidden={!showAnswer}>
              {exercise && showAnswer && (
                <dl className="bld-fields bld-answer">
                  {ORBITS.map((orbit) => (
                    <div key={orbit}>
                      <dt>{ORBIT_LABELS[orbit]}（{exercise.steps[orbit].length} 回）</dt>
                      <dd className="bld-mono" translate="no">{groupMemo(exercise.steps[orbit].map(({ letter }) => letter).join(""))}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            {!recall && <section className="bld-inline-letters" aria-labelledby="bld-letters-title">
              <h2 id="bld-letters-title">文字の対応図</h2>
              <BldLetters options={exercise?.options ?? options} />
            </section>}
          </section>
        </div>
      </div>
      {popup === "settings" && (
        <Modal title="スクランブル設定" onClose={closePopup}>
          <BldSettings options={options} conditions={mode === "conditions"} onApply={(next) => {
            setOptions(next);
            setError("");
            closePopup();
          }} />
        </Modal>
      )}
      {popup === "scramble" && (
        <Modal title="スクランブルを入力" onClose={closePopup}>
          <form className="bld-section bld-settings" onSubmit={(event) => { event.preventDefault(); void importScramble(); }}>
            <label>スクランブル
              <textarea className="bld-mono" value={scrambleInput} required rows={3} maxLength={1000}
                name="bld-scramble" autoComplete="off" spellCheck={false} placeholder="例 R U R′ U′…"
                onChange={(event) => setScrambleInput(event.target.value)} />
            </label>
            {scrambleInputError && <p className="error-text" role="alert">{scrambleInputError}</p>}
            <button className="primary" disabled={busy}>読み込む</button>
          </form>
        </Modal>
      )}
      {popup === "review" && exercise && (
        <Modal title="交換の振り返り" onClose={closePopup}>
          <BldReview options={exercise.options} steps={exercise.steps} />
        </Modal>
      )}
      {popup === "letters" && (
        <Modal title="文字の対応図" onClose={closePopup}>
          <BldLetters options={exercise?.options ?? options} />
        </Modal>
      )}
    </main>
  );
}

function BldSettings({ options, conditions, onApply }: {
  options: BldOptions;
  conditions: boolean;
  onApply: (options: BldOptions) => void;
}) {
  const [draft, setDraft] = useState(options);
  const [error, setError] = useState("");
  function update(orbit: Orbit, values: Partial<BldOptions[Orbit]>) {
    setDraft((previous) => ({ ...previous, [orbit]: { ...previous[orbit], ...values } }));
    setError("");
  }
  return (
    <form className="bld-section bld-settings" onSubmit={(event) => {
      event.preventDefault();
      if (conditions && ORBITS.some((orbit) => draft[orbit].min > draft[orbit].max)) {
        setError("スワップ回数の最小値を最大値以下にしてください。");
        return;
      }
      onApply(draft);
    }}>
      {ORBITS.map((orbit) => (
        <fieldset key={orbit} className="bld-orbit">
          <legend>{ORBIT_LABELS[orbit]}</legend>
          <label>バッファ
            <select name={`${orbit}-buffer`} value={draft[orbit].buffer}
              onChange={(event) => update(orbit, { buffer: event.target.value })}>
              {BUFFERS[orbit].map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          {conditions && (
            <>
              <div className="bld-fields">
                {(["min", "max"] as const).map((key) => (
                  <label key={key}>{key === "min" ? "最小スワップ回数" : "最大スワップ回数"}
                    <input type="number" name={`${orbit}-${key}`} autoComplete="off" min={0} max={limits[orbit]}
                      required value={Number.isNaN(draft[orbit][key]) ? "" : draft[orbit][key]}
                      onChange={(event) => update(orbit, { [key]: event.target.valueAsNumber })} />
                  </label>
                ))}
              </div>
              <label>サイクルブレイク
                <select name={`${orbit}-breaks`} value={draft[orbit].breaks}
                  onChange={(event) => update(orbit, { breaks: event.target.value as BldOptions[Orbit]["breaks"] })}>
                  <option value="any">指定なし</option>
                  <option value="none">なし</option>
                  <option value="required">あり</option>
                </select>
              </label>
            </>
          )}
        </fieldset>
      ))}
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="primary">適用</button>
    </form>
  );
}

function BldLetters({ options }: { options: BldOptions }) {
  const [orbit, setOrbit] = useState<Orbit>("EDGES");
  const currentBuffer = bufferLetter(orbit, options[orbit].buffer);
  return (
    <div className="bld-section">
      <div className="segmented" role="group" aria-label="ピースの種類">
        {ORBITS.map((item) => (
          <button key={item} type="button" aria-pressed={orbit === item}
            className={orbit === item ? "selected" : ""} onClick={() => setOrbit(item)}>
            {ORBIT_LABELS[item]}
          </button>
        ))}
      </div>
      <div className="bld-net" translate="no">
        {FACES.map((face, index) => (
          <div key={face} className={`bld-face bld-face-${face}`} role="group" aria-label={`${face} 面`}>
            {stickerOrder[orbit].map((offset, cell) => {
              const letter = offset < 0 ? "" : String.fromCharCode(65 + index * 4 + offset);
              return <span key={cell} style={{ backgroundColor: faceColors[face] }}
                className={letter === currentBuffer ? "bld-buffer" : undefined}>{cell === 4 ? face : letter}</span>;
            })}
          </div>
        ))}
      </div>
      <p className="muted">Speffz（バッファ {currentBuffer}）</p>
    </div>
  );
}
