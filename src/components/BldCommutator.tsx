import { useState } from "react";
import { Alg } from "cubing/alg";
import { BldCubeNet } from "./BldCubeNet";
import { BldHighlightCube } from "./BldHighlightCube";
import { generateCommutator, ORBITS, ORBIT_LABELS, speffzSticker, type Orbit } from "../lib/bld";

export function BldCommutator() {
  const [orbit, setOrbit] = useState<Orbit>("CORNERS");
  const [letters, setLetters] = useState<string[]>([]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof generateCommutator>>>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  function clear() {
    setLetters([]);
    setResult(undefined);
    setStatus("");
  }

  return (
    <div className="bld-section">
      <div className="segmented" role="group" aria-label="ピースの種類">
        {ORBITS.map((item) => <button key={item} type="button" aria-pressed={orbit === item}
          className={item === orbit ? "selected" : ""} disabled={busy}
          onClick={() => { setOrbit(item); clear(); }}>{ORBIT_LABELS[item]}</button>)}
      </div>
      <p>{letters.length ? letters.join(" → ") + (letters.length === 3 ? ` → ${letters[0]}` : "") : "交換するステッカーを順番に3つ選びます。"}</p>
      <BldCubeNet orbit={orbit} selection={letters}
        disabled={(letter) => busy || (!letters.includes(letter) && (letters.length === 3 ||
          letters.some((selected) => speffzSticker(orbit, selected).piece === speffzSticker(orbit, letter).piece)))}
        onSelect={(letter) => {
          setLetters(letters.includes(letter) ? letters.filter((item) => item !== letter) : [...letters, letter]);
          setResult(undefined);
          setStatus("");
        }} />
      <div className="bld-actions">
        <button type="button" className="primary" disabled={letters.length !== 3 || busy}
          onClick={async () => {
            setBusy(true);
            setStatus("");
            try {
              setResult(await generateCommutator(orbit, letters));
            } catch (error) {
              setStatus(error instanceof Error ? error.message : "手順を生成できませんでした。");
            } finally {
              setBusy(false);
            }
          }}>{busy ? "生成中…" : "コミュテーターを生成"}</button>
        <button type="button" disabled={busy || !letters.length} onClick={clear}>選択を解除</button>
      </div>
      {result && (
        <div className="bld-section">
          <dl className="bld-guide-steps">
            <div><dt>セットアップ</dt><dd><code>{result.setup || "なし"}</code></dd></div>
            <div><dt>基本手順</dt><dd><code>{result.base}</code></dd></div>
            <div><dt>通し手順</dt><dd><code>{result.alg}</code></dd></div>
          </dl>
          <button type="button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(new Alg(result.alg).expand().toString());
              setStatus("手順をコピーしました。");
            } catch {
              setStatus("手順をコピーできませんでした。");
            }
          }}>手順をコピー</button>
          <BldHighlightCube highlights={letters.map((letter) => ({ orbit, letter }))} />
        </div>
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
