import { Alg } from "cubing/alg";
import { puzzles } from "cubing/puzzles";
import facelets from "../data/facelets.json";
type Sticker = { x: number; y: number; color: string };
type Face = "U" | "F" | "R" | "B" | "L";
export const upperNeighbors: Record<Exclude<Face, "U">, readonly number[]> = {
  F: [6, 7, 8], R: [8, 5, 2], B: [2, 1, 0], L: [0, 3, 6],
};

export function upperSlotPair(stickers: Record<Face, string[]>): Set<number> {
  const result = new Set<number>();
  for (let i = 0; i < 9; i++) {
    const colors = [stickers.U[i]];
    for (const side of ["F", "R", "B", "L"] as const) {
      const index = upperNeighbors[side].indexOf(i);
      if (index !== -1) colors.push(stickers[side][index]);
    }
    if (!colors.includes(stickers.U[4]) && colors.includes(stickers.F[4]) && colors.includes(stickers.R[4])) {
      result.add(i);
    }
  }
  return result;
}
const layout: Record<Face, [number, number]> = {
  U: [3.3, 0.1],
  F: [3.3, 3.3],
  R: [6.5, 3.3],
  B: [9.7, 3.3],
  L: [0.1, 3.3],
};
const colors = ["white", "orange", "limegreen", "red", "#26f", "yellow"];
export const topColors = [
  ["white", "白", ""],
  ["yellow", "黄", "x2"],
  ["green", "緑", "x"],
  ["blue", "青", "x'"],
  ["orange", "橙", "z"],
  ["red", "赤", "z'"],
] as const;
export type TopColor = (typeof topColors)[number][0];
export async function recallFaces(
  alg: string,
  top: TopColor,
  auf = "",
): Promise<Record<Face, string[]>> {
  const cube = await puzzles["3x3x3"].kpuzzle(),
    pattern = cube
      .defaultPattern()
      .applyAlg(new Alg(alg).invert())
      .applyAlg(auf).patternData;
  const rotation = topColors.find((c) => c[0] === top)![2],
    centers = cube.defaultPattern().applyAlg(rotation).patternData
      .CENTERS.pieces;
  const map = new Map(colors.map((c, i) => [c, colors[centers[i]]]));
  const data = facelets as Record<string, Sticker>,
    result = {} as Record<Face, string[]>;
  for (const [face, [startX, startY]] of Object.entries(layout) as [
    Face,
    [number, number],
  ][]) {
    result[face] = Array.from({ length: 9 }, (_, i) => {
      const x = startX + (i % 3),
        y = startY + Math.floor(i / 3);
      const entry = Object.entries(data).find(
        ([, v]) => Math.abs(v.x - x) < 0.01 && Math.abs(v.y - y) < 0.01,
      );
      if (!entry) throw Error(`Missing facelet ${face} ${i}`);
      const [, orbit, position, orientation] = entry[0].match(
        /^(\w+)-l(\d+)-o(\d+)$/,
      )!;
      const state = pattern[orbit],
        n = orbit === "CORNERS" ? 3 : orbit === "EDGES" ? 2 : 4,
        pos = Number(position),
        ori = (n - state.orientation[pos] + Number(orientation)) % n;
      const sticker = data[`${orbit}-l${state.pieces[pos]}-o${ori}`];
      return map.get(sticker?.color) ?? sticker?.color ?? "#888";
    });
  }
  return result;
}
