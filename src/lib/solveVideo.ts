import { puzzles } from "cubing/puzzles";

export const CAPTURE_FPS = 120;
export const stages = ["クロス", "F2L", "OLL", "PLL"] as const;
export type Marks = [start: number, ...completions: (number | null)[]];
export type Interval = { start: number; end: number };
export type Sample = { time: number; change: number | null };
export type Region = { x: number; y: number; size: number };

export function splitTimes(marks: Marks, slowdown: number) {
  return stages.map((_, index) => {
    const start = marks[index], end = marks[index + 1];
    return start === null || end === null ? null : (end - start) / slowdown;
  });
}

export function pauseCandidates(
  samples: Sample[],
  slowdown: number,
  threshold: number,
  minimum: number,
) {
  const pauses: Interval[] = [];
  let still: Interval | undefined;
  for (let index = 1; index <= samples.length; index++) {
    const sample = samples[index];
    if (sample?.change != null && sample.change < threshold) {
      if (still) still.end = sample.time;
      else still = { start: samples[index - 1].time, end: sample.time };
    } else {
      if (still && (still.end - still.start) / slowdown >= minimum) pauses.push(still);
      still = undefined;
    }
  }
  return pauses;
}

export function regionBounds({ x, y, size }: Region, width: number, height: number) {
  const side = Math.min(width, height) * size / 100;
  return {
    left: (width - side) * x / 100,
    top: (height - side) * y / 100,
    side,
  };
}

export function pixelChange(previous: Uint8ClampedArray, current: Uint8ClampedArray) {
  let changed = 0;
  for (let i = 0; i < current.length; i += 4) {
    if (
      Math.abs(current[i] - previous[i]) >= 18 ||
      Math.abs(current[i + 1] - previous[i + 1]) >= 18 ||
      Math.abs(current[i + 2] - previous[i + 2]) >= 18
    ) changed++;
  }
  return changed / (current.length / 4);
}

function parseMoves(text: string, label: string) {
  const moves = text.trim().replace(/[’′]/g, "'").split(/\s+/).filter(Boolean);
  if (!moves.length) throw Error(`${label}を入力してください。`);
  if (moves.length > 500 || moves.some((move) => !/^(?:[URFDLB]w?|[urfdlbMESxyz])(?:2'?|')?$/.test(move))) {
    throw Error(`${label}は R、U'、F2、Rw、x などの記号を空白で区切って入力してください。`);
  }
  return moves.join(" ");
}

export async function checkScramble(text: string) {
  const scramble = parseMoves(text, "初期スクランブル");
  const cube = await puzzles["3x3x3"].kpuzzle();
  return { scramble, pattern: cube.defaultPattern().applyAlg(scramble) };
}

export async function reconstructSolve(scrambleText: string, movesText: string) {
  const { scramble, pattern } = await checkScramble(scrambleText);
  const moves = parseMoves(movesText, "解法手順");
  const end = pattern.applyAlg(moves);
  return {
    scramble,
    moves,
    solved: end.experimentalIsSolved({
      ignorePuzzleOrientation: true,
      ignoreCenterOrientation: true,
    }),
  };
}
