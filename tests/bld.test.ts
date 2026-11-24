import { expect, it } from "vitest";
import { bufferLetter, FACES, generateBld, generateCommutator, loadBldScramble, memoFrames, memoPreview, speffzSticker, traceMemo, traceMemoSteps, verifyMemo, type BldOptions } from "../src/lib/bld";

it("maps standard Speffz buffer stickers", () => {
  expect(bufferLetter("EDGES", "UF")).toBe("C");
  expect(bufferLetter("EDGES", "UR")).toBe("B");
  expect(bufferLetter("EDGES", "DF")).toBe("U");
  expect(bufferLetter("CORNERS", "UBL")).toBe("A");
  expect(bufferLetter("CORNERS", "UFR")).toBe("C");
});

it("generates a legal scramble with independent cycle conditions, then verifies its memo", async () => {
  const { pattern, scramble } = await generateBld({
    EDGES: { min: 3, max: 3, breaks: "required", buffer: "DF" },
    CORNERS: { min: 3, max: 3, breaks: "none", buffer: "UBL" },
  });
  expect(scramble).not.toBe("");
  expect(pattern.patternData.EDGES.pieces[4]).toBe(4);
  expect(pattern.patternData.CORNERS.pieces[2]).not.toBe(2);
  const edges = traceMemo(pattern, "EDGES", "DF");
  const corners = traceMemo(pattern, "CORNERS", "UBL");
  expect(edges).toHaveLength(3);
  expect(corners).toHaveLength(3);
  expect(verifyMemo(pattern, "EDGES", "DF", edges)).toBe(0);
  expect(verifyMemo(pattern, "CORNERS", "UBL", corners)).toBe(0);
  expect(verifyMemo(pattern, "EDGES", "DF", edges.slice(0, -1))).toBeGreaterThan(0);
  expect(() => verifyMemo(pattern, "EDGES", "DF", "U")).toThrow("交換先");
}, 20000);

it("rejects swap ranges that force different edge and corner parity", async () => {
  await expect(generateBld({
    EDGES: { min: 2, max: 2, breaks: "none", buffer: "UR" },
    CORNERS: { min: 3, max: 3, breaks: "none", buffer: "UFR" },
  })).rejects.toThrow("作成できません");
});

it("solves full scrambles using the guide's OP and M2/OP setup tables", async () => {
  const { Alg } = await import("cubing/alg");
  const { cube3x3x3 } = await import("cubing/puzzles");
  const {
    m2Even, m2Parity, m2Setups, m2Special, opCornerSetups, opEdgeSetups, opParity, tPerm, yPerm,
  } = await import("../src/lib/bldMethods");
  const solved = (await cube3x3x3.kpuzzle()).defaultPattern();
  const shot = (setup: string, base: string) =>
    new Alg(setup).concat(new Alg(base)).concat(new Alg(setup).invert());
  const specialLettersSeen = new Set<string>();
  const scrambles = [
    "R U F2 D' B2 L U2 R' F L2 D B U'",
    "F2 D R' B L' U2 D2 F R U' L2 B' R2",
    "D B2 R U' B L2 F U2 D' L' F2 B' R",
    "U' L2 D' U R2 B' D' U' L2 B2 R' U' B' F' L U2 F R2 U'",
  ];

  for (const scramble of scrambles) {
    const start = solved.applyAlg(scramble);
    const corners = traceMemo(start, "CORNERS", "UBL");
    for (const m2 of [false, true]) {
      const edges = traceMemo(start, "EDGES", m2 ? "DF" : "UR");
      let state = start;
      [...edges].forEach((letter, index) => {
        if (m2) {
          if (m2Special[letter]) specialLettersSeen.add(letter);
          const effective = index % 2 === 1 ? m2Even[letter] ?? letter : letter;
          state = state.applyAlg(m2Special[effective] ?? shot(m2Setups[effective], "M2"));
        } else {
          state = state.applyAlg(shot(opEdgeSetups[letter], tPerm));
        }
      });
      if (edges.length % 2) state = state.applyAlg(m2 ? m2Parity : opParity);
      for (const letter of corners) {
        state = state.applyAlg(shot(opCornerSetups[letter], yPerm));
      }
      expect(state.patternData).toEqual(solved.patternData);
    }
  }
  expect(specialLettersSeen).toEqual(new Set(Object.keys(m2Special)));
});

it("loads pasted face turns and identifies a separate cycle in the review", async () => {
  const options: BldOptions = {
    EDGES: { min: 0, max: 16, breaks: "any", buffer: "UF" },
    CORNERS: { min: 0, max: 10, breaks: "any", buffer: "UBL" },
  };
  const { scramble, pattern } = await loadBldScramble("  U  \n D′  ", options);
  expect(scramble).toBe("U D'");
  for (const [orbit, buffer] of [["EDGES", "UF"], ["CORNERS", "UBL"]] as const) {
    const steps = traceMemoSteps(pattern, orbit, buffer);
    expect(steps[0].kind).toBe("swap");
    expect(steps.filter((step) => step.kind === "cycle-break")).toHaveLength(1);
    expect(verifyMemo(pattern, orbit, buffer, steps.map(({ letter }) => letter).join(""))).toBe(0);
  }
  await expect(loadBldScramble("U Invalid", options)).rejects.toThrow("面回転");
});

it("animates exact sticker transfers and resolves a generated memo to the solved colors", async () => {
  const options: BldOptions = {
    EDGES: { min: 0, max: 16, breaks: "any", buffer: "UF" },
    CORNERS: { min: 0, max: 10, breaks: "any", buffer: "UBL" },
  };
  const { pattern } = await loadBldScramble("F R U D'", options);
  const sequences = {
    EDGES: [...traceMemo(pattern, "EDGES", "UF")],
    CORNERS: [...traceMemo(pattern, "CORNERS", "UBL")],
  };
  const frames = memoFrames(pattern, options, sequences);
  expect(frames.length).toBe(1 + sequences.EDGES.length + sequences.CORNERS.length);
  for (let index = 1; index < frames.length; index++)
    for (const { from, to } of frames[index].transfers) {
      const [orbit, letter] = from.split("-") as ["EDGES" | "CORNERS", string];
      expect(frames[index].colors[orbit][to.split("-")[1]]).toBe(frames[index - 1].colors[orbit][letter]);
    }
  for (const colors of Object.values(frames.at(-1)!.colors))
    expect(Object.values(colors)).toEqual(FACES.flatMap((face) => Array(4).fill(face)));
  expect(() => memoFrames(pattern, options, { EDGES: ["C"], CORNERS: [] })).toThrow("交換先");
});

it("replays paired 3-style shots and the M2/Old Pochmann algorithms through parity", async () => {
  const options: BldOptions = {
    EDGES: { min: 0, max: 16, breaks: "any", buffer: "DF" },
    CORNERS: { min: 0, max: 10, breaks: "any", buffer: "UBL" },
  };
  const { pattern } = await loadBldScramble("R U F2 D' B2 L U2 R' F L2 D B U'", options);
  const sequences = {
    EDGES: [...traceMemo(pattern, "EDGES", "DF")],
    CORNERS: [...traceMemo(pattern, "CORNERS", "UBL")],
  };
  expect(sequences.EDGES.length % 2).toBe(1);
  expect(sequences.CORNERS.length % 2).toBe(1);
  const shots = sequences.EDGES.length + sequences.CORNERS.length;

  for (const method of ["3-style", "m2-op"] as const) {
    const { frames, steps } = memoPreview(pattern, options, sequences, method);
    expect(steps).toHaveLength(method === "3-style" ? shots / 2 : shots + 1);
    const parity = method === "3-style" ? steps.at(-1) : steps[sequences.EDGES.length];
    expect(parity?.label).toContain("パリティ");
    expect(steps[0].algorithm).toEqual(method === "3-style" ? undefined : expect.any(String));
    for (let index = 1; index < frames.length; index++) {
      const previous = frames[index - 1];
      const frame = frames[index];
      const colorEntries = (item: typeof frame) => ({
        ...Object.fromEntries(Object.entries(item.colors).flatMap(([orbit, stickers]) =>
          Object.entries(stickers).map(([letter, color]) => [`${orbit}-${letter}`, color]))),
        ...Object.fromEntries(FACES.map((face, index) => [`CENTER-${face}`, item.centers[index]])),
      });
      const before = colorEntries(previous);
      const expected = { ...before };
      for (const { from, to } of frame.transfers) expected[to] = before[from];
      expect(colorEntries(frame)).toEqual(expected);
    }
    expect(frames.at(-1)!.centers).toEqual(FACES);
    for (const colors of Object.values(frames.at(-1)!.colors))
      expect(Object.values(colors)).toEqual(FACES.flatMap((face) => Array(4).fill(face)));
  }
});

it("generates a commutator that cycles the selected oriented stickers and preserves every other piece", async () => {
  const { cube3x3x3 } = await import("cubing/puzzles");
  const cube = await cube3x3x3.kpuzzle();
  for (const [orbit, chosen] of [
    ["EDGES", ["A", "N", "K"]],
    ["EDGES", ["W", "H", "J"]],
    ["CORNERS", ["E", "K", "W"]],
    ["CORNERS", ["X", "C", "F"]],
  ] as const) {
    const targets = chosen.map((letter) => speffzSticker(orbit, letter));
    const { alg } = await generateCommutator(orbit, [...chosen]);
    const data = cube.algToTransformation(alg).transformationData;
    const size = orbit === "EDGES" ? 2 : 3;
    for (const [index, target] of targets.entries()) {
      const next = targets[(index + 1) % 3];
      expect(data[orbit].permutation[next.piece]).toBe(target.piece);
      expect((next.sticker + data[orbit].orientationDelta[next.piece]) % size).toBe(target.sticker);
    }
    for (const [kind, orbitData] of Object.entries(data)) {
      orbitData.permutation.forEach((piece, index) => {
        if (kind !== orbit || !targets.some((target) => target.piece === index)) {
          expect(piece).toBe(index);
          if (kind !== "CENTERS") expect(orbitData.orientationDelta[index]).toBe(0);
        }
      });
    }
  }
  await expect(generateCommutator("EDGES", ["A", "Q", "C"])).rejects.toThrow("異なる3つ");
});
