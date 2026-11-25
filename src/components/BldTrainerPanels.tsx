import { useState } from "react";
import {
  BUFFERS, ORBITS, ORBIT_LABELS, bufferLetter, memoPreview, normalizeMemo, traceMemoSteps,
  type BldOptions, type MemoStep, type Orbit, type PreviewMethod, type generateBld,
} from "../lib/bld";
import { BldCubeNet, BldCubeViewToggle, type CubeView } from "./BldCubeNet";
import type { SetupTarget } from "./BldGuide";
import { BldSwapPreview } from "./BldSwapPreview";

const limits = { EDGES: 16, CORNERS: 10 };
export type BldExercise = Awaited<ReturnType<typeof generateBld>> & { steps: Record<Orbit, MemoStep[]> };
type PreviewSource = "answer" | "input";

export function BldPreviewContent({ exercise, inputs }: { exercise: BldExercise; inputs: Record<Orbit, string> }) {
  const [method, setMethod] = useState<PreviewMethod>("3-style");
  const [source, setSource] = useState<PreviewSource>("answer");
  const [view, setView] = useState<CubeView>("3d");
  const buffers = method === "3-style"
    ? { EDGES: exercise.options.EDGES.buffer, CORNERS: exercise.options.CORNERS.buffer }
    : { EDGES: method === "m2-op" ? "DF" : "UR", CORNERS: "UBL" };
  const mismatchedInput = source === "input" && ORBITS.some((orbit) => buffers[orbit] !== exercise.options[orbit].buffer);

  function sequence(orbit: Orbit) {
    if (source === "input") return [...normalizeMemo(inputs[orbit])];
    if (buffers[orbit] === exercise.options[orbit].buffer) return exercise.steps[orbit].map(({ letter }) => letter);
    return traceMemoSteps(exercise.pattern, orbit, buffers[orbit]).map(({ letter }) => letter);
  }

  let preview;
  let error = "";
  if (mismatchedInput) {
    error = `この解法で入力した文字列を再生するには、スクランブル設定でエッジを ${buffers.EDGES}、コーナーを ${buffers.CORNERS} に設定してから練習してください。`;
  } else {
    try {
      preview = memoPreview(exercise.pattern, exercise.options, { EDGES: sequence("EDGES"), CORNERS: sequence("CORNERS") }, method);
    } catch (failure) {
      error = failure instanceof Error ? failure.message : "交換文字列を読み込めませんでした。";
    }
  }

  return <div className="bld-section">
    <div className="bld-fields bld-preview-options">
      <label>解法
        <select value={method} onChange={(event) => setMethod(event.target.value as PreviewMethod)}>
          <option value="3-style">3-style</option>
          <option value="m2-op">M2（エッジ）・Old Pochmann（コーナー）</option>
          <option value="op">Old Pochmann</option>
        </select>
      </label>
      <label>交換文字列
        <select value={source} onChange={(event) => setSource(event.target.value as PreviewSource)}>
          <option value="answer">生成した答え</option>
          <option value="input">入力した文字列</option>
        </select>
      </label>
    </div>
    {error && <p role="alert">{error}</p>}
    {preview && <>
      <p className="muted bld-preview-buffers">バッファ　エッジ {buffers.EDGES}、コーナー {buffers.CORNERS}</p>
      <BldSwapPreview key={`${method}:${source}`} {...preview} options={exercise.options} view={view} onView={setView} />
    </>}
  </div>;
}

export function BldSettings({ options, conditions, onApply }: {
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

export function BldLetters({ options, onSelect }: { options: BldOptions; onSelect: (target: SetupTarget) => void }) {
  const [orbit, setOrbit] = useState<Orbit>("EDGES");
  const [view, setView] = useState<CubeView>("net");
  const currentBuffer = bufferLetter(orbit, options[orbit].buffer);
  return (
    <div className="bld-section">
      <div className="bld-reference-toolbar">
        <div className="segmented" role="group" aria-label="ピースの種類">
          {ORBITS.map((item) => (
            <button key={item} type="button" aria-pressed={orbit === item}
              className={orbit === item ? "selected" : ""} onClick={() => setOrbit(item)}>
              {ORBIT_LABELS[item]}
            </button>
          ))}
        </div>
        <BldCubeViewToggle view={view} onChange={setView} views={["net", "3d"]} />
      </div>
      <BldCubeNet view={view} orbit={orbit} buffer={currentBuffer}
        onSelect={(letter) => onSelect({ orbit, letter, edgeBuffer: options.EDGES.buffer })} />
      <p className="muted">Speffz（バッファ {currentBuffer}）</p>
    </div>
  );
}
