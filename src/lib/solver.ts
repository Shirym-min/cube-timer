import { puzzles } from "cubing/puzzles";
export const FACE_PIECES: Record<
  string,
  { edges: number[]; corner: number; edge: number }
> = {
  D: { edges: [4, 5, 6, 7], corner: 4, edge: 8 },
  U: { edges: [0, 1, 2, 3], corner: 0, edge: 8 },
  F: { edges: [0, 4, 8, 9], corner: 0, edge: 1 },
  B: { edges: [2, 6, 10, 11], corner: 1, edge: 1 },
  R: { edges: [1, 5, 8, 10], corner: 0, edge: 0 },
  L: { edges: [3, 7, 9, 11], corner: 3, edge: 0 },
};
const moves = ["U", "D", "R", "L", "F", "B"].flatMap((f) => [
  f,
  f + "2",
  f + "'",
]);
const rotations: Record<string, string> = {
  D: "", U: "z2", F: "x'", B: "x", R: "z'", L: "z",
};
let prepared: ReturnType<typeof prepare> | undefined;
async function prepare() {
  const k = await puzzles["3x3x3"].kpuzzle();
  const edge: Uint8Array[] = [],
    corner: Uint8Array[] = [];
  for (const m of moves) {
    const t = k.moveToTransformation(m).transformationData;
    for (const [name, mod, out] of [
      ["EDGES", 2, edge],
      ["CORNERS", 3, corner],
    ] as const) {
      const a = new Uint8Array(24),
        o = t[name];
      for (let p = 0; p < o.permutation.length; p++)
        for (let v = 0; v < mod; v++)
          a[o.permutation[p] * mod + v] =
            p * mod + ((v + o.orientationDelta[p]) % mod);
      out.push(a);
    }
  }
  const orientedMoves = Object.fromEntries(
    Object.entries(rotations).map(([face, rotation]) => [
      face,
      moves.map((move) => {
        const target = JSON.stringify(k.defaultPattern().applyAlg(`${move} ${rotation}`).patternData);
        const mapped = moves.find((candidate) =>
          JSON.stringify(k.defaultPattern().applyAlg(`${rotation} ${candidate}`).patternData) === target,
        );
        if (!mapped) throw Error("手順の向きを変換できませんでした。");
        return mapped;
      }),
    ]),
  );
  return { k, edge, corner, orientedMoves };
}
const tables = new Map<string, Int8Array>();
function crossNext(code: number, t: Uint8Array) {
  return (
    t[code % 24] +
    24 * t[Math.floor(code / 24) % 24] +
    576 * t[Math.floor(code / 576) % 24] +
    13824 * t[Math.floor(code / 13824)]
  );
}
function crossTable(face: string, edge: Uint8Array[]) {
  const cached = tables.get(face);
  if (cached) return cached;
  const table = new Int8Array(24 ** 4).fill(-1),
    queue = new Int32Array(24 ** 4);
  const goal = FACE_PIECES[face].edges.reduce(
    (n, p, i) => n + p * 2 * 24 ** i,
    0,
  );
  table[goal] = 0;
  queue[0] = goal;
  let read = 0,
    write = 1;
  while (read < write) {
    const c = queue[read++],
      d = table[c] + 1;
    for (const t of edge) {
      const next = crossNext(c, t);
      if (table[next] === -1) {
        table[next] = d;
        queue[write++] = next;
      }
    }
  }
  tables.set(face, table);
  return table;
}
function pairTable(face: string, edge: Uint8Array[], corner: Uint8Array[]) {
  const key = face + "pair",
    cached = tables.get(key);
  if (cached) return cached;
  const table = new Int8Array(576).fill(-1),
    queue = new Int32Array(576),
    p = FACE_PIECES[face],
    goal = p.edge * 2 + 24 * p.corner * 3;
  table[goal] = 0;
  queue[0] = goal;
  let r = 0,
    w = 1;
  while (r < w) {
    const c = queue[r++];
    for (let m = 0; m < 18; m++) {
      const n = edge[m][c % 24] + 24 * corner[m][Math.floor(c / 24)];
      if (table[n] === -1) {
        table[n] = table[c] + 1;
        queue[w++] = n;
      }
    }
  }
  tables.set(key, table);
  return table;
}
export async function solveHint(
  scramble: string,
  face = "D",
  xcross = false,
  budgetMs = 10000,
): Promise<{ alg: string; depth: number; face: string; xcross: boolean }> {
  const { k, edge, corner, orientedMoves } = await (prepared ??= prepare()),
    p = FACE_PIECES[face];
  if (!p) throw Error("面を選択してください。");
  const pattern = k.defaultPattern().applyAlg(scramble).patternData;
  const state = (orbit: string, piece: number, mod: number) => {
    const o = pattern[orbit],
      pos = o.pieces.indexOf(piece);
    return pos * mod + o.orientation[pos];
  };
  const cross = p.edges.reduce(
      (n, piece, i) => n + state("EDGES", piece, 2) * 24 ** i,
      0,
    ),
    pair = state("EDGES", p.edge, 2) + 24 * state("CORNERS", p.corner, 3);
  const ct = crossTable(face, edge),
    pt = xcross ? pairTable(face, edge, corner) : null,
    path: number[] = [];
  let nodes = 0;
  const deadline = performance.now() + budgetMs;
  const dfs = (
    c: number,
    pair: number,
    left: number,
    prev: number,
  ): boolean => {
    if (ct[c] > left || (pt && pt[pair] > left)) return false;
    if (left === 0) return ct[c] === 0 && (!pt || pt[pair] === 0);
    if ((++nodes & 8191) === 0 && performance.now() > deadline)
      throw Error(
        "探索時間の上限に達しました。クロスを選ぶか、もう一度探索してください。",
      );
    for (let m = 0; m < 18; m++) {
      const f = Math.floor(m / 3);
      if (
        f === prev ||
        (prev >= 0 && Math.floor(f / 2) === Math.floor(prev / 2) && f < prev)
      )
        continue;
      const np = pt
        ? edge[m][pair % 24] + 24 * corner[m][Math.floor(pair / 24)]
        : pair;
      path.push(m);
      if (dfs(crossNext(c, edge[m]), np, left - 1, f)) return true;
      path.pop();
    }
    return false;
  };
  // shortcut: X-cross search is capped at 12 HTM and a time budget; raise the bound only with stronger pruning.
  for (let depth = Math.max(ct[cross], pt?.[pair] ?? 0); depth <= 12; depth++)
    if (dfs(cross, pair, depth, -1))
      return { alg: [rotations[face], ...path.map((m) => orientedMoves[face][m])].filter(Boolean).join(" "), depth, face, xcross };
  throw Error("12手以内の解が見つかりませんでした。");
}
