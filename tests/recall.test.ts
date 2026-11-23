import { expect, it } from "vitest";
import { Alg } from "cubing/alg";
import { puzzles } from "cubing/puzzles";
import cases from "../src/data/recall-cases.json";
it("every displayed case can be reversed by its listed algorithm", async () => {
  const cube = await puzzles["3x3x3"].kpuzzle();
  for (const [group, items] of Object.entries(cases)) {
    expect(items.length, group).toBeGreaterThan(20);
    for (const item of items) {
      const a = new Alg(item.alg),
        p = cube.defaultPattern().applyAlg(a.invert()).applyAlg(a);
      expect(p.patternData, `${group} ${item.name}`).toEqual(
        cube.defaultPattern().patternData,
      );
    }
  }
});
