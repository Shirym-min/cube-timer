import { puzzles } from "cubing/puzzles";
import facelets from "../data/facelets.json";
import type { Marks } from "./solveVideo";

export type Point = { x: number; y: number };
export type RGB = [number, number, number];
export const cubeFaces = ["U", "L", "F", "R", "B", "D"] as const;
export const cubeColors = ["白", "橙", "緑", "赤", "青", "黄"] as const;
const colorKeys = ["white", "orange", "limegreen", "red", "#26f", "yellow"];
const faceOrigins = [[3.3, .1], [.1, 3.3], [3.3, 3.3], [6.5, 3.3], [9.7, 3.3], [3.3, 6.5]];
const opposite = [5, 3, 4, 1, 2, 0];
const slotKeys = Object.keys(facelets) as (keyof typeof facelets)[];
const slots = cubeFaces.flatMap((_, face) => Array.from({ length: 9 }, (_, index) => {
  const [x, y] = faceOrigins[face];
  const key = slotKeys.find((key) => (
    Math.abs(facelets[key].x - (x + index % 3)) < .01 &&
    Math.abs(facelets[key].y - (y + Math.floor(index / 3))) < .01
  ))!;
  const [, orbit, position, orientation] = key.match(/^(\w+)-l(\d+)-o(\d+)$/)!;
  return { key, orbit, position: Number(position), orientation: Number(orientation) };
}));
const keyIndexes = new Map(slots.map(({ key }, index) => [key, index]));
const solved = Uint8Array.from(slots, ({ key }) => colorKeys.indexOf(facelets[key].color));
const visible = [0, 2, 3].flatMap((face) => Array.from({ length: 9 }, (_, index) => face * 9 + index));
export const visibleFaces = [[0, 1, 6, 5], [5, 6, 3, 4], [6, 1, 2, 3]];
const centers = (state: Uint8Array) => cubeFaces.map((_, face) => state[face * 9 + 4]).join("");
const apply = (state: Uint8Array, indexes: Uint8Array) => indexes.map((index) => state[index]);
const identity = Uint8Array.from(slots, (_, i) => i);
const pieceKey = ({ orbit, position }: (typeof slots)[number]) => `${orbit}-${position}`;

async function buildModel() {
  const cube = await puzzles["3x3x3"].kpuzzle();
  const permutation = (moves: string) => {
    const data = cube.algToTransformation(moves).transformationData;
    return Uint8Array.from(slots, ({ orbit, position, orientation }) => {
      const source = data[orbit];
      const mod = orbit === "CORNERS" ? 3 : orbit === "EDGES" ? 2 : 1;
      const oldOrientation = (orientation + mod - source.orientationDelta[position] % mod) % mod;
      return keyIndexes.get(`${orbit}-l${source.permutation[position]}-o${oldOrientation}` as (typeof slots)[number]["key"])!;
    });
  };

  const rotations = [{ notation: "", indexes: identity }];
  const normalize = new Map([[centers(solved), identity]]);
  for (let i = 0; i < rotations.length; i++) {
    for (const turn of ["x", "y"]) {
      const notation = [rotations[i].notation, turn].filter(Boolean).join(" ");
      const indexes = permutation(notation);
      const key = centers(apply(solved, indexes));
      if (normalize.has(key)) continue;
      rotations.push({ notation, indexes });
      const inverse = new Uint8Array(54);
      indexes.forEach((source, target) => { inverse[source] = target; });
      normalize.set(key, inverse);
    }
  }
  const moves = [
    ...cubeFaces, "x", "y", "z", "M", "E", "S", ...cubeFaces.map((f) => f + "w"),
  ].flatMap((face) => ["", "'", "2"].map((suffix) => {
    const notation = face + suffix;
    return { notation, indexes: permutation(notation) };
  }));
  return { permutation, rotations, normalize, moves };
}
let model: ReturnType<typeof buildModel> | undefined;

const standardPalette: RGB[] = [
  [245, 245, 245], [248, 117, 20], [27, 162, 65],
  [213, 20, 35], [26, 92, 215], [240, 224, 34],
];

function colorCoordinates([r, g, b]: RGB) {
  const max = Math.max(r, g, b), range = max - Math.min(r, g, b);
  const hue = range < 1 ? 0 : max === r ? (g - b) / range
    : max === g ? (b - r) / range + 2 : (r - g) / range + 4;
  const angle = hue * Math.PI / 3;
  const saturation = range / Math.max(1, max);
  return [Math.cos(angle) * saturation, Math.sin(angle) * saturation];
}
function readColors(samples: (RGB | null)[], palette: RGB[]) {
  const references = palette.map(colorCoordinates);
  return samples.map((rgb) => {
    if (!rgb || Math.max(...rgb) < 42) return -1;
    const [x, y] = colorCoordinates(rgb);
    const distances = references.map(([a, b], color) => ({ color, distance: (x - a) ** 2 + (y - b) ** 2 }))
      .sort((a, b) => a.distance - b.distance);
    if (distances[0].distance > .30 || distances[1].distance - distances[0].distance < .015) return -1;
    return distances[0].color;
  });
}

function matchErrors(state: Uint8Array, colors: number[]) {
  return visible.reduce((sum, slot, index) => sum + Number(colors[index] >= 0 && colors[index] !== state[slot]), 0);
}

function completionMarks(trace: { time: number; level: number }[]): Marks {
  // OLL and PLL algorithms can temporarily break already completed layers.
  return [trace[0].time, ...[1, 2, 3, 4].map((level) =>
    trace.find((step) => step.level >= level)?.time ?? null)];
}

export async function createCubeTracker(scramble: string, crossColor: number, frameSpacing = 1 / 120) {
  const { permutation, rotations, normalize, moves } = await (model ??= buildModel());
  const initial = apply(solved, permutation(scramble));
  const candidates = rotations.map(({ notation, indexes }) => ({ notation, state: apply(initial, indexes) }));
  const bottom = slots.slice(crossColor * 9, crossColor * 9 + 9);
  const top = opposite[crossColor];
  const topEdges = new Set(slots.slice(top * 9, top * 9 + 9).filter(({ orbit }) => orbit === "EDGES").map(pieceKey));
  const crossEdges = new Set(bottom.filter(({ orbit }) => orbit === "EDGES").map(pieceKey));
  const bottomCorners = new Set(bottom.filter(({ orbit }) => orbit === "CORNERS").map(pieceKey));
  const cross = slots.flatMap((slot, i) => crossEdges.has(pieceKey(slot)) ? [i] : []);
  const f2l = slots.flatMap((slot, i) => (
    slot.orbit === "EDGES" && !topEdges.has(pieceKey(slot)) || bottomCorners.has(pieceKey(slot))
  ) ? [i] : []);

  function level(state: Uint8Array) {
    const canonical = apply(state, normalize.get(centers(state))!);
    if (cross.some((slot) => canonical[slot] !== solved[slot])) return 0;
    if (f2l.some((slot) => canonical[slot] !== solved[slot])) return 1;
    if (!canonical.subarray(top * 9, top * 9 + 9).every((color) => color === top)) return 2;
    return canonical.every((color, i) => color === solved[i]) ? 4 : 3;
  }

  let state: Uint8Array | undefined;
  let palette = standardPalette;
  let orientation = "";
  let neighbors: { notation: string; state: Uint8Array }[] = [];
  let pending: { index: number; time: number } | undefined;
  let firstFrame: number | undefined;
  let lastMatch = 0;
  const trace: { time: number; level: number; move?: string }[] = [];

  return {
    observe(time: number, pixels: (RGB | null)[]) {
      if (trace.at(-1)?.level === 4) return;
      firstFrame ??= time;
      const colors = readColors(pixels, palette);
      const readable = colors.filter((color) => color >= 0).length;
      if (!state) {
        if (time - firstFrame > frameSpacing * 12) return;
        const ranked = candidates.map((candidate) => ({ ...candidate, errors: matchErrors(candidate.state, colors) }))
          .sort((a, b) => a.errors - b.errors);
        const best = ranked[0];
        if (readable < 23 || best.errors > 2 || ranked[1].errors - best.errors < 4) return;
        state = best.state;
        orientation = best.notation;
        palette = standardPalette.map((rgb, color): RGB => {
          const matches = pixels.filter((pixel, i) => pixel && colors[i] === color && state![visible[i]] === color) as RGB[];
          if (!matches.length) return rgb;
          return rgb.map((_, channel) => matches.map((p) => p[channel]).sort((a, b) => a - b)[Math.floor(matches.length / 2)]) as RGB;
        });
        neighbors = moves.map(({ notation, indexes }) => ({ notation, state: apply(state!, indexes) }));
        trace.push({ time, level: level(state) });
        lastMatch = time;
        return;
      }

      if (readable < 20) {
        pending = undefined;
        return;
      }
      const currentErrors = matchErrors(state, colors);
      if (currentErrors <= 1) {
        lastMatch = time;
        pending = undefined;
        return;
      }
      let bestIndex = -1;
      let bestErrors = 2;
      let runnerUp = currentErrors;
      for (let i = 0; i < neighbors.length; i++) {
        const errors = matchErrors(neighbors[i].state, colors);
        if (errors < bestErrors) {
          runnerUp = Math.min(runnerUp, bestErrors);
          bestErrors = errors;
          bestIndex = i;
        } else runnerUp = Math.min(runnerUp, errors);
      }
      if (bestIndex < 0 || runnerUp - bestErrors < 1 || currentErrors - bestErrors < 3) {
        pending = undefined;
        return;
      }
      if (pending?.index !== bestIndex || time - pending.time > frameSpacing * 2.5) {
        pending = { index: bestIndex, time };
        return;
      }
      const next = neighbors[bestIndex];
      state = next.state;
      trace.push({ time: pending.time, level: level(state), move: next.notation });
      neighbors = moves.map(({ notation, indexes }) => ({ notation, state: apply(state!, indexes) }));
      lastMatch = time;
      pending = undefined;
    },
    result() {
      if (!trace.length) return null;
      const marks = completionMarks(trace);
      const end = marks[4];
      const setup = [scramble, orientation].filter(Boolean).join(" ");
      const notation = trace.filter((step) => end === null || step.time <= end).flatMap((step) => step.move ?? []).join(" ");
      return { marks, setup, notation, lastMatch };
    },
  };
}

export function stickerPoints(points: Point[]): Point[] | null {
  if (points.length !== 7) return null;
  const result: Point[] = [];
  for (const face of visibleFaces) {
    const [a, b, c, d] = face.map((index) => points[index]);
    const corners = [a, b, c, d];
    if (corners.some((p, i) => {
      const q = corners[(i + 1) % 4], r = corners[(i + 2) % 4];
      return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x) < .001;
    })) return null;

    // Project the square onto the face quadrilateral before choosing sticker centers.
    const bx = b.x - c.x, by = b.y - c.y, dx = d.x - c.x, dy = d.y - c.y;
    const sx = a.x - b.x + c.x - d.x, sy = a.y - b.y + c.y - d.y;
    const denominator = bx * dy - dx * by;
    const g = (sx * dy - dx * sy) / denominator;
    const h = (bx * sy - sx * by) / denominator;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const u = (col + .5) / 3, v = (row + .5) / 3;
        const w = g * u + h * v + 1;
        result.push({
          x: ((b.x - a.x + g * b.x) * u + (d.x - a.x + h * d.x) * v + a.x) / w,
          y: ((b.y - a.y + g * b.y) * u + (d.y - a.y + h * d.y) * v + a.y) / w,
        });
      }
    }
  }
  return result;
}

export function readStickerPixels(context: CanvasRenderingContext2D, points: Point[]) {
  const { width, height } = context.canvas;
  const frame = context.getImageData(0, 0, width, height).data;
  return points.map(({ x, y }): RGB | null => {
    const cx = Math.max(1, Math.min(width - 2, Math.floor(x * width)));
    const cy = Math.max(1, Math.min(height - 2, Math.floor(y * height)));
    const pixels: RGB[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const index = ((cy + dy) * width + cx + dx) * 4;
        pixels.push([frame[index], frame[index + 1], frame[index + 2]]);
      }
    }
    const rgb = [0, 1, 2].map((channel) => pixels.map((pixel) => pixel[channel]).sort((a, b) => a - b)[4]) as RGB;
    return pixels.filter((pixel) => pixel.every((value, channel) => Math.abs(value - rgb[channel]) < 36)).length >= 6 ? rgb : null;
  });
}
