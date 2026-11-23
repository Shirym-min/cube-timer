import { expect, it } from "vitest";
import { Alg } from "cubing/alg";
import { puzzles } from "cubing/puzzles";
import cases from "../src/data/recall-cases.json";
import extraCases from "../src/data/recall-extra-cases.json";
it("every displayed case can be reversed by its listed algorithm", async () => {
  const cube = await puzzles["3x3x3"].kpuzzle();
  for (const [group, items] of Object.entries({ ...cases, ...extraCases })) {
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

it("provides distinct COLL, WV, and VLS recognition patterns", async () => {
  const cube = await puzzles["3x3x3"].kpuzzle();
  const solved = cube.defaultPattern();
  const { COLL, WV, VLS } = extraCases;
  const coll = new Set<string>();
  for (const { name, alg } of COLL) {
    const { CORNERS, EDGES } = solved.applyAlg(new Alg(alg).invert()).patternData;
    expect(EDGES.orientation.every((value) => value === 0), name).toBe(true);
    expect(CORNERS.pieces.slice(4), name).toEqual([4, 5, 6, 7]);
    // Ignore the edges and quotient by both starting and finishing AUF.
    const auf = ["", "U", "U2", "U'"];
    const variants = auf.flatMap((before) => auf.map((after) =>
      JSON.stringify(solved.applyAlg(before).applyAlg(new Alg(alg).invert())
        .applyAlg(after).patternData.CORNERS),
    ));
    coll.add(variants.sort()[0]);
  }
  expect(coll.size).toBe(40);

  for (const [group, items, count] of [["WV", WV, 27], ["VLS", VLS, 216]] as const) {
    const patterns = new Set<string>();
    for (const { name, alg } of items) {
      const setup = solved.applyAlg(new Alg(alg).invert());
      const { CORNERS, EDGES, CENTERS } = setup.patternData;
      expect(CENTERS.pieces, name).toEqual([0, 1, 2, 3, 4, 5]);
      expect([CORNERS.pieces[3], EDGES.pieces[0]], name).toEqual([4, 8]);
      if (group === "WV") expect(EDGES.orientation.every((value) => value === 0), name).toBe(true);
      const inserted = setup.applyAlg("R U' R'").patternData;
      expect(inserted.EDGES.pieces.slice(4), name).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
      expect(inserted.CORNERS.pieces.slice(4), name).toEqual([4, 5, 6, 7]);
      expect(inserted.EDGES.orientation.slice(4), name).toEqual(Array(8).fill(0));
      expect(inserted.CORNERS.orientation.slice(4), name).toEqual(Array(4).fill(0));
      patterns.add(JSON.stringify([CORNERS.orientation, EDGES.orientation]));
    }
    expect(patterns.size, group).toBe(count);
  }
});
