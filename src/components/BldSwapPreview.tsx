import { useCallback, useEffect, useRef, useState } from "react";
import { BldCubeNet, BldCubeViewToggle, type CubeView } from "./BldCubeNet";
import { BldPlaybackCube } from "./BldPlaybackCube";
import { previewCommutatorTargets, previewStepAlgorithm, type BldOptions, type PreviewFrame, type PreviewStep } from "../lib/bld";

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
  const worker = useRef<Worker>(null);
  const request = useRef(0);
  const pending = useRef<{ id: number; finishEmpty: () => void }>(null);
  const next = steps[index];
  const busy = loading || Boolean(algorithm);

  useEffect(() => () => {
    pending.current = null;
    worker.current?.terminate();
    worker.current = null;
  }, []);

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
    if (!next || busy) return;
    onView("3d");
    setError("");
    if (next.algorithm) {
      setAlgorithm(next.algorithm);
      return;
    }

    const moves = next.moves ?? [];
    const targets = previewCommutatorTargets(options, moves);
    setLoading(true);
    const id = ++request.current;
    pending.current = { id, finishEmpty: advance };

    if (!targets) {
      // The cubing.js solver launches its own worker for parity and orientation.
      void previewStepAlgorithm(options, moves).then(
        (execution) => receive(id, execution),
        (failure: unknown) => receive(id, undefined, failure instanceof Error ? failure.message : "交換手順を生成できませんでした。"),
      );
      return;
    }
    try {
      if (!worker.current) {
        const instance = new Worker(new URL("../lib/bldCommutator.worker.ts", import.meta.url), { type: "module" });
        instance.onmessage = ({ data }) => receive(data.id, data.result?.execution, data.error);
        instance.onerror = () => {
          instance.terminate();
          worker.current = null;
          const current = pending.current;
          if (current) receive(current.id, undefined, "交換手順を読み込めませんでした。");
        };
        worker.current = instance;
      }
      worker.current.postMessage({ id, ...targets });
    } catch {
      receive(id, undefined, "交換手順を読み込めませんでした。");
    }
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

  const previous = steps[index - 1];
  const upcoming = next ?? previous;
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
          {(algorithm || upcoming.algorithm) && <code translate="no">{algorithm || upcoming.algorithm}</code>}
        </div>}
        <button type="button" className="primary" disabled={busy || !next} onClick={play}>
          {loading ? "手順を生成中…" : algorithm ? "再生中…" : "この交換を再生"}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
      {view === "3d" ? (
        <BldPlaybackCube pattern={frames[index].pattern} algorithm={algorithm} top="white"
          label="交換手順の3D再生" onFinish={advance} />
      ) : <BldCubeNet frame={frames[index]} orbit={upcoming?.orbit} />}
    </div>
  );
}
