import { it, expect } from "vitest";
import { puzzles } from "cubing/puzzles";
import { FACE_PIECES, solveHint } from "../src/lib/solver";
it("returns moves that solve the requested cross and F2L pair on all faces", async () => {
  const k = await puzzles["3x3x3"].kpuzzle();
  for (const face of ["D", "U", "F", "B", "R", "L"])
    for (const xcross of [false, true]) {
      const scramble = "R U2 F' L2 D B' R2 F2 U'",
        result = await solveHint(scramble, face, xcross, 20000);
      const p = k
          .defaultPattern()
          .applyAlg(scramble)
          .applyAlg(result.alg).patternData,
        goal = FACE_PIECES[face];
      for (const e of goal.edges) {
        expect(p.EDGES.pieces[e]).toBe(e);
        expect(p.EDGES.orientation[e]).toBe(0);
      }
      if (xcross) {
        expect(p.EDGES.pieces[goal.edge]).toBe(goal.edge);
        expect(p.EDGES.orientation[goal.edge]).toBe(0);
        expect(p.CORNERS.pieces[goal.corner]).toBe(goal.corner);
        expect(p.CORNERS.orientation[goal.corner]).toBe(0);
      }
    }
}, 120000);
it("handles an already solved cross without inventing moves", async () => {
  expect((await solveHint("U", "D")).alg).toBe("");
});
