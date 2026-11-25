import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { visibleFaces, type Point } from "../../lib/cubeVideoTracking";

export const calibrationCorners = ["上奥", "右上", "右下", "中央下", "左下", "左上", "3面が合わさる角"];
export const calibrationDiagram = [[.5, .06], [.92, .30], [.92, .72], [.5, .96], [.08, .72], [.08, .30], [.5, .56]]
  .map(([x, y]) => ({ x, y }));

export function GuideLines({ points, numbered = false }: { points: Point[]; numbered?: boolean }) {
  return (
    <svg className={numbered ? "video-guide-diagram" : "video-guide-lines"} viewBox="0 0 100 100" preserveAspectRatio={numbered ? "xMidYMid meet" : "none"} aria-hidden="true">
      {visibleFaces.map((face, index) => (
        face.every((corner) => points[corner]) && <polygon key={index} points={face.map((corner) => `${points[corner].x * 100},${points[corner].y * 100}`).join(" ")} />
      ))}
      {numbered && points.map(({ x, y }, index) => <text key={index} x={x * 100} y={y * 100}>{index + 1}</text>)}
    </svg>
  );
}

export function CubeGuide({ points, active, onPoint }: { points: Point[]; active: boolean; onPoint: (point: Point) => void }) {
  const [cursor, setCursor] = useState({ x: .5, y: .5 });
  const target = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (active) target.current?.focus(); }, [active]);
  const next = calibrationCorners[points.length];
  function moveCursor(event: KeyboardEvent<HTMLButtonElement>) {
    const shifts: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const shift = shifts[event.key];
    if (!shift) return;
    event.preventDefault();
    const step = event.shiftKey ? .002 : .015;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    setCursor({ x: clamp(cursor.x + shift[0] * step), y: clamp(cursor.y + shift[1] * step) });
  }
  return (
    <div className="video-guide">
      <GuideLines points={points} />
      {points.map(({ x, y }, index) => <span className="video-guide-point" key={index} style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>{index + 1}</span>)}
      {active && (
        <button
          ref={target} className="video-guide-target" aria-label={`${next}を指定。矢印キーで移動し、Enterで決定`}
          onKeyDown={moveCursor}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const point = event.detail === 0 ? cursor : {
              x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height,
            };
            setCursor(point);
            onPoint(point);
          }}
        ><span className="video-guide-cursor" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}>+</span></button>
      )}
    </div>
  );
}
