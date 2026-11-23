import { useEffect, useRef, useState } from "react";
import { Alg } from "cubing/alg";
import { puzzles } from "cubing/puzzles";
import { TwistyPlayer } from "cubing/twisty";
import { recallFaces, topColors, type TopColor } from "../lib/recallFaces";
type View = "3d" | "top" | "net";
type Material = {
  clone: () => Material;
  color: { set: (value: number) => void };
  dispose: () => void;
};
type CubeObject = {
  kpuzzleFaceletInfo: Record<
    string,
    {
      faceIdx: number;
      facelet: { material: Material };
      hintFacelet?: { material: Material };
    }[][]
  >;
  scheduleRenderCallback: () => void;
};
export function RecallCube({
  alg,
  auf,
  view,
  top,
  sides,
  rows,
}: {
  alg: string;
  auf: string;
  view: View;
  top: TopColor;
  sides: number;
  rows: 1 | 3;
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
    const cloned: Material[] = [];
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
        const cube = await puzzles["3x3x3"].kpuzzle();
        const rotation = topColors.find((c) => c[0] === top)![2];
        const centers = cube.defaultPattern().applyAlg(rotation).patternData
          .CENTERS.pieces;
        const palette = [
          0xffffff, 0xff9900, 0x00ff00, 0xff0000, 0x2266ff, 0xffff00,
        ];
        const object =
          (await player.experimentalCurrentThreeJSPuzzleObject()) as unknown as CubeObject;
        if (!active) return;
        for (const pieces of Object.values(object.kpuzzleFaceletInfo))
          for (const piece of pieces)
            for (const sticker of piece)
              for (const mesh of [sticker.facelet, sticker.hintFacelet])
                if (mesh) {
                  const material = mesh.material.clone();
                  material.color.set(palette[centers[sticker.faceIdx]]);
                  mesh.material = material;
                  cloned.push(material);
                }
        object.scheduleRenderCallback();
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
  const rect = (x: number, y: number, color: string, key: string) => (
    <rect
      key={key}
      data-sticker={key}
      x={x}
      y={y}
      width="1"
      height="1"
      fill={color}
      stroke="var(--text)"
      strokeWidth=".025"
    />
  );
  const cells = faces.U.map((c, i) =>
    rect(3 + (i % 3), 3 + Math.floor(i / 3), c, `U${i}`),
  );
  if (view === "net") {
    const positions: Record<string, (i: number) => [number, number]> = {
      F: (i) => [3 + (i % 3), 6.15 + Math.floor(i / 3)],
      R: (i) => [6.15 + Math.floor(i / 3), 5 - (i % 3)],
      B: (i) => [5 - (i % 3), 1.85 - Math.floor(i / 3)],
      L: (i) => [1.85 - Math.floor(i / 3), 3 + (i % 3)],
    };
    for (const side of (["F", "R", "L", "B"] as const).slice(0, sides))
      faces[side].slice(0, rows * 3).forEach((c, i) => {
        const [x, y] = positions[side](i);
        cells.push(rect(x, y, c, `${side}${i}`));
      });
  }
  return (
    <svg
      viewBox={view === "top" ? "2.85 2.85 3.3 3.3" : rows === 1 ? "1.7 1.7 5.6 5.6" : "-0.2 -0.2 9.4 9.4"}
      className="recall-flat"
      role="img"
      aria-label="上面と側面のパターン"
    >
      {cells}
    </svg>
  );
}
