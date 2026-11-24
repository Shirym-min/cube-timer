import type { CSSProperties } from "react";
import { FACES, ORBITS, cubeNetCells, speffzSticker, type CubeFace, type MemoFrame, type Orbit } from "../lib/bld";

const colors = { U: "#f4f4f5", L: "#ff9b52", F: "#77d6a3", R: "#ff8585", B: "#89baff", D: "#ffdd70" };

export function BldCubeNet({ orbit, frame, selection = [], onSelect, disabled }: {
  orbit?: Orbit;
  frame?: MemoFrame;
  selection?: string[];
  onSelect?: (letter: string) => void;
  disabled?: (letter: string) => boolean;
}) {
  return (
    <div className="bld-net" translate="no" aria-label={frame ? "キューブの状態" : "Speffz の文字配置"}>
      {FACES.map((face, faceIndex) => (
        <div key={face} className={`bld-face bld-face-${face}`} role="group" aria-label={`${face} 面`}>
          {Array.from({ length: 9 }, (_, cell) => {
            const stickerOrbit = ORBITS.find((item) => cubeNetCells[item][cell] >= 0);
            const letter = stickerOrbit ? String.fromCharCode(65 + faceIndex * 4 + cubeNetCells[stickerOrbit][cell]) : "";
            const visibleLetter = stickerOrbit && (!orbit || orbit === stickerOrbit) ? letter : "";
            const color: CubeFace = stickerOrbit ? frame?.colors[stickerOrbit][letter] ?? face : face;
            const style = { "--sticker-color": colors[color] } as CSSProperties;
            const order = selection.indexOf(letter);
            if (visibleLetter && onSelect && stickerOrbit) {
              const position = speffzSticker(stickerOrbit, letter).position;
              return <button key={cell} type="button" style={style}
                aria-label={`${letter}（${position}）`} aria-pressed={order >= 0}
                disabled={disabled?.(letter)} onClick={() => onSelect(letter)}>{visibleLetter}{order >= 0 && <sup>{order + 1}</sup>}</button>;
            }
            return <span key={cell} style={style} className={visibleLetter && order >= 0 ? "bld-buffer" : undefined}
              data-sticker={stickerOrbit ? `${stickerOrbit}-${letter}` : undefined}>{cell === 4 ? face : visibleLetter}</span>;
          })}
        </div>
      ))}
    </div>
  );
}
