import { useLayoutEffect, useRef, useState } from "react";
import { BldCubeNet, BldCubeViewToggle, type CubeView } from "./BldCubeNet";
import type { MemoFrame, PreviewStep } from "../lib/bld";

type StickerMove = { start: HTMLElement; end: HTMLElement };
type SwapAnimation = { animations: Animation[]; clear: () => void };

function animateNet(host: HTMLElement, moves: StickerMove[], easing: string): SwapAnimation {
  const root = host.getBoundingClientRect();
  const ghosts = moves.map(({ start, end }) => {
    const a = start.getBoundingClientRect();
    const b = end.getBoundingClientRect();
    const ghost = document.createElement("span");
    ghost.className = "bld-swap-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.textContent = start.textContent;
    Object.assign(ghost.style, {
      left: `${a.left - root.left}px`, top: `${a.top - root.top}px`,
      width: `${a.width}px`, height: `${a.height}px`,
      background: getComputedStyle(start).backgroundColor,
    });
    host.append(ghost);
    return { ghost, dx: b.left - a.left, dy: b.top - a.top };
  });
  const animations = ghosts.map(({ ghost, dx, dy }) => ghost.animate([
    { transform: "translate(0, 0) scale(1)" },
    { transform: `translate(${dx / 2}px, ${dy / 2 - 12}px) scale(1.1)`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(1)` },
  ], { duration: 360, easing, fill: "forwards" }));
  moves.forEach(({ start }) => { start.style.visibility = "hidden"; });
  return {
    animations,
    clear: () => {
      ghosts.forEach(({ ghost }) => ghost.remove());
      moves.forEach(({ start }) => { start.style.visibility = ""; });
    },
  };
}

function animateCube(moves: StickerMove[], easing: string): SwapAnimation {
  // Keep the color layers on each face so they follow the cube as it rotates.
  const tiles = moves.map(({ start, end }) => ({
    end,
    color: getComputedStyle(start).backgroundColor,
  }));
  const layers: HTMLElement[] = [];
  const animations = tiles.flatMap(({ end, color }) => {
    const fill = document.createElement("span");
    const outline = document.createElement("span");
    fill.className = "bld-swap-fill";
    fill.style.backgroundColor = color;
    outline.className = "bld-swap-outline";

    for (const layer of [fill, outline]) {
      layer.setAttribute("aria-hidden", "true");
      end.append(layer);
      layers.push(layer);
    }
    return [
      fill.animate([
        { opacity: 0 }, { opacity: 0, offset: 0.25 }, { opacity: 1, offset: 0.82 }, { opacity: 1 },
      ], { duration: 360, easing, fill: "both" }),
      outline.animate([
        { opacity: 0 }, { opacity: 1, offset: 0.22 }, { opacity: 1, offset: 0.75 }, { opacity: 0 },
      ], { duration: 360, easing, fill: "both" }),
    ];
  });
  return { animations, clear: () => layers.forEach((layer) => layer.remove()) };
}

export function BldSwapPreview({ frames, steps, view, onView }: {
  frames: MemoFrame[];
  steps: PreviewStep[];
  view: CubeView;
  onView: (view: CubeView) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const active = useRef<SwapAnimation>(null);
  const [index, setIndex] = useState(0);
  const [moving, setMoving] = useState(false);

  function clearAnimation() {
    const animation = active.current;
    active.current = null;
    animation?.animations.forEach((item) => item.cancel());
    animation?.clear();
  }

  useLayoutEffect(() => clearAnimation, []);
  useLayoutEffect(() => {
    if (!moving) clearAnimation();
  }, [moving]);

  async function step(delta: -1 | 1) {
    const next = index + delta;
    const net = host.current;
    if (active.current || !frames[next] || !net) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIndex(next);
      return;
    }
    const tiles = new Map(
      [...net.querySelectorAll<HTMLElement>("[data-sticker]")].map((tile) => [tile.dataset.sticker, tile]),
    );
    const moves = frames[Math.max(index, next)].transfers.flatMap(({ from, to }) => {
      const start = tiles.get(delta === 1 ? from : to);
      const end = tiles.get(delta === 1 ? to : from);
      return start && end ? [{ start, end }] : [];
    });
    if (!moves.length) {
      setIndex(next);
      return;
    }

    const easing = getComputedStyle(net).getPropertyValue("--ease-settle").trim();
    const animation = view === "3d" ? animateCube(moves, easing) : animateNet(net, moves, easing);
    active.current = animation;
    setMoving(true);
    await Promise.allSettled(animation.animations.map((item) => item.finished));
    if (active.current !== animation) return;

    setIndex(next);
    setMoving(false);
  }

  const previous = steps[index - 1];
  const next = steps[index];
  const upcoming = next ?? previous;
  return (
    <div className="bld-section bld-swap-preview">
      <div className="bld-swap-net" ref={host}>
        <BldCubeNet view={view} frame={frames[index]} orbit={upcoming?.orbit} />
      </div>
      <div className="bld-section bld-swap-controls">
        <BldCubeViewToggle view={view} onChange={onView}
          views={["net", "3d"]} disabled={moving} />
        <div className="bld-review-controls">
          <button type="button" disabled={moving || index === 0} onClick={() => void step(-1)}>前へ</button>
          <p role="status">{index} / {steps.length}{previous && <small>{previous.label}</small>}</p>
          <button type="button" disabled={moving || !next} onClick={() => void step(1)}>次の交換</button>
        </div>
        {upcoming && <div className="bld-next-step">
          <p>{next ? "次の手順" : "最後の手順"} · {upcoming.label}</p>
          {upcoming.algorithm && <code translate="no">{upcoming.algorithm}</code>}
        </div>}
      </div>
    </div>
  );
}
