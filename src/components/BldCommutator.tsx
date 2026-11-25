import { useEffect, useRef, useState } from "react";
import { BldCubeNet, BldCubeViewToggle, type CubeView } from "./BldCubeNet";
import { BldPlaybackCube } from "./BldPlaybackCube";
import { ORBITS, ORBIT_LABELS, speffzSticker, type generateCommutator, type Orbit } from "../lib/bld";

export function BldCommutator() {
  const [orbit, setOrbit] = useState<Orbit>("CORNERS");
  const [view, setView] = useState<CubeView>("net");
  const [letters, setLetters] = useState<string[]>([]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof generateCommutator>>>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const workerRef = useRef<Worker | null>(null);
  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  function generate() {
    setBusy(true);
    setResult(undefined);
    setStatus("");
    try {
      if (!workerRef.current) {
        const worker = new Worker(new URL("../lib/bldCommutator.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = ({ data }) => {
          setBusy(false);
          if (data.error) setStatus(data.error);
          else setResult(data.result);
        };
        worker.onerror = () => {
          worker.terminate();
          workerRef.current = null;
          setBusy(false);
          setStatus("手順を生成できませんでした。再試行してください。");
        };
        workerRef.current = worker;
      }
      workerRef.current.postMessage({ orbit, letters });
    } catch {
      setBusy(false);
      setStatus("手順を生成できませんでした。");
    }
  }

  function clear() {
    setLetters([]);
    setResult(undefined);
    setStatus("");
  }

  return (
    <div className="bld-section">
      <div className="bld-reference-toolbar">
        <div className="segmented" role="group" aria-label="ピースの種類">
          {ORBITS.map((item) => <button key={item} type="button" aria-pressed={orbit === item}
            className={item === orbit ? "selected" : ""} disabled={busy}
            onClick={() => { setOrbit(item); clear(); }}>{ORBIT_LABELS[item]}</button>)}
        </div>
        <BldCubeViewToggle view={view} onChange={setView} views={["net", "3d"]} />
      </div>
      <p>{letters.length ? letters.join(" → ") + (letters.length === 3 ? ` → ${letters[0]}` : "") : "交換するステッカーを順番に3つ選びます。"}</p>
      <BldCubeNet view={view} orbit={orbit} selection={letters}
        disabled={(letter) => busy || (!letters.includes(letter) && (letters.length === 3 ||
          letters.some((selected) => speffzSticker(orbit, selected).piece === speffzSticker(orbit, letter).piece)))}
        onSelect={(letter) => {
          setLetters(letters.includes(letter) ? letters.filter((item) => item !== letter) : [...letters, letter]);
          setResult(undefined);
          setStatus("");
        }} />
      <div className="bld-actions">
        <button type="button" className="primary" disabled={letters.length !== 3 || busy}
          onClick={generate}>{busy ? "生成中…" : "コミュテーターを生成"}</button>
        <button type="button" disabled={busy || !letters.length} onClick={clear}>選択を解除</button>
      </div>
      {result && (
        <div className="bld-section">
          <dl className="bld-guide-steps">
            <div><dt>セットアップ</dt><dd><code>{result.setup || "なし"}</code></dd></div>
            <div><dt>コミュテーター</dt><dd><code>{result.base}</code></dd></div>
            <div><dt>実行手順（{result.moveCount}手）</dt><dd><code>{result.execution}</code></dd></div>
          </dl>
          <button type="button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(result.execution);
              setStatus("手順をコピーしました。");
            } catch {
              setStatus("手順をコピーできませんでした。");
            }
          }}>手順をコピー</button>
          <BldPlaybackCube algorithm={result.execution} top="yellow" label="コミュテーターの3D再生" />
        </div>
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
