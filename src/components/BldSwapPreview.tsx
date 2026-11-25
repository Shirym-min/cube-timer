import { useCallback, useEffect, useRef, useState } from "react";
import { BldCubeNet, BldCubeViewToggle, type CubeView } from "./BldCubeNet";
import { BldPlaybackCube } from "./BldPlaybackCube";
import { previewCommutatorTargets, previewStepAlgorithm, type BldOptions, type generateCommutator, type PreviewFrame, type PreviewStep } from "../lib/bld";

type CommutatorResult = Awaited<ReturnType<typeof generateCommutator>>;

export function BldSwapPreview({ frames, steps, options, view, onView }: {
  frames: PreviewFrame[];
  steps: PreviewStep[];
  options: BldOptions;
  view: CubeView;
  onView: (view: CubeView) => void;
}) {
  const [index, setIndex] = useState(0);
  const [algorithm, setAlgorithm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState<{ key: string; result?: CommutatorResult; error?: string }>();
  const worker = useRef<Worker>(null);
  const request = useRef(0);
  const pending = useRef<{ id: number; finishEmpty: () => void }>(null);
  const next = steps[index];
  const previous = steps[index - 1];
  const upcoming = next ?? previous;
  const targets = upcoming?.moves && previewCommutatorTargets(options, upcoming.moves);
  const orbit = targets?.orbit;
  const letters = targets?.letters.join("");
  const key = orbit && letters ? `${orbit}:${letters}` : undefined;
  const commutator = prepared?.key === key ? prepared : undefined;
  const preparing = Boolean(key && !commutator);
  const busy = loading || Boolean(algorithm);

  useEffect(() => () => {
    pending.current = null;
    worker.current?.terminate();
    worker.current = null;
  }, []);

  useEffect(() => {
    if (!key || !orbit || !letters) return;
    const id = ++request.current;
    try {
      const instance = worker.current ?? new Worker(
        new URL("../lib/bldCommutator.worker.ts", import.meta.url), { type: "module" },
      );
      worker.current = instance;
      instance.onmessage = ({ data }) => {
        if (data.id === id) setPrepared({ key, result: data.result, error: data.error });
      };
      instance.onerror = () => {
        instance.terminate();
        worker.current = null;
        setPrepared({ key, error: "コミュテーターを読み込めませんでした。" });
      };
      instance.postMessage({ id, orbit, letters: [...letters] });
      return () => {
        instance.onmessage = null;
        instance.onerror = null;
      };
    } catch {
      setPrepared({ key, error: "コミュテーターを読み込めませんでした。" });
    }
  }, [key, orbit, letters]);

  const advance = useCallback(() => {
    pending.current = null;
    setAlgorithm("");
    setLoading(false);
    setError("");
    setIndex((current) => current === index ? current + 1 : current);
  }, [index]);

  function rewind() {
    setError("");
    setIndex((current) => current - 1);
  }

  function play() {
    if (!next || busy || preparing) return;
    onView("3d");
    setError("");
    const execution = commutator?.result?.execution ?? next.algorithm;
    if (execution) {
      setAlgorithm(execution);
      return;
    }
    if (key) return;

    setLoading(true);
    const id = ++request.current;
    pending.current = { id, finishEmpty: advance };
    // The cubing.js solver launches its own worker for parity and orientation.
    void previewStepAlgorithm(options, next.moves ?? []).then(
      (execution) => receive(id, execution),
      (failure: unknown) => receive(id, undefined, failure instanceof Error ? failure.message : "交換手順を生成できませんでした。"),
    );
  }

  function receive(id: number, execution?: string, error?: string) {
    const current = pending.current;
    if (!current || current.id !== id) return;
    pending.current = null;
    setLoading(false);
    if (error) setError(error);
    else if (execution) setAlgorithm(execution);
    else current.finishEmpty();
  }

  const execution = algorithm || commutator?.result?.execution || upcoming?.algorithm;
  return (
    <div className="bld-section bld-swap-preview">
      <div className="bld-section bld-swap-controls">
        <BldCubeViewToggle view={view} onChange={onView} views={["net", "3d"]} disabled={busy} />
        <div className="bld-review-controls">
          <button type="button" disabled={busy || index === 0} onClick={rewind}>前の交換</button>
          <p role="status">{index} / {steps.length}{previous && <small>{previous.label}</small>}</p>
          <button type="button" disabled={!next} onClick={advance}>スキップ</button>
        </div>
        {upcoming && <div className="bld-next-step">
          <p>{next ? "次の交換" : "最後の交換"} · {upcoming.label}</p>
          {commutator?.result && <dl className="bld-guide-steps">
            <div><dt>コミュテーター表記{commutator.result.setup && "（共役付き）"}</dt><dd><code translate="no">{commutator.result.alg}</code></dd></div>
            <div><dt>実行手順</dt><dd><code translate="no">{execution}</code></dd></div>
          </dl>}
          {!commutator?.result && execution && <code translate="no">{execution}</code>}
        </div>}
        <button type="button" className="primary" disabled={busy || !next || preparing || Boolean(commutator?.error)} onClick={play}>
          {loading || preparing ? "手順を生成中…" : algorithm ? "再生中…" : "この交換を再生"}
        </button>
        {(error || commutator?.error) && <p role="alert">{error || commutator?.error}</p>}
      </div>
      {view === "3d" ? (
        <BldPlaybackCube pattern={frames[index].pattern} algorithm={algorithm} top="white"
          label="交換手順の3D再生" onFinish={advance} />
      ) : <BldCubeNet frame={frames[index]} orbit={upcoming?.orbit} />}
    </div>
  );
}
