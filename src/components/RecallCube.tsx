import { useEffect, useRef, useState, type ReactElement } from "react";
import { Alg } from "cubing/alg";
import { TwistyPlayer } from "cubing/twisty";
import { recallFaces, upperNeighbors, upperSlotPair, type RecallFaces, type TopColor } from "../lib/recallFaces";
import { applyRecallCubeColors, type CubeMaterial } from "../lib/recallCubeColors";
type View = "3d" | "top" | "net";
export type RecallMask = "orientation" | "corners" | "last-slot" | "slot-orientation";
export const recallMasks: Partial<Record<string, RecallMask>> = {
  OLL: "orientation",
  COLL: "corners",
  CMLL: "corners",
  F2L: "last-slot",
  VLS: "slot-orientation",
  WV: "slot-orientation",
};
const sideFaces = ["F", "R", "B", "L"] as const;

function topStickerPath(x: number, y: number, row: number, column: number) {
  const right = x + 1;
  const bottom = y + 1;
  const radius = 0.22;
  // Round only the edges that face the center sticker.
  const roundTop = column === 1 && row > 0;
  const roundBottom = column === 1 && row < 2;
  const roundLeft = row === 1 && column > 0;
  const roundRight = row === 1 && column < 2;
  const tl = roundTop || roundLeft ? radius : 0;
  const tr = roundTop || roundRight ? radius : 0;
  const br = roundBottom || roundRight ? radius : 0;
  const bl = roundBottom || roundLeft ? radius : 0;

  return [
    `M ${x + tl} ${y}`,
    `H ${right - tr} Q ${right} ${y} ${right} ${y + tr}`,
    `V ${bottom - br} Q ${right} ${bottom} ${right - br} ${bottom}`,
    `H ${x + bl} Q ${x} ${bottom} ${x} ${bottom - bl}`,
    `V ${y + tl} Q ${x} ${y} ${x + tl} ${y} Z`,
  ].join(" ");
}

export function RecallCube({
  alg,
  auf,
  view,
  top,
  sides,
  rows,
  mask,
  markStickers,
}: {
  alg: string;
  auf: string;
  view: View;
  top: TopColor;
  sides: number;
  rows: 1 | 3;
  mask?: RecallMask;
  markStickers?: (faces: RecallFaces) => string[];
}) {
  const [faces, setFaces] = useState<Awaited<
      ReturnType<typeof recallFaces>
    > | null>(null),
    [error, setError] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view === "3d") return;
    let active = true;
    setFaces(null);
    setError(false);
    recallFaces(alg, top, auf)
      .then((f) => {
        if (active) setFaces(f);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [alg, auf, top, view]);
  useEffect(() => {
    if (view !== "3d" || !host.current) return;
    setError(false);
    let active = true;
    const cloned: CubeMaterial[] = [];
    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      alg: `${new Alg(alg).invert()} ${auf}`,
      visualization: "3D",
      background: "none",
      controlPanel: "none",
      hintFacelets: "floating",
    });
    player.timestamp = "end";
    host.current.replaceChildren(player);
    void (async () => {
      try {
        await applyRecallCubeColors(player, top, () => active, cloned);
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
      player.remove();
      cloned.forEach((m) => m.dispose());
    };
  }, [alg, auf, top, view]);
  if (view === "3d")
    return (
      <div className="recall-player" ref={host}>
        {error && <p role="alert">立体表示を読み込めません。</p>}
      </div>
    );
  if (error)
    return (
      <p role="alert">
        パターンを表示できません。次のケースに切り替えてください。
      </p>
    );
  if (!faces) return <p className="muted">読み込み中…</p>;
  const stickers = faces;
  const slotPair = mask === "slot-orientation" ? upperSlotPair(stickers) : new Set<number>();
  function stickerColor(face: keyof typeof stickers, index: number) {
    const color = stickers[face][index];
    if (color === stickers.U[4]) return color;
    let gray = false;
    switch (mask) {
      case "orientation":
        gray = true;
        break;
      case "slot-orientation":
        gray = !slotPair.has(face === "U" ? index : upperNeighbors[face][index]);
        break;
      case "corners":
        gray = face === "U" ? index % 2 === 1 : index === 1;
        break;
      case "last-slot": {
        const column = index % 3;
        if (face === "U" || index < 3 || column === 1) break;
        const neighbor = sideFaces[(sideFaces.indexOf(face) + (column === 0 ? 3 : 1)) % 4];
        const oppositeColumn = index + (column === 0 ? 2 : -2);
        gray = color === stickers[face][4] && stickers[neighbor][oppositeColumn] === stickers[neighbor][4];
        break;
      }
    }
    return gray ? "#888" : color;
  }
  const sideDepth = 0.46;
  const marked = markStickers?.(faces) ?? [];
  const outlines: ReactElement[] = [];
  function mark(sticker: string, x: number, y: number, width: number, height: number) {
    const number = marked.indexOf(sticker) + 1;
    if (!number) return;
    outlines.push(
      <g key={sticker} data-marked-sticker={sticker}>
        <rect x={x + 0.08} y={y + 0.08} width={width - 0.16} height={height - 0.16} />
        <text
          className="recognition-mark-number"
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          stroke="black"
          strokeWidth=".05"
          paintOrder="stroke"
          fontSize=".26"
        >
          {number}
        </text>
      </g>,
    );
  }

  const cells = faces.U.map((_, i) => {
    const column = i % 3;
    const row = Math.floor(i / 3);
    const x = 3 + column;
    const y = 3 + row;
    mark(`U${i}`, x, y, 1, 1);
    return (
      <path
        key={`U${i}`}
        data-sticker={`U${i}`}
        d={topStickerPath(x, y, row, column)}
        fill={stickerColor("U", i)}
      />
    );
  });
  if (view === "net") {
    const positions: Record<string, (i: number) => [number, number, number, number]> = {
      F: (i) => [3 + (i % 3), 6 + Math.floor(i / 3) * sideDepth, 1, sideDepth],
      R: (i) => [6 + Math.floor(i / 3) * sideDepth, 5 - (i % 3), sideDepth, 1],
      B: (i) => [5 - (i % 3), 3 - (Math.floor(i / 3) + 1) * sideDepth, 1, sideDepth],
      L: (i) => [3 - (Math.floor(i / 3) + 1) * sideDepth, 3 + (i % 3), sideDepth, 1],
    };
    for (const side of (["F", "R", "L", "B"] as const).slice(0, sides))
      faces[side].slice(0, rows * 3).forEach((_, i) => {
        const [x, y, width, height] = positions[side](i);
        const sticker = `${side}${i}`;
        mark(sticker, x, y, width, height);
        cells.push(
          <rect
            key={sticker}
            data-sticker={sticker}
            x={x}
            y={y}
            width={width}
            height={height}
            fill={stickerColor(side, i)}
          />,
        );
      });
  }
  const margin = view === "net" ? rows * sideDepth + 0.12 : 0.12;

  return (
    <svg
      viewBox={`${3 - margin} ${3 - margin} ${3 + margin * 2} ${3 + margin * 2}`}
      className="recall-flat"
      role="img"
      aria-label={view === "top" ? "上面のパターン" : "上面と側面のパターン"}
    >
      <rect x="3" y="3" width="3" height="3" fill="#000" />
      <g stroke="#000" strokeWidth=".065">
        {cells}
      </g>
      {outlines.length > 0 && (
        <g aria-hidden="true" fill="none" stroke="white" strokeWidth=".075">{outlines}</g>
      )}
    </svg>
  );
}
