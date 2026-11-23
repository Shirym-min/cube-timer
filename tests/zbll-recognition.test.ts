import { Alg } from "cubing/alg";
import { expect, it } from "vitest";
import library from "../src/data/algorithm-library.json";
import { recallFaces } from "../src/lib/recallFaces";
import { harrisBaumCodes, harrisBaumRecognition } from "../src/lib/zbllRecognition";

it("uses all twelve Harris/Baum codes and distinguishes cases within each COLL group", async () => {
  const allCodes = new Set();
  const codesByColl = new Map<string, Set<string>>();
  for (const entry of library.ZBLL) {
    const alg = new Alg(entry.variants[0].setup).invert().toString();
    const faces = await recallFaces(alg, "yellow");
    const recognition = harrisBaumRecognition(faces);
    expect(harrisBaumRecognition(await recallFaces(alg, "yellow", "U")).code, entry.name).toBe(recognition.code);
    expect(new Set(recognition.stickers).size, entry.name).toBe(4);
    const usesTopSticker = recognition.stickers.some((sticker) => sticker.startsWith("U"));
    expect(usesTopSticker, entry.name).toBe(entry.group === "H" || entry.group === "Pi");

    const coll = entry.name.split(" ")[1];
    const codes = codesByColl.get(coll) ?? new Set();
    expect(recognition.code, entry.name).not.toBeNull();
    expect(codes.has(recognition.code!), entry.name).toBe(false);
    codes.add(recognition.code!);
    codesByColl.set(coll, codes);
    allCodes.add(recognition.code);
  }
  expect(allCodes).toEqual(new Set(harrisBaumCodes));
});

it("compares the marked stickers across the corner for the four x codes", async () => {
  const candidates = await Promise.all(library.ZBLL.slice(0, 12).map(async ({ variants }) => {
    const faces = await recallFaces(new Alg(variants[0].setup).invert().toString(), "yellow");
    return { faces, ...harrisBaumRecognition(faces) };
  }));
  for (const code of ["CxC", "CxO", "OxC", "OxO"]) {
    const found = candidates.find((candidate) => candidate.code === code);
    expect(found, code).toBeDefined();
    const color = (sticker: string) => found!.faces[sticker[0] as keyof typeof found.faces][Number(sticker[1])];
    const [first, second, third, fourth] = found!.stickers.map(color);
    expect(first === third).toBe(code[0] === "C");
    expect(second === fourth).toBe(code[2] === "C");
  }
});

it("leaves out the code for an alternative setup outside ZBLL", async () => {
  const entry = library.ZBLL.find(({ name }) => name === "ZBLL T3 8")!;
  const faces = await recallFaces(new Alg(entry.variants[1].setup).invert().toString(), "yellow");
  expect(harrisBaumRecognition(faces)).toEqual({ code: null, stickers: [] });
});
