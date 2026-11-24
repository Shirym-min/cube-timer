import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { FACES, ORBITS, cubeNetCells, speffzSticker, type CubeFace, type MemoFrame, type Orbit } from "../lib/bld";

const colors = { U: "#f4f4f5", L: "#ff9b52", F: "#77d6a3", R: "#ff8585", B: "#89baff", D: "#ffdd70" };
const cubeViews = { net: "展開図", "3d": "3D" } as const;
export type CubeView = keyof typeof cubeViews;

export function BldCubeViewToggle<View extends CubeView | "list">({ view, onChange, views, disabled }: {
  view: View;
  onChange: (view: View) => void;
  views: readonly View[];
  disabled?: boolean;
}) {
  const labels = { list: "一覧", ...cubeViews };
  return <div className="segmented" role="group" aria-label="表示形式">
    {views.map((item) => <button key={item} type="button" disabled={disabled} aria-pressed={view === item}
      className={view === item ? "selected" : ""} onClick={() => onChange(item)}>{labels[item]}</button>)}
  </div>;
}

export function BldCubeNet({ orbit, frame, selection = [], onSelect, disabled, view = "net", buffer }: {
  orbit?: Orbit;
  frame?: MemoFrame;
  selection?: string[];
  onSelect?: (letter: string) => void;
  disabled?: (letter: string) => boolean;
  view?: CubeView;
  buffer?: string;
}) {
  const initial = { pitch: -24, yaw: -32 };
  const [angle, setAngle] = useState(initial);
  const drag = useRef<{ id: number; x: number; y: number; pitch: number; yaw: number; moved: boolean }>(null);
  const skipClick = useRef(false);
  const constrainPitch = (pitch: number) => Math.max(-90, Math.min(90, pitch));

  function rotate(event: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 7) return;
    if (!gesture.moved) event.currentTarget.setPointerCapture(event.pointerId);
    gesture.moved = true;
    setAngle({ pitch: constrainPitch(gesture.pitch - dy * 0.65), yaw: gesture.yaw + dx * 0.65 });
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    skipClick.current = drag.current.moved;
    drag.current = null;
  }

  const pitch = angle.pitch * Math.PI / 180;
  const yaw = angle.yaw * Math.PI / 180;
  const visible = {
    F: Math.cos(pitch) * Math.cos(yaw), B: -Math.cos(pitch) * Math.cos(yaw),
    U: -Math.sin(pitch), D: Math.sin(pitch),
    R: -Math.cos(pitch) * Math.sin(yaw), L: Math.cos(pitch) * Math.sin(yaw),
  };
  const faces = FACES.map((face, faceIndex) => (
    <div key={face} className={`bld-face bld-face-${face}`} role="group" aria-label={`${face} 面`}
      data-face={face} inert={view === "3d" && visible[face] < 0.04}>
      {Array.from({ length: 9 }, (_, cell) => {
        const stickerOrbit = ORBITS.find((item) => cubeNetCells[item][cell] >= 0);
        const letter = stickerOrbit ? String.fromCharCode(65 + faceIndex * 4 + cubeNetCells[stickerOrbit][cell]) : "";
        const visibleLetter = stickerOrbit && (!orbit || orbit === stickerOrbit) ? letter : "";
        const color: CubeFace = stickerOrbit ? frame?.colors[stickerOrbit][letter] ?? face : frame?.centers[faceIndex] ?? face;
        const style = { "--sticker-color": colors[color] } as CSSProperties;
        const order = selection.indexOf(letter);
        const isBuffer = !!visibleLetter && buffer === letter;
        if (visibleLetter && onSelect && stickerOrbit) {
          const position = speffzSticker(stickerOrbit, letter).position;
          return <button key={cell} type="button" style={style} className={isBuffer ? "bld-buffer" : undefined}
            aria-label={`${letter}（${position}）`} aria-pressed={order >= 0}
            disabled={disabled?.(letter)} onClick={() => onSelect(letter)}>{visibleLetter}{order >= 0 && <sup>{order + 1}</sup>}</button>;
        }
        return <span key={cell} style={style} className={isBuffer || (visibleLetter && order >= 0) ? "bld-buffer" : undefined}
          data-sticker={stickerOrbit ? `${stickerOrbit}-${letter}` : `CENTER-${face}`}>{cell === 4 ? face : visibleLetter}</span>;
      })}
    </div>
  ));
  const label = frame ? "キューブの状態" : "Speffz の文字配置";
  if (view === "net") return <div className="bld-net" translate="no" aria-label={label}>{faces}</div>;
  return <div className="bld-cube-view">
    <div className="bld-cube-scene" role="group" tabIndex={0} translate="no"
      aria-label={`${label}。ドラッグまたは矢印キーで回転`}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        skipClick.current = false;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, ...angle };
      }}
      onPointerMove={rotate} onPointerUp={endDrag} onPointerCancel={endDrag}
      onPointerLeave={(event) => { if (!drag.current?.moved) endDrag(event); }}
      onClickCapture={(event) => {
        if (event.detail > 0 && skipClick.current) {
          skipClick.current = false;
          event.stopPropagation();
        }
      }}
      onKeyDown={(event) => {
        const dx = event.key === "ArrowLeft" ? -30 : event.key === "ArrowRight" ? 30 : 0;
        const dy = event.key === "ArrowUp" ? 30 : event.key === "ArrowDown" ? -30 : 0;
        if (!dx && !dy) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        setAngle((current) => ({ yaw: current.yaw + dx, pitch: constrainPitch(current.pitch + dy) }));
      }}>
      <div className="bld-cube-body" style={{ transform: `rotateX(${angle.pitch}deg) rotateY(${angle.yaw}deg)` }}>{faces}</div>
    </div>
    <button className="text-button bld-cube-reset" type="button" onClick={() => setAngle(initial)}>向きを戻す</button>
  </div>;
}
