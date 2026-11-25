import { memo, useEffect, useState } from "react";
import { Alg } from "cubing/alg";
import { Check, Copy } from "lucide-react";
import type library from "../data/algorithm-library.json";
import { harrisBaumStickers, type HarrisBaumCode } from "../lib/zbllRecognition";
import { RecallCube, type RecallMask } from "./RecallCube";

export type AlgorithmSet = keyof typeof library;
type Variant = { alg: string; setup: string; moves: number; generated?: boolean };
export type AlgorithmCase = { name: string; group: string; variants: Variant[] };

export const CasePattern = memo(function CasePattern({
  setup, set, mask, showHarrisBaum,
}: { setup: string; set: AlgorithmSet; mask?: RecallMask; showHarrisBaum: boolean }) {
  return (
    <RecallCube
      alg={new Alg(setup).invert().toString()}
      auf=""
      view="net"
      top="yellow"
      sides={4}
      rows={set === "F2L" ? 3 : 1}
      mask={mask}
      markStickers={showHarrisBaum ? harrisBaumStickers : undefined}
    />
  );
});

export function AlgorithmDetail({
  entry, set, mask, codesBySetup, shortFirst, setShortFirst,
}: {
  entry: AlgorithmCase;
  set: AlgorithmSet;
  mask?: RecallMask;
  codesBySetup?: ReadonlyMap<string, HarrisBaumCode | null>;
  shortFirst: boolean;
  setShortFirst: (value: boolean) => void;
}) {
  const [selection, setSelection] = useState("");
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const variants = shortFirst
    ? [...entry.variants].sort((a, b) => a.moves - b.moves)
    : entry.variants;
  const primary = entry.variants[0];
  const active = variants.find(({ alg }) => alg === selection) ?? (codesBySetup ? primary : variants[0]);
  const recognitionCode = codesBySetup?.get(active.setup);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(""), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setCopyError(false);
    } catch {
      setCopied("");
      setCopyError(true);
    }
  }

  return (
    <>
      <div className="algorithm-pattern">
        <div className="algorithm-illustration">
          <CasePattern setup={active.setup} set={set} mask={mask} showHarrisBaum={!!codesBySetup} />
        </div>
        <div className="algorithm-setup">
          <div className="algorithm-block-heading">
            <h3>セットアップ</h3>
            <button type="button" className="icon-button" aria-label="セットアップをコピー" title="セットアップをコピー" onClick={() => void copy(active.setup, "セットアップ")}>
              {copied === "セットアップ" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
          </div>
          <code>{active.setup}</code>
          <small>黄色を上、青を手前に</small>
          {recognitionCode && <small>Harris/Baum <strong>{recognitionCode}</strong></small>}
          {recognitionCode === null && <small>このセットアップはHarris/Baum判別の対象外です。</small>}
        </div>
      </div>

      <div className="algorithm-variants">
        <div className="algorithm-block-heading">
          <h3>手順 <small>{variants.length}件</small></h3>
          <div className="algorithm-variant-actions">
            <select aria-label="手順の並び順" value={shortFirst ? "short" : "source"} onChange={(event) => setShortFirst(event.target.value === "short")}>
              <option value="source">収録順</option>
              <option value="short">手数の少ない順</option>
            </select>
            <button type="button" className="icon-button" aria-label="選択した手順をコピー" title="選択した手順をコピー" onClick={() => void copy(active.alg, "手順")}>
              {copied === "手順" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div role="status" className={copyError ? "muted" : "sr-only"}>
          {copyError ? "コピーできませんでした。" : copied && `${copied}をコピーしました。`}
        </div>
        <ul className="algorithm-variant-list">
          {variants.map((variant) => (
            <li key={variant.alg}>
              <button
                type="button"
                aria-pressed={active.alg === variant.alg}
                onClick={() => setSelection(variant.alg)}
              >
                <code>{variant.alg}</code>
                <small>{variant.generated && <span>自動生成</span>}{variant.moves}手</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
