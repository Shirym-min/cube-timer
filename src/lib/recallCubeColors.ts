import { cube3x3x3 } from "cubing/puzzles";
import type { TwistyPlayer } from "cubing/twisty";
import { topColors, type TopColor } from "./recallFaces";

export type CubeMaterial = {
  clone: () => CubeMaterial;
  color: { set: (value: number) => void };
  dispose: () => void;
};
type CubeObject = {
  kpuzzleFaceletInfo: Record<
    string,
    {
      faceIdx: number;
      facelet: { material: CubeMaterial };
      hintFacelet?: { material: CubeMaterial };
    }[][]
  >;
  scheduleRenderCallback: () => void;
};
export async function applyRecallCubeColors(
  player: TwistyPlayer,
  top: TopColor,
  active: () => boolean,
  cloned: CubeMaterial[],
) {
  const cube = await cube3x3x3.kpuzzle();
  const rotation = topColors.find((c) => c[0] === top)![2];
  const centers = cube.defaultPattern().applyAlg(rotation).patternData
    .CENTERS.pieces;
  const palette = [
    0xffffff, 0xff9900, 0x00ff00, 0xff0000, 0x2266ff, 0xffff00,
  ];
  const object =
    (await player.experimentalCurrentThreeJSPuzzleObject()) as unknown as CubeObject;
  if (!active()) return;
  for (const pieces of Object.values(object.kpuzzleFaceletInfo))
    for (const piece of pieces)
      for (const sticker of piece)
        for (const mesh of [sticker.facelet, sticker.hintFacelet])
          if (mesh) {
            const material = mesh.material.clone();
            material.color.set(palette[centers[sticker.faceIdx]]);
            mesh.material = material;
            cloned.push(material);
          }
  object.scheduleRenderCallback();
}
