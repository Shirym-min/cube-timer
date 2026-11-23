import type { RecallFaces } from "./recallFaces";

export const harrisBaumCodes = [
  "C/C", "C/A", "C/O", "A/C", "A/O", "O/C", "O/A", "O/O",
  "CxC", "CxO", "OxC", "OxO",
] as const;
export type HarrisBaumCode = (typeof harrisBaumCodes)[number];

const sides = ["F", "R", "B", "L"] as const;
const upperCorners = [8, 2, 0, 6];

export function harrisBaumRecognition(faces: RecallFaces): { code: HarrisBaumCode | null; stickers: string[] } {
  const top = faces.U[4];
  const edgesOriented = [1, 3, 5, 7].every((index) => faces.U[index] === top);
  const firstTwoLayersSolved = sides.every((side) =>
    faces[side].slice(3).every((color) => color === faces[side][4]),
  );
  if (!edgesOriented || !firstTwoLayersSolved) return { code: null, stickers: [] };
  const opposite = new Map(
    sides.map((side, index) => [faces[side][4], faces[sides[(index + 2) % 4]][4]]),
  );
  const corners = sides.map((front, index) => [
    faces.U[upperCorners[index]],
    faces[front][2],
    faces[sides[(index + 1) % 4]][0],
  ]);
  const relation = (a: string, b: string) => a === b ? "C" : opposite.get(a) === b ? "O" : "A";

  const angles = sides.map((front, index) => {
    const right = sides[(index + 1) % 4];
    const [up, frontSticker, rightSticker] = corners[index];
    // When the reference corner is twisted, use its upper sticker in place of
    // the top-color sticker on the side (including H and Pi).
    const frontColor = frontSticker === top ? up : frontSticker;
    const rightColor = rightSticker === top ? up : rightSticker;
    const frontEdge = faces[front][1];
    const rightEdge = faces[right][1];
    const first = relation(frontEdge, frontColor);
    const second = relation(rightColor, rightEdge);
    const code = (first === "A" && second === "A"
      ? `${relation(frontEdge, rightColor)}x${relation(frontColor, rightEdge)}`
      : `${first}/${second}`) as HarrisBaumCode;

    const colorOrder = [top, frontColor, rightColor, opposite.get(frontColor), opposite.get(rightColor)];
    const rotatedCorners = corners.slice(index).concat(corners.slice(0, index));
    // Choose a recognition angle from CO and CP before looking at edge colors.
    // This prefers an oriented reference corner wherever one exists.
    const orientation = rotatedCorners.map((corner) => corner.indexOf(top)).join("");
    const permutation = rotatedCorners.flat().map((color) => colorOrder.indexOf(color)).join("");
    return {
      orientation,
      permutation,
      code,
      stickers: [
        `${front}1`,
        frontSticker === top ? `U${upperCorners[index]}` : `${front}2`,
        rightSticker === top ? `U${upperCorners[index]}` : `${right}0`,
        `${right}1`,
      ],
    };
  });
  angles.sort((a, b) =>
    a.orientation.localeCompare(b.orientation) ||
    a.permutation.localeCompare(b.permutation) ||
    // Only symmetric corner patterns can leave multiple equivalent angles.
    harrisBaumCodes.indexOf(a.code) - harrisBaumCodes.indexOf(b.code),
  );
  const { code, stickers } = angles[0];
  return harrisBaumCodes.includes(code) ? { code, stickers } : { code: null, stickers: [] };
}

export function harrisBaumStickers(faces: RecallFaces) {
  return harrisBaumRecognition(faces).stickers;
}
