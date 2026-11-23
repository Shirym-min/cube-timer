import { expect, it } from "vitest";
import { recallFaces, topColors, upperSlotPair } from "../src/lib/recallFaces";
it("maps each chosen upper color while preserving a consistent cube color scheme", async () => {
  const expected = ["white", "yellow", "limegreen", "#26f", "orange", "red"];
  for (let i = 0; i < topColors.length; i++) {
    const f = await recallFaces("", topColors[i][0]);
    expect(f.U).toEqual(Array(9).fill(expected[i]));
    expect(new Set([f.U[4], f.F[4], f.R[4], f.B[4], f.L[4]]).size).toBe(5);
  }
});
it("keeps last-layer patterns on top with all F2L facelets solved for PLL", async () => {
  const f = await recallFaces("R U R' U' R' F R2 U' R' U' R U R' F'", "yellow");
  expect(f.U.every((x) => x === "yellow")).toBe(true);
  for (const side of ["F", "R", "B", "L"] as const)
    expect(f[side].slice(3).every((x) => x === f[side][4])).toBe(true);
});

it("applies AUF to the case and preserves the same sticker counts", async () => {
  const alg = "R U R' U' R' F R2 U' R' U' R U R' F'";
  const original = await recallFaces(alg, "yellow");
  const adjusted = await recallFaces(alg, "yellow", "U");
  expect(adjusted.F.slice(0, 3)).not.toEqual(original.F.slice(0, 3));
  expect([...adjusted.U].sort()).toEqual([...original.U].sort());
});

it("distinguishes the last-slot pair from a top-color corner with the same side colors", async () => {
  const solved = await recallFaces("", "yellow");
  expect(upperSlotPair(solved).has(8)).toBe(false);

  const extracted = await recallFaces("R U R'", "yellow");
  expect(upperSlotPair(extracted).size).toBeGreaterThan(0);
});
