import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { ArrowLeft, RotateCcw, Shuffle } from "lucide-react";
import { cube3x3x3 } from "cubing/puzzles";
import { randomScrambleForEvent } from "cubing/scramble";
import { TwistyPlayer } from "cubing/twisty";
import { cubeKeyRows, keyboardCubeMove, viewedCubeMove, pickCubeFace, swipeCubeMove, type CubeCamera, type CubeHit } from "../lib/virtualCube";
import "./VirtualCube.css";

type CubeControls = {
  turn: (move: string) => void;
  setPosition: (scramble: string) => void;
  player: TwistyPlayer;
  camera: CubeCamera;
  canvas: HTMLCanvasElement;
};
type Gesture = {
  id: number;
  x: number;
  y: number;
  hit?: CubeHit;
  latitude: number;
  longitude: number;
};

const initialView = { latitude: 35, longitude: 30 };
// The first row puts the index-finger U flick and the common R/F turns
// nearest the thumbs. Each hand gets the complementary turn directions.
const pads = [
  [
    ["R'", "F'", "U'"], ["L", "B'", "D"],
    ["Lw", "Fw'", "Uw'"], ["Rw'", "Bw'", "Dw"],
    ["M'", "E", "S'"], ["x'", "y'", "z'"],
  ],
  [
    ["U", "F", "R"], ["D'", "B", "L'"],
    ["Uw", "Fw", "Rw"], ["Dw'", "Bw", "Lw'"],
    ["M", "E'", "S"], ["x", "y", "z"],
  ],
];

export function VirtualCube({ backURL, onBack }: {
  backURL: string;
  onBack: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<CubeControls>(null);
  const gesture = useRef<Gesture>(null);
  const view = useRef(initialView);
  const wide = useRef({ left: false, right: false });
  const [wideLayers, setWideLayers] = useState(wide.current);
  const [ready, setReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scramble, setScramble] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const player = new TwistyPlayer({
      puzzle: "3x3x3", visualization: "3D", background: "none",
      controlPanel: "none", viewerLink: "none", hintFacelets: "none",
      experimentalDragInput: "none", experimentalSetupAnchor: "start",
      cameraLatitude: initialView.latitude, cameraLongitude: initialView.longitude,
      tempoScale: 7,
    });
    host.current?.replaceChildren(player);
    let active = true;
    let stopListening: (() => void) | undefined;

    void (async () => {
      try {
        const [puzzle] = await Promise.all([
          cube3x3x3.kpuzzle(), player.experimentalCurrentThreeJSPuzzleObject(),
        ]);
        const [vantage] = await player.experimentalCurrentVantages();
        if (!vantage) throw Error("3D キューブを読み込めませんでした。");
        const [camera, { canvas }] = await Promise.all([vantage.camera(), vantage.canvasInfo()]);
        if (!active) return;
        const { setupTransformation, detailedTimelineInfo } = player.experimentalModel;
        const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
        let position = puzzle.identityTransformation();
        let pending: string[] = [];
        let turning: string | undefined;
        let revision = 0;

        function animateNext() {
          const move = pending.shift();
          if (!move) return;
          turning = move;
          const turnRevision = ++revision;
          setupTransformation.set(position);
          player.alg = move;
          player.timestamp = "start";
          void detailedTimelineInfo.get().then(() => {
            if (active && revision === turnRevision) player.play();
          });
        }

        function finish(timeline: { atEnd: boolean; atStart: boolean }) {
          if (!turning || !timeline.atEnd || timeline.atStart || !active) return;
          position = position.applyMove(turning);
          turning = undefined;
          animateNext();
        }
        detailedTimelineInfo.addFreshListener(finish);
        stopListening = () => detailedTimelineInfo.removeFreshListener(finish);
        controls.current = {
          player, camera, canvas,
          turn(move) {
            if (reduceMotion.matches && !turning) {
              position = position.applyMove(move);
              setupTransformation.set(position);
              player.alg = "";
              return;
            }
            pending.push(move);
            if (!turning) animateNext();
          },
          setPosition(sequence) {
            revision++;
            pending = [];
            turning = undefined;
            player.pause();
            position = puzzle.algToTransformation(sequence);
            setupTransformation.set(position);
            player.alg = "";
            player.timestamp = "start";
          },
        };
        setReady(true);
      } catch {
        if (active) setError("3D キューブを読み込めませんでした。");
      }
    })();
    return () => {
      active = false;
      stopListening?.();
      controls.current = null;
      gesture.current = null;
      player.pause();
      player.remove();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!controls.current || generating || event.defaultPrevented || event.repeat || event.isComposing ||
          event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
          document.querySelector("dialog[open], :popover-open")) return;
      if (event.target instanceof HTMLElement &&
          (event.target.isContentEditable || event.target.closest("input, textarea, select") ||
           (event.code === "Space" && event.target.closest("button, summary")))) return;

      const { left, right } = wide.current;
      const move = keyboardCubeMove(event.code, left, right);
      if (move) {
        event.preventDefault();
        controls.current.turn(viewedCubeMove(move, view.current.latitude, view.current.longitude));
        return;
      }
      switch (event.code) {
        case "Digit3": wide.current = { left: false, right }; break;
        case "Digit4": wide.current = { left: true, right }; break;
        case "Digit7": wide.current = { left, right: true }; break;
        case "Digit8": wide.current = { left, right: false }; break;
        case "Space": wide.current = { left: false, right: false }; break;
        default: return;
      }
      event.preventDefault();
      setWideLayers(wide.current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generating]);

  async function scrambleCube() {
    if (!controls.current || generating) return;
    const cube = controls.current;
    setGenerating(true);
    setError("");
    try {
      const sequence = (await randomScrambleForEvent("333")).toString();
      if (controls.current !== cube) return;
      cube.setPosition(sequence);
      setScramble(sequence);
    } catch {
      if (controls.current === cube) setError("スクランブルを作成できませんでした。");
    } finally {
      if (controls.current === cube) setGenerating(false);
    }
  }

  function startSwipe(event: PointerEvent<HTMLDivElement>) {
    const cube = controls.current;
    if (!cube || generating || !event.isPrimary || event.button !== 0) return;
    const point = { x: event.clientX, y: event.clientY };
    const bounds = cube.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const hit = event.shiftKey ? undefined : pickCubeFace(cube.camera, bounds, point);
    gesture.current = { id: event.pointerId, ...point, hit, ...view.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function changeView(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    const cube = controls.current;
    if (!drag || drag.id !== event.pointerId || drag.hit || !cube) return;
    const latitude = Math.max(-85, Math.min(85, drag.latitude + (event.clientY - drag.y) * 0.45));
    const longitude = drag.longitude - (event.clientX - drag.x) * 0.45;
    view.current = { latitude, longitude };
    cube.player.cameraLatitude = latitude;
    cube.player.cameraLongitude = longitude;
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    gesture.current = null;
    const cube = controls.current;
    if (!cube || !drag.hit || generating) return;
    const move = swipeCubeMove(cube.camera, cube.canvas.getBoundingClientRect(), drag.hit, drag,
      { x: event.clientX, y: event.clientY });
    if (move) cube.turn(move);
  }

  const disabled = !ready || generating;
  return (
    <main className="page-content virtual-cube-page" id="main-content" tabIndex={-1}>
      <div className="virtual-cube-tool">
        <header className="virtual-cube-heading">
          <div>
            <a className="action-link virtual-cube-back" href={backURL} onClick={onBack}><ArrowLeft size={16} />ツール</a>
            <h1>バーチャルキューブ</h1>
          </div>
          <div className="virtual-cube-actions">
            <button type="button" disabled={disabled} onClick={() => void scrambleCube()}>
              <Shuffle size={16} aria-hidden="true" />{generating ? "生成中…" : "スクランブル"}
            </button>
            <button type="button" disabled={disabled} onClick={() => {
              controls.current?.setPosition("");
              setScramble("");
              setError("");
            }}>
              <RotateCcw size={16} aria-hidden="true" />リセット
            </button>
          </div>
        </header>
        {scramble && <p className="virtual-cube-scramble"><code translate="no">{scramble}</code></p>}
        {error && <p role="alert">{error}</p>}
        <div className="virtual-cube-board">
          <div className="virtual-cube-stage">
            <div ref={host} className="virtual-cube-player" role="group" tabIndex={0} aria-label="操作できる3Dキューブ"
              onPointerDown={startSwipe} onPointerMove={changeView} onPointerUp={finishSwipe}
              onLostPointerCapture={() => { gesture.current = null; }} />
            {!ready && !error && <p className="virtual-cube-loading" role="status">読み込み中…</p>}
          </div>
          {pads.map((rows, index) => (
            <div key={rows[0][0]} className={`virtual-cube-pad ${index === 0 ? "pad-left" : "pad-right"}`}
              role="group" aria-label={index === 0 ? "左手の回転ボタン" : "右手の回転ボタン"}>
              {rows.flatMap((row, rowIndex) => row.map((move) => (
                <button key={move} type="button" disabled={disabled}
                  className={rowIndex === 0 ? "virtual-cube-primary-turn" : undefined}
                  onClick={() => controls.current?.turn(viewedCubeMove(move, view.current.latitude, view.current.longitude))}>
                  {move.replace("'", "′")}
                </button>
              )))}
            </div>
          ))}
        </div>
        <p className="virtual-cube-gesture muted">ステッカーをスワイプすると層が回ります。背景をドラッグすると視点が変わり、キーとボタンもその向きに対応します。</p>
        <details className="virtual-cube-keyboard">
          <summary>csTimer のキー配置</summary>
          <p className="muted">3 / 4 で左手側、7 / 8 で右手側の回転幅を変更し、Space で戻します。</p>
          <p className="muted">回転幅　左 {wideLayers.left ? 2 : 1} 層／右 {wideLayers.right ? 2 : 1} 層</p>
          <dl>
            {cubeKeyRows.map(([move, first, second]) => (
              <div key={move}><dt>{move}</dt><dd>{first} / {second}</dd></div>
            ))}
          </dl>
        </details>
      </div>
    </main>
  );
}
