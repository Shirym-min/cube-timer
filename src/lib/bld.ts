import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { randomScrambleForEvent } from "cubing/scramble";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";

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

export function verifyMemo(pattern: KPattern, orbit: Orbit, name: string, input: string) {
  const buffer = pieceOrder[orbit].indexOf(name);
  const state = clone(pattern.patternData[orbit]);
  for (const letter of input.normalize("NFKC").toUpperCase().replace(/\s/g, "")) {
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
