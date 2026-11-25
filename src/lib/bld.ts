import { Alg } from "cubing/alg";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { randomScrambleForEvent } from "cubing/scramble";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";
import { m2Even, m2Parity, m2Setups, m2Special, opCornerSetups, opEdgeSetups, opParity, tPerm, yPerm } from "./bldMethods";

export type Orbit = "EDGES" | "CORNERS";
export type Breaks = "any" | "none" | "required";
export type BldOptions = Record<Orbit, {
  min: number;
  max: number;
  breaks: Breaks;
  buffer: string;
}>;
type Pieces = { pieces: number[]; orientation: number[] };
type Layout = { main: number; other: number[] };
type Target = { letter: string; piece: number; sticker: number };

export const ORBITS = ["EDGES", "CORNERS"] as const;
export const ORBIT_LABELS = { EDGES: "エッジ", CORNERS: "コーナー" };
export const BUFFERS = { EDGES: ["UF", "UR", "DF"], CORNERS: ["UFR", "UBL"] };
const pieceOrder = {
  EDGES: "UF UR UB UL DF DR DB DL FR FL BR BL".split(" "),
  CORNERS: "UFR URB UBL ULF DRF DFL DLB DBR".split(" "),
};

export const FACES = ["U", "L", "F", "R", "B", "D"] as const;
const facePositions = {
  EDGES: [
    "UB UR UF UL", "LU LF LD LB", "FU FR FD FL",
    "RU RB RD RF", "BU BL BD BR", "DF DR DB DL",
  ],
  CORNERS: [
    "UBL UBR UFR UFL", "LUB LUF LDF LDB", "FUL FUR FDR FDL",
    "RUF RUB RDB RDF", "BUR BUL BDL BDR", "DFL DFR DBR DBL",
  ],
};
const targets = (orbit: Orbit): Target[] =>
  facePositions[orbit].flatMap((face, index) => face.split(" ").map((position, offset) => {
    const piece = pieceOrder[orbit].findIndex((name) =>
      [...position].every((axis) => name.includes(axis)),
    );
    return { letter: String.fromCharCode(65 + index * 4 + offset), piece, sticker: pieceOrder[orbit][piece].indexOf(position[0]) };
  }));
const letters = { EDGES: targets("EDGES"), CORNERS: targets("CORNERS") };

export function speffzSticker(orbit: Orbit, letter: string) {
  const index = letter.charCodeAt(0) - 65;
  return {
    ...letters[orbit][index],
    position: facePositions[orbit][Math.floor(index / 4)].split(" ")[index % 4],
  };
}

export function bufferLetter(orbit: Orbit, name: string) {
  const piece = pieceOrder[orbit].indexOf(name);
  return letters[orbit].find((target) => target.piece === piece && target.sticker === 0)!.letter;
}

function layouts(remaining: number, minSize = 2): number[][] {
  const choices: number[][] = [[]];
  for (let size = minSize; size <= remaining; size++)
    for (const rest of layouts(remaining - size, size)) choices.push([size, ...rest]);
  return choices;
}

function choices(orbit: Orbit, options: BldOptions[Orbit]) {
  const capacity = pieceOrder[orbit].length - 1;
  const result: { count: number; layout: Layout }[] = [];
  for (let main = 0; main <= capacity; main++) {
    for (const other of layouts(capacity - main)) {
      if (options.breaks === "none" && other.length) continue;
      if (options.breaks === "required" && !other.length) continue;
      const count = main + other.reduce((total, size) => total + size + 1, 0);
      if (count >= options.min && count <= options.max) result.push({ count, layout: { main, other } });
    }
  }
  return result;
}

const randomInt = (max: number) => Math.floor(Math.random() * max);
const pick = <T>(values: T[]) => values[randomInt(values.length)];
const mod = (value: number, size: number) => ((value % size) + size) % size;
const orientationCount = (orbit: Orbit) => pieceOrder[orbit][0].length;

function createPieces(orbit: Orbit, name: string, layout: Layout): Pieces {
  const pieces = pieceOrder[orbit].map((_, index) => index);
  const orientation = pieces.map(() => 0);
  const buffer = pieceOrder[orbit].indexOf(name);
  const available = pieces.filter((index) => index !== buffer);
  for (let i = available.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [available[i], available[j]] = [available[j], available[i]];
  }
  const size = orientationCount(orbit);
  const cycles = [[buffer, ...available.splice(0, layout.main)], ...layout.other.map((n) => available.splice(0, n))];
  for (const cycle of cycles) {
    let sum = 0;
    cycle.forEach((position, i) => {
      pieces[position] = cycle[(i + 1) % cycle.length];
      orientation[position] = i === cycle.length - 1 ? mod(-sum, size) : randomInt(size);
      sum += orientation[position];
    });
  }
  return { pieces, orientation };
}

function swap(state: Pieces, buffer: number, target: Target, size: number) {
  const { piece, sticker } = target;
  [state.pieces[buffer], state.pieces[piece]] = [state.pieces[piece], state.pieces[buffer]];
  [state.orientation[buffer], state.orientation[piece]] = [
    mod(state.orientation[piece] + sticker, size),
    mod(state.orientation[buffer] - sticker, size),
  ];
}

const clone = (state: Pieces): Pieces => ({
  pieces: [...state.pieces],
  orientation: [...state.orientation],
});

export type MemoStep = {
  letter: string;
  kind: "swap" | "cycle-break" | "orientation";
};
export function traceMemoSteps(pattern: KPattern, orbit: Orbit, name: string): MemoStep[] {
  const buffer = pieceOrder[orbit].indexOf(name);
  const state = clone(pattern.patternData[orbit]);
  const size = orientationCount(orbit);
  const memo: MemoStep[] = [];
  for (let i = 0; i < 2 * state.pieces.length; i++) {
    const next = state.pieces[buffer];
    const target = next === buffer
      ? letters[orbit].find(({ piece }) => piece !== buffer &&
        (state.pieces[piece] !== piece || state.orientation[piece] !== 0))
      : letters[orbit].find(({ piece, sticker }) => piece === next && sticker === state.orientation[buffer]);
    if (!target) return memo;
    const kind = next !== buffer ? "swap"
      : state.pieces[target.piece] === target.piece ? "orientation" : "cycle-break";
    memo.push({ letter: target.letter, kind });
    swap(state, buffer, target, size);
  }
  throw Error("交換文字列を作成できませんでした。");
}

export function traceMemo(pattern: KPattern, orbit: Orbit, name: string) {
  return traceMemoSteps(pattern, orbit, name).map(({ letter }) => letter).join("");
}

export const normalizeMemo = (input: string) => input.normalize("NFKC").toUpperCase().replace(/\s/g, "");

export function verifyMemo(pattern: KPattern, orbit: Orbit, name: string, input: string) {
  const buffer = pieceOrder[orbit].indexOf(name);
  const state = clone(pattern.patternData[orbit]);
  for (const letter of normalizeMemo(input)) {
    const target = letters[orbit].find((entry) => entry.letter === letter);
    if (!target || target.piece === buffer)
      throw Error(`${ORBIT_LABELS[orbit]}の「${letter}」は交換先に指定できません。`);
    swap(state, buffer, target, orientationCount(orbit));
  }
  return state.pieces.filter((piece, index) => piece !== index || state.orientation[index] !== 0).length;
}

export async function generateBld(options: BldOptions) {
  const edges = choices("EDGES", options.EDGES);
  const corners = choices("CORNERS", options.CORNERS);
  const pairs = edges.flatMap((edge) => corners.filter((corner) => edge.count % 2 === corner.count % 2)
    .filter((corner) => edge.count + corner.count > 0).map((corner) => ({ edge, corner })));
  if (!pairs.length)
    throw Error("この範囲とサイクルブレイクの条件では作成できません。片方の範囲を広げてください。");
  const { edge, corner } = pick(pairs);
  const puzzle = await cube3x3x3.kpuzzle();
  const requested = new KPattern(puzzle, {
    ...puzzle.defaultPattern().patternData,
    EDGES: createPieces("EDGES", options.EDGES.buffer, edge.layout),
    CORNERS: createPieces("CORNERS", options.CORNERS.buffer, corner.layout),
  });
  const solution = await experimentalSolve3x3x3IgnoringCenters(requested);
  const scramble = solution.invert().toString().replace(/2'(?= |$)/g, "2");
  return { scramble, pattern: puzzle.defaultPattern().applyAlg(scramble), options };
}

export async function generateRandomBld(options: BldOptions) {
  return loadBldScramble((await randomScrambleForEvent("333")).toString(), options);
}

export async function loadBldScramble(input: string, options: BldOptions) {
  const scramble = input.replace(/[′’]/g, "'").trim().replace(/\s+/g, " ");
  if (!/^[URFDLB](?:2'?|')?(?: [URFDLB](?:2'?|')?)*$/.test(scramble))
    throw Error("U、R、F、D、L、B の面回転でスクランブルを入力してください。");
  const puzzle = await cube3x3x3.kpuzzle();
  return { scramble, pattern: puzzle.defaultPattern().applyAlg(scramble), options };
}

export const cubeNetCells = {
  EDGES: [-1, 0, -1, 3, -1, 1, -1, 2, -1],
  CORNERS: [0, -1, 1, -1, -1, -1, 3, -1, 2],
};

export type CubeFace = (typeof FACES)[number];
type Transfer = { from: string; to: string };
type MemoMove = { orbit: Orbit; letter: string };
type Sequences = Record<Orbit, string[]>;
export type MemoFrame = {
  colors: Record<Orbit, Record<string, CubeFace>>;
  centers: CubeFace[];
  transfers: Transfer[];
};
export type PreviewMethod = "3-style" | "m2-op" | "op";
export type PreviewStep = { label: string; orbit?: Orbit; algorithm?: string; moves?: MemoMove[] };
export type PreviewFrame = MemoFrame & { pattern: KPattern };

function memoFrame(state: Record<string, Pieces>, centers: CubeFace[], transfers: Transfer[]): MemoFrame {
  function colors(orbit: Orbit): Record<string, CubeFace> {
    const size = orientationCount(orbit);
    const source = state[orbit];
    return Object.fromEntries(letters[orbit].map(({ letter, piece, sticker }) => {
      const face = pieceOrder[orbit][source.pieces[piece]][mod(sticker + source.orientation[piece], size)];
      return [letter, face as CubeFace];
    }));
  }
  return { colors: { EDGES: colors("EDGES"), CORNERS: colors("CORNERS") }, centers, transfers };
}

function previewFrame(pattern: KPattern, transfers: Transfer[]): PreviewFrame {
  const centers = pattern.patternData.CENTERS.pieces.map((piece) => FACES[piece]);
  return { ...memoFrame(pattern.patternData, centers, transfers), pattern };
}

function memoTarget(orbit: Orbit, buffer: number, letter: string) {
  const target = letters[orbit].find((entry) => entry.letter === letter);
  if (!target || target.piece === buffer)
    throw Error(`${ORBIT_LABELS[orbit]}の「${letter}」は交換先に指定できません。`);
  return target;
}

function composeTransfers(parts: Transfer[][]): Transfer[] {
  const maps = parts.map((transfers) => new Map(transfers.map(({ from, to }) => [from, to])));
  const positions = new Set(parts.flatMap((transfers) => transfers.map(({ from }) => from)));
  return [...positions].flatMap((from) => {
    const to = maps.reduce((position, map) => map.get(position) ?? position, from);
    return from === to ? [] : [{ from, to }];
  });
}

function swapFrames(pattern: KPattern, options: BldOptions, groups: MemoMove[][]) {
  const state = { EDGES: clone(pattern.patternData.EDGES), CORNERS: clone(pattern.patternData.CORNERS) };
  const frames = [previewFrame(pattern, [])];
  for (const group of groups) {
    const parts = group.map(({ orbit, letter }) => {
      const buffer = pieceOrder[orbit].indexOf(options[orbit].buffer);
      const size = orientationCount(orbit);
      const target = memoTarget(orbit, buffer, letter);
      const transfers = letters[orbit].filter(({ piece }) => piece === buffer).flatMap((bufferSticker) => {
        const targetSticker = letters[orbit].find(({ piece, sticker }) => piece === target.piece &&
          sticker === mod(bufferSticker.sticker + target.sticker, size))!;
        const from = `${orbit}-${bufferSticker.letter}`;
        const to = `${orbit}-${targetSticker.letter}`;
        return [{ from, to }, { from: to, to: from }];
      });
      swap(state[orbit], buffer, target, size);
      return transfers;
    });
    const snapshot = new KPattern(pattern.kpuzzle, {
      ...pattern.patternData,
      EDGES: clone(state.EDGES),
      CORNERS: clone(state.CORNERS),
    });
    frames.push(previewFrame(snapshot, composeTransfers(parts)));
  }
  return frames;
}

export function memoFrames(pattern: KPattern, options: BldOptions, sequences: Sequences) {
  return swapFrames(pattern, options, ORBITS.flatMap((orbit) => sequences[orbit].map((letter) => [{ orbit, letter }])));
}

function describeMoves(orbit: Orbit, targets: string[]): string {
  return `${ORBIT_LABELS[orbit]} ${targets.join(" → ")}`;
}

function threeStylePreview(pattern: KPattern, options: BldOptions, sequences: Sequences) {
  const parity = sequences.EDGES.length % 2 === 1 && sequences.CORNERS.length % 2 === 1;
  const groups: MemoMove[][] = [];
  const steps: PreviewStep[] = [];
  for (const orbit of ORBITS) {
    const targets = parity ? sequences[orbit].slice(0, -1) : sequences[orbit];
    for (let index = 0; index < targets.length; index += 2) {
      const pair = targets.slice(index, index + 2);
      const moves = pair.map((letter) => ({ orbit, letter }));
      groups.push(moves);
      steps.push({ orbit, label: describeMoves(orbit, pair), moves });
    }
  }
  if (parity) {
    const moves = ORBITS.map((orbit) => ({ orbit, letter: sequences[orbit].at(-1)! }));
    groups.push(moves);
    steps.push({ label: `パリティ（${moves.map(({ orbit, letter }) => describeMoves(orbit, [letter])).join("、")}）`, moves });
  }
  return { frames: swapFrames(pattern, options, groups), steps };
}

function setupShot(setup: string, base: string) {
  const prefix = new Alg(setup);
  return prefix.concat(new Alg(base)).concat(prefix.invert()).toString();
}

function shotPreview(pattern: KPattern, sequences: Sequences, method: "m2-op" | "op") {
  const m2 = method === "m2-op";
  const steps: PreviewStep[] = [];
  for (const [index, letter] of sequences.EDGES.entries()) {
    memoTarget("EDGES", pieceOrder.EDGES.indexOf(m2 ? "DF" : "UR"), letter);
    const effective = index % 2 === 1 ? m2Even[letter] ?? letter : letter;
    const algorithm = m2 ? m2Special[effective] ?? setupShot(m2Setups[effective], "M2")
      : setupShot(opEdgeSetups[letter], tPerm);
    steps.push({ orbit: "EDGES", label: describeMoves("EDGES", [letter]), algorithm });
  }
  if (sequences.EDGES.length % 2 === 1) {
    steps.push({ label: m2 ? "M2 のパリティ処理" : "Old Pochmann のパリティ処理",
      algorithm: m2 ? m2Parity : opParity });
  }
  for (const letter of sequences.CORNERS) {
    memoTarget("CORNERS", pieceOrder.CORNERS.indexOf("UBL"), letter);
    steps.push({ orbit: "CORNERS", label: describeMoves("CORNERS", [letter]),
      algorithm: setupShot(opCornerSetups[letter], yPerm) });
  }

  const frames = [previewFrame(pattern, [])];
  let state = pattern;
  for (const { algorithm } of steps) {
    const transformation = pattern.kpuzzle.algToTransformation(algorithm!);
    const transfers = ORBITS.flatMap((orbit) => {
      const { permutation, orientationDelta } = transformation.transformationData[orbit];
      const size = orientationCount(orbit);
      return letters[orbit].flatMap(({ piece, sticker, letter: dest }) => {
        const source = letters[orbit].find((entry) => entry.piece === permutation[piece] &&
          entry.sticker === mod(sticker + orientationDelta[piece], size))!.letter;
        return source === dest ? [] : [{ from: `${orbit}-${source}`, to: `${orbit}-${dest}` }];
      });
    });
    transformation.transformationData.CENTERS.permutation.forEach((source, dest) => {
      if (source !== dest) transfers.push({ from: `CENTER-${FACES[source]}`, to: `CENTER-${FACES[dest]}` });
    });
    state = state.applyTransformation(transformation);
    frames.push(previewFrame(state, transfers));
  }
  return { frames, steps };
}

export function memoPreview(pattern: KPattern, options: BldOptions, sequences: Sequences, method: PreviewMethod) {
  return method === "3-style" ? threeStylePreview(pattern, options, sequences) : shotPreview(pattern, sequences, method);
}

export function previewCommutatorTargets(options: BldOptions, moves: MemoMove[]) {
  if (moves.length !== 2) return undefined;
  const [first, second] = moves;
  const { orbit } = first;
  if (orbit !== second.orbit || speffzSticker(orbit, first.letter).piece === speffzSticker(orbit, second.letter).piece)
    return undefined;
  return { orbit, letters: [bufferLetter(orbit, options[orbit].buffer), first.letter, second.letter] };
}

export async function previewStepAlgorithm(options: BldOptions, moves: MemoMove[]) {
  if (moves.length !== 2) throw Error("3-style は交換先が2つ揃うと回転手順を再生できます。");
  const targets = previewCommutatorTargets(options, moves);
  if (targets) return (await generateCommutator(targets.orbit, targets.letters)).execution;

  // A joint parity shot or an orientation-only pair has no three-piece cycle
  // on a single orbit. Solve the exact relative pattern to find physical turns.
  const puzzle = await cube3x3x3.kpuzzle();
  const [, target] = swapFrames(puzzle.defaultPattern(), options, [moves]);
  const solution = await experimentalSolve3x3x3IgnoringCenters(target.pattern);
  return solution.invert().toString();
}

export async function generateCommutator(orbit: Orbit, selected: string[]) {
  const [first, second, third] = selected.map((letter) => letters[orbit].find((item) => item.letter === letter));
  if (selected.length !== 3 || !first || !second || !third ||
      new Set([first.piece, second.piece, third.piece]).size !== 3)
    throw Error("異なる3つのピースを選んでください。");

  const { findCommutator } = await import("./bldCommutator");
  return findCommutator(orbit, [first, second, third]);
}
