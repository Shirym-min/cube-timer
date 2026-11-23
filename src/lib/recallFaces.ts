import { Alg } from "cubing/alg";
import { puzzles } from "cubing/puzzles";
import facelets from "../data/facelets.json";
type Sticker = { x: number; y: number; color: string };
type Face = "U" | "F" | "R" | "B" | "L";
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
