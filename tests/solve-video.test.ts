import { describe, expect, it } from "vitest";
import { Alg } from "cubing/alg";
import { puzzles } from "cubing/puzzles";
import facelets from "../src/data/facelets.json";
import { createCubeTracker, stickerPoints, type RGB } from "../src/lib/cubeVideoTracking";
import { pauseCandidates, reconstructSolve, splitTimes } from "../src/lib/solveVideo";

const palette: Record<string, RGB> = {
  white: [245, 245, 245], orange: [248, 117, 20], limegreen: [27, 162, 65],
  red: [213, 20, 35], "#26f": [26, 92, 215], yellow: [240, 224, 34],
};

describe("solve video", () => {
  it("times CFOP milestones even when later algorithms temporarily break earlier layers", async () => {
    const moves = "D R U R' F R U R' U' F' U".split(" ");
    const scramble = new Alg(moves.join(" ")).invert().toString();
    const cube = await puzzles["3x3x3"].kpuzzle();
    let pattern = cube.defaultPattern().applyAlg(scramble);
    const tracker = await createCubeTracker(scramble, 5);
    const stickers = Object.entries(facelets).filter(([key, { x, y }]) => (
      (y < 3 || y <= 5.31 && y >= 3.29) && x >= 3.29 && x <= 8.51
      && (!key.startsWith("CENTERS") || key.endsWith("o0"))
    )).sort(([, a], [, b]) => {
      const face = ({ x, y }: { x: number; y: number }) => y < 3 ? 0 : x < 6 ? 1 : 2;
      return face(a) - face(b) || a.y - b.y || a.x - b.x;
    });
    function observe(at: number) {
      const colors = stickers.map(([key]) => {
        const [, orbit, position, orientation] = key.match(/^(\w+)-l(\d+)-o(\d+)$/)!;
        const { pieces, orientation: orientations } = pattern.patternData[orbit];
        const size = orbit === "EDGES" ? 2 : orbit === "CORNERS" ? 3 : 1;
        const spin = (Number(orientation) + size - orientations[Number(position)] % size) % size;
        const sticker = facelets[`${orbit}-l${pieces[Number(position)]}-o${spin}` as keyof typeof facelets];
        return palette[sticker.color];
      });
      expect(colors).toHaveLength(27);
      tracker.observe(at, colors);
      tracker.observe(at + .01, colors);
    }
    observe(0);
    moves.forEach((move, index) => {
      pattern = pattern.applyMove(move);
      observe(index + 1);
    });
    const result = tracker.result();
    expect(result?.notation).toBe(moves.join(" "));
    expect(result?.marks).toEqual([0, 1, 4, 10, 11]);
    expect(splitTimes(result!.marks, 4)).toEqual([.25, .75, 1.5, .25]);

    const partial = await createCubeTracker(scramble, 5);
    partial.observe(0, Array(27).fill(null));
    expect(partial.result()).toBeNull();
  });

  it("samples face interiors and rejects a calibration with crossed corners", () => {
    const points = [[.5,.1], [.9,.3], [.9,.7], [.5,.9], [.1,.7], [.1,.3], [.5,.5]]
      .map(([x, y]) => ({ x, y }));
    expect(stickerPoints(points)).toHaveLength(27);
    [points[0], points[1]] = [points[1], points[0]];
    expect(stickerPoints(points)).toBeNull();
  });

  it("uses actual time and excludes unreadable stretches from pause lengths", () => {
    expect(pauseCandidates([
      { time: 0, change: null }, { time: .4, change: 0 }, { time: .8, change: 0 },
      { time: 5, change: null }, { time: 5.8, change: .01 }, { time: 6, change: .5 },
      { time: 6.5, change: 0 },
    ], 4, .03, .19)).toEqual([{ start: 0, end: .8 }, { start: 5, end: 5.8 }]);
  });

  it("checks a manual reconstruction independently of the camera", async () => {
    expect((await reconstructSolve("R U2", "U2 R’ y")).solved).toBe(true);
    expect((await reconstructSolve("R U2", "R’")).solved).toBe(false);
    await expect(reconstructSolve("R foo", "R'")).rejects.toThrow("初期スクランブル");
  });
});
