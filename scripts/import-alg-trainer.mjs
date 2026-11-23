import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { Alg, Move } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";

// Pass a trusted Alg-Trainer js/alg_list.js checkout. The file is MIT-licensed.
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: node scripts/import-alg-trainer.mjs path/to/alg_list.js");
const context = { window: {} };
runInNewContext(readFileSync(sourcePath, "utf8"), context, { timeout: 1000 });
const source = context.window.algs;
const cube = await cube3x3x3.kpuzzle();
const solved = cube.defaultPattern();
const rotations = new Map();
const solvedOptions = { ignorePuzzleOrientation: true, ignoreCenterOrientation: true };
const centers = (pattern) => pattern.patternData.CENTERS.pieces.join();

for (const top of ["", "x", "x2", "x'", "z", "z'"]) {
  for (const front of ["", "y", "y2", "y'"]) {
    const rotation = new Alg([top, front].filter(Boolean).join(" "));
    rotations.set(centers(solved.applyAlg(rotation)), rotation);
  }
}
assert.equal(rotations.size, 24);

const normalize = (text) => text.trim().replace(/\)\(/g, ") (").replace(/\s+/g, " ");
const halfTurns = (text) => text.replace(/2'/g, "2");
const moveCount = (alg) => [...alg.experimentalExpand()].filter(
  (move) => move instanceof Move && !["x", "y", "z"].includes(move.family),
).length;

function record(alg, generated = false) {
  const rotation = rotations.get(centers(solved.applyAlg(alg)));
  assert(rotation);
  const setup = rotation.concat(alg.invert());
  const startingPattern = solved.applyAlg(setup);
  assert.equal(centers(startingPattern), centers(solved));
  assert(startingPattern.applyAlg(alg).experimentalIsSolved(solvedOptions));
  return {
    alg: halfTurns(alg.toString()),
    setup: halfTurns(setup.toString()),
    moves: moveCount(alg),
    ...(generated ? { generated } : {}),
  };
}

function startKey(alg) {
  const pattern = solved.applyAlg(alg);
  return JSON.stringify([pattern.patternData.CORNERS, pattern.patternData.EDGES]);
}

async function alternate(original) {
  const pattern = solved.applyAlg(original.setup);
  for (const first of ["", "F", "R", "D", "B", "U", "L"]) {
    const prefix = new Alg(first);
    const solution = await experimentalSolve3x3x3IgnoringCenters(pattern.applyAlg(prefix));
    const alg = prefix.concat(solution).experimentalSimplify({ cancel: true });
    if (halfTurns(alg.toString()) === halfTurns(new Alg(original.alg).experimentalSimplify({ cancel: true }).toString())) continue;
    assert(pattern.applyAlg(alg).experimentalIsSolved(solvedOptions));
    return { ...record(alg, true), setup: original.setup };
  }
  // The solver can return the same moves from every prefix for short cases.
  // In that case, solve from a quarter-turn grip and include that regrip.
  const grip = new Alg("y");
  const fromGrip = solved.applyAlg(grip.invert().concat(new Alg(original.setup)).concat(grip));
  const alg = grip.concat(await experimentalSolve3x3x3IgnoringCenters(fromGrip));
  assert(pattern.applyAlg(alg).experimentalIsSolved(solvedOptions));
  return { ...record(alg, true), setup: original.setup };
}

const families = {
  F2L: source.F2L,
  OLL: source.OLL,
  PLL: source.PLL,
  COLL: source.COLL,
  WV: { FR: source.WVLS.FR },
  VLS: source.VLS,
  ZBLL: source["ZBLL (Juliette Sebastien)"],
  CMLL: source.CMLL,
};
const extraVariants = {
  VLS: source["VLS (Jayden McNeill)"],
  ZBLL: source["ZBLL (Jabari Nuruddin, Justin Taylor, Tao Yu)"],
};
const data = {};
const edgePerms = ["Ua", "Ub", "H", "Z"];
const cornerPerms = ["Aa", "Ab", "E"];

for (const [family, groups] of Object.entries(families)) {
  const extras = new Map();
  for (const rows of Object.values(extraVariants[family] ?? {})) {
    for (const row of rows) {
      for (const text of row.split("/").map(normalize).filter(Boolean)) {
        // One upstream entry omits a space between R' and U.
        const variant = record(new Alg(text.replaceAll("R'U", "R' U")));
        const key = startKey(variant.setup);
        const matches = extras.get(key) ?? [];
        matches.push(variant);
        extras.set(key, matches);
      }
    }
  }
  data[family] = [];
  for (const [group, cases] of Object.entries(groups)) {
    for (const [index, row] of cases.entries()) {
      const primary = row.split("/").map(normalize).filter(Boolean).map((text) => record(new Alg(text)));
      assert(primary.length > 0);
      const matching = primary.flatMap(({ setup }) => extras.get(startKey(setup)) ?? []);
      const variants = [...new Map([...primary, ...matching].map((variant) => [variant.alg, variant])).values()];
      if (variants.length === 1) variants.push(await alternate(variants[0]));
      const name = family === "PLL" ? `${group} Perm`
        : ["F2L", "OLL", "WV"].includes(family) ? `${family} ${index + 1}`
          : `${family} ${group} ${index + 1}`;
      let filterGroup = group;
      if (family === "ZBLL") filterGroup = group.replace(/\d+$/, "");
      if (family === "PLL") {
        filterGroup = edgePerms.includes(group) ? "エッジのみ"
          : cornerPerms.includes(group) ? "コーナーのみ" : "コーナーとエッジ";
      }
      if (family === "OLL") {
        const edges = solved.applyAlg(variants[0].setup).patternData.EDGES;
        const oriented = edges.pieces.slice(0, 4).filter((piece, position) =>
          piece < 4 && edges.orientation[position] === 0,
        ).length;
        filterGroup = `上面と同色のエッジ ${oriented} 枚`;
      }
      data[family].push({ name, group: filterGroup, variants });
    }
  }
  console.log(family, data[family].length, "cases");
}

writeFileSync(
  new URL("../src/data/algorithm-library.json", import.meta.url),
  "{\n" + Object.entries(data).map(([family, cases]) =>
    `  "${family}": [\n${cases.map((entry) => `    ${JSON.stringify(entry)}`).join(",\n")}\n  ]`,
  ).join(",\n") + "\n}\n",
);
// The cubing.js solver keeps its search worker alive after the data is written.
process.exit(0);
