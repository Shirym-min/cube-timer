import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import type { KTransformation } from "cubing/kpuzzle";
import type { Orbit } from "./bld";

type Sticker = { piece: number; sticker: number };
type Sequence = {
  turns: string[];
  stickers: Uint8Array;
  inverse: Uint8Array;
  lastLayer: number;
};
type Solution = { setup: string[]; base: string; expandedTurns: number };

const orbits = [
  { orbit: "EDGES", start: 0, size: 2 },
  { orbit: "CORNERS", start: 24, size: 3 },
  { orbit: "CENTERS", start: 48, size: 1 },
] as const;

function stickerMap(transformation: KTransformation) {
  const map = new Uint8Array(54);
  for (const { orbit, start, size } of orbits) {
    const { permutation, orientationDelta } = transformation.transformationData[orbit];
    for (let dest = 0; dest < permutation.length; dest++) {
      for (let sticker = 0; sticker < size; sticker++) {
        const source = start + permutation[dest] * size + (sticker + orientationDelta[dest]) % size;
        map[source] = start + dest * size + sticker;
      }
    }
  }
  return map;
}

function inverseMap(map: Uint8Array) {
  const inverse = new Uint8Array(map.length);
  map.forEach((dest, source) => { inverse[dest] = source; });
  return inverse;
}

// A cycle can start at any of its three pieces. Shifting all three sticker
// orientations by the same amount also describes the same transformation.
function cycleKey(a: number, b: number, c: number, size: number) {
  if (b < a && b < c) [a, b, c] = [b, c, a];
  else if (c < a && c < b) [a, b, c] = [c, a, b];
  const origin = a % size;
  const normalize = (position: number) =>
    position - position % size + (position % size - origin + size) % size;
  return (a - origin) * 576 + normalize(b) * 24 + normalize(c);
}

function invertTurn(turn: string) {
  if (turn.endsWith("2")) return turn;
  return turn.endsWith("'") ? turn.slice(0, -1) : turn + "'";
}

function storeCycle(
  a: Sequence, b: Sequence,
  direct: Record<Orbit, Map<number, Solution>>,
) {
  const aMap = a.stickers;
  const bMap = b.stickers;
  let edgeCount = 0;
  let cornerCount = 0;
  let first = 0;

  // [A, B] applies AB followed by (BA)⁻¹. Any piece that AB and BA
  // send to the same oriented position is untouched by the commutator.
  for (let i = 24; i < 48; i += 3) {
    if (bMap[aMap[i]] === aMap[bMap[i]]) continue;
    if (++cornerCount > 3) return;
    if (cornerCount === 1) first = i;
  }
  if (cornerCount !== 0 && cornerCount !== 3) return;
  for (let i = 0; i < 24; i += 2) {
    if (bMap[aMap[i]] === aMap[bMap[i]]) continue;
    if (cornerCount || ++edgeCount > 3) return;
    if (edgeCount === 1) first = i;
  }
  if (cornerCount !== 3 && edgeCount !== 3) return;
  for (let i = 48; i < 54; i++) {
    if (bMap[aMap[i]] !== aMap[bMap[i]]) return;
  }
  const { orbit, start, size } = orbits[cornerCount ? 1 : 0];
  const next = (sticker: number) => b.inverse[a.inverse[bMap[aMap[sticker]]]];
  const second = next(first);
  const third = next(second);
  if (Math.floor(first / size) === Math.floor(second / size) ||
      Math.floor(second / size) === Math.floor(third / size) ||
      Math.floor(first / size) === Math.floor(third / size) ||
      next(third) !== first) return;

  const expandedTurns = 2 * (a.turns.length + b.turns.length);
  for (const [middle, last, left, right] of [
    [second, third, a, b], [third, second, b, a],
  ] as const) {
    const key = cycleKey(first - start, middle - start, last - start, size);
    const existing = direct[orbit].get(key);
    if (!existing || expandedTurns < existing.expandedTurns) {
      direct[orbit].set(key, {
        setup: [], base: `[${left.turns.join(" ")}, ${right.turns.join(" ")}]`, expandedTurns,
      });
    }
  }
}

function withSetups(
  direct: Map<number, Solution>, moves: Sequence[], start: number, size: number,
) {
  const solutions = new Map(direct);
  const byCost: [number, Solution][][] = [];
  for (const [key, solution] of direct) {
    (byCost[solution.expandedTurns] ??= []).push([key, solution]);
  }

  // Expand the cheapest algorithms first. A setup adds its turn on each
  // side, so its cost is two. For equal totals prefer fewer setup turns.
  for (let cost = 0; cost < byCost.length; cost++) {
    for (const [key, solution] of byCost[cost] ?? []) {
      if (solutions.get(key) !== solution) continue;
      const a = Math.floor(key / 576) + start;
      const b = Math.floor(key / 24) % 24 + start;
      const c = key % 24 + start;
      for (const { stickers, turns } of moves) {
        const next = cycleKey(stickers[a] - start, stickers[b] - start, stickers[c] - start, size);
        const previous = solutions.get(next);
        const expandedTurns = cost + 2;
        if (previous && (previous.expandedTurns < expandedTurns ||
            (previous.expandedTurns === expandedTurns && previous.setup.length <= solution.setup.length + 1))) continue;
        const candidate = { setup: [invertTurn(turns[0]), ...solution.setup], base: solution.base, expandedTurns };
        solutions.set(next, candidate);
        (byCost[expandedTurns] ??= []).push([next, candidate]);
      }
    }
  }
  return solutions;
}

async function prepare() {
  const puzzle = await cube3x3x3.kpuzzle();
  // Group parallel layers so consecutive commuting turns have one ordering.
  const layers = ["U", "D", "E", "R", "L", "M", "F", "B", "S"];
  const moves = layers.flatMap((layer, lastLayer) => ["", "'", "2"].map((suffix) => {
    const turn = layer + suffix;
    const stickers = stickerMap(puzzle.moveToTransformation(turn));
    return { turns: [turn], stickers, inverse: inverseMap(stickers), lastLayer };
  }));
  const direct = { EDGES: new Map<number, Solution>(), CORNERS: new Map<number, Solution>() };
  function extend(sequence: Sequence, visit: (next: Sequence) => void) {
    for (const move of moves) {
      const { lastLayer } = move;
      const sameAxis = Math.floor(lastLayer / 3) === Math.floor(sequence.lastLayer / 3);
      if (sameAxis && lastLayer <= sequence.lastLayer) continue;
      const stickers = sequence.stickers.map((position) => move.stickers[position]);
      visit({ turns: [...sequence.turns, move.turns[0]], stickers, inverse: inverseMap(stickers), lastLayer });
    }
  }

  function searchSingleTurnInterchanges(sequence: Sequence) {
    for (const move of moves) storeCycle(sequence, move, direct);
  }

  // Search [1–4 turns, 1 turn] and [2–3 turns, 2 turns]. Each valid
  // commutator also supplies its inverse by swapping its two parts.
  const pairs: Sequence[] = [];
  for (const move of moves) {
    searchSingleTurnInterchanges(move);
    extend(move, (pair) => pairs.push(pair));
  }
  for (const [index, pair] of pairs.entries()) {
    searchSingleTurnInterchanges(pair);
    for (let i = 0; i < index; i++) storeCycle(pair, pairs[i], direct);
    extend(pair, (triple) => {
      searchSingleTurnInterchanges(triple);
      for (const interchange of pairs) storeCycle(triple, interchange, direct);
      extend(triple, searchSingleTurnInterchanges);
    });
  }

  return {
    moves,
    tables: {
      EDGES: withSetups(direct.EDGES, moves, 0, 2),
      CORNERS: withSetups(direct.CORNERS, moves, 24, 3),
    },
  };
}

function formatSolution(setupTurns: string[], base: string) {
  const setup = setupTurns.join(" ");
  const alg = setup ? `[${setup}: ${base}]` : base;
  const execution = new Alg(alg).expand().experimentalSimplify({ cancel: true, puzzleLoader: cube3x3x3 });
  return { setup, base, alg, execution: execution.toString(), moveCount: [...execution.childAlgNodes()].length };
}

let prepared: ReturnType<typeof prepare> | undefined;

export async function findCommutator(orbit: Orbit, targets: readonly [Sticker, Sticker, Sticker]) {
  const { start, size } = orbits[orbit === "EDGES" ? 0 : 1];
  const [a, b, c] = targets.map(({ piece, sticker }) => piece * size + sticker);
  const { moves, tables } = await (prepared ??= prepare());
  const table = tables[orbit];
  const solution = table.get(cycleKey(a, b, c, size));
  if (!solution) throw Error("選んだステッカーの手順を作成できませんでした。");
  let best = formatSolution(solution.setup, solution.base);
  let setupLength = solution.setup.length;

  // A turn used to reach a nearby cycle can cancel against its commutator.
  // Compare the executable sequences after combining adjacent turns.
  for (const { turns, stickers } of moves) {
    const next = cycleKey(stickers[start + a] - start, stickers[start + b] - start, stickers[start + c] - start, size);
    const neighbor = table.get(next)!;
    const candidateSetup = [turns[0], ...neighbor.setup];
    const candidate = formatSolution(candidateSetup, neighbor.base);
    if (candidate.moveCount < best.moveCount ||
        (candidate.moveCount === best.moveCount && candidateSetup.length < setupLength)) {
      best = candidate;
      setupLength = candidateSetup.length;
    }
  }
  return best;
}
