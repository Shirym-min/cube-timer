import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BldHighlightCube } from "./BldHighlightCube";
import { ORBITS, ORBIT_LABELS, bufferLetter, type BldOptions, type MemoStep, type Orbit } from "../lib/bld";

export function BldReview({ options, steps }: {
  options: BldOptions;
  steps: Record<Orbit, MemoStep[]>;
}) {
  const [orbit, setOrbit] = useState<Orbit>(steps.EDGES.length ? "EDGES" : "CORNERS");
  const [index, setIndex] = useState(0);
  const sequence = steps[orbit];
  const current = sequence[index];
  const buffer = bufferLetter(orbit, options[orbit].buffer);
  const letter = current?.letter;
  const highlights = useMemo(() =>
    letter ? [{ orbit, letter: buffer }, { orbit, letter }] : [], [orbit, buffer, letter]);

  return (
    <div className="bld-section">
      <div className="segmented" role="group" aria-label="振り返るピース">
        {ORBITS.map((item) => (
          <button key={item} type="button" aria-pressed={orbit === item}
            className={orbit === item ? "selected" : ""}
            onClick={() => { setOrbit(item); setIndex(0); }}>
            {ORBIT_LABELS[item]}
          </button>
        ))}
      </div>
      {current ? (
        <>
          <div className="bld-review-controls">
            <button type="button" aria-label="前の交換" disabled={index === 0}
              onClick={() => setIndex(index - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
            <p role="status">
              {index + 1} / {sequence.length} · {current.letter}
              {current.kind === "cycle-break" && <small>サイクルブレイク</small>}
              {current.kind === "orientation" && <small>{orbit === "EDGES" ? "反転の処理" : "ねじれの処理"}</small>}
            </p>
            <button type="button" aria-label="次の交換" disabled={index + 1 === sequence.length}
              onClick={() => setIndex(index + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
          <BldHighlightCube highlights={highlights} />
        </>
      ) : <p>{ORBIT_LABELS[orbit]}の交換はありません。</p>}
    </div>
  );
}
