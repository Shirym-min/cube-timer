import { useEffect, useRef, useState } from "react";
import { BldCubeNet } from "./BldCubeNet";
import { ORBITS, ORBIT_LABELS, type MemoFrame, type Orbit } from "../lib/bld";

export function BldSwapPreview({ frames, moves, source, onSource }: {
  frames: MemoFrame[];
  moves: { orbit: Orbit; letter: string }[];
  source: "answer" | "input";
  onSource: (source: "answer" | "input") => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const [index, setIndex] = useState(0);
  const [moving, setMoving] = useState(false);
  useEffect(() => () => animations.current.forEach((animation) => animation.cancel()), []);

  async function step(delta: -1 | 1) {
    const next = index + delta;
    const net = host.current;
    if (moving || !frames[next] || !net) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIndex(next);
      return;
    }
    setMoving(true);
    const root = net.getBoundingClientRect();
    const { transfers } = frames[Math.max(index, next)];
    const ghosts: HTMLElement[] = [];
    const hidden: HTMLElement[] = [];
    const easing = getComputedStyle(net).getPropertyValue("--ease-settle").trim();
    animations.current = transfers.flatMap(({ from, to }) => {
      const start = net.querySelector<HTMLElement>(`[data-sticker="${from}"]`);
      const end = net.querySelector<HTMLElement>(`[data-sticker="${to}"]`);
      if (!start || !end) return [];
      const a = start.getBoundingClientRect(), b = end.getBoundingClientRect();
      const ghost = document.createElement("span");
      ghost.className = "bld-swap-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.textContent = start.textContent;
      Object.assign(ghost.style, {
        left: `${a.left - root.left}px`, top: `${a.top - root.top}px`,
        width: `${a.width}px`, height: `${a.height}px`,
        background: getComputedStyle(start).backgroundColor,
      });
      ghosts.push(ghost);
      hidden.push(start);
      net.append(ghost);
      return [ghost.animate([
        { transform: "translate(0, 0) scale(1)" },
        { transform: `translate(${(b.left - a.left) / 2}px, ${(b.top - a.top) / 2 - 12}px) scale(1.1)`, offset: 0.5 },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(1)` },
      ], { duration: 360, easing })];
    });
    hidden.forEach((sticker) => { sticker.style.visibility = "hidden"; });
    await Promise.allSettled(animations.current.map((animation) => animation.finished));
    ghosts.forEach((ghost) => ghost.remove());
    hidden.forEach((sticker) => { sticker.style.visibility = ""; });
    if (host.current !== net) return;
    animations.current = [];
    setIndex(next);
    setMoving(false);
  }

  const move = moves[index - 1];
  const next = moves[index];
  return (
    <div className="bld-section bld-swap-preview">
      <label>交換文字列
        <select value={source} disabled={moving}
          onChange={(event) => onSource(event.target.value === "input" ? "input" : "answer")}>
          <option value="answer">生成した答え</option>
          <option value="input">入力した文字列</option>
        </select>
      </label>
      <div className="bld-swap-net" ref={host}>
        <BldCubeNet frame={frames[index]} orbit={next?.orbit ?? move?.orbit ?? ORBITS[0]} />
      </div>
      <div className="bld-review-controls">
        <button type="button" disabled={moving || index === 0} onClick={() => void step(-1)}>前へ</button>
        <p role="status">{index} / {moves.length}{move && <small>{ORBIT_LABELS[move.orbit]}の {move.letter} を交換</small>}</p>
        <button type="button" disabled={moving || !next} onClick={() => void step(1)}>次の交換</button>
      </div>
      {next && <p className="muted">次の交換先は {ORBIT_LABELS[next.orbit]}の {next.letter} です。</p>}
    </div>
  );
}
