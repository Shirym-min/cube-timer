import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, Film, Pause, Play, SkipBack, SkipForward, Undo2 } from "lucide-react";
import { TwistyPlayer } from "cubing/twisty";
import { scanVideoMotion } from "../lib/scanVideoMotion";
import {
  CAPTURE_FPS, checkScramble, pauseCandidates, reconstructSolve, regionBounds,
  splitTimes, stages, type Interval, type Region, type Sample,
} from "../lib/solveVideo";
import {
  createCubeTracker, cubeColors, stickerPoints, visibleFaces, type Point,
} from "../lib/cubeVideoTracking";
import { formatTime } from "../lib/model";
import "./SolveVideo.css";

const initialRegion = { x: 50, y: 50, size: 80 };
const corners = ["上奥", "右上", "右下", "中央下", "左下", "左上", "3面が合わさる角"];
const diagram = [[.5, .06], [.92, .30], [.92, .72], [.5, .96], [.08, .72], [.08, .30], [.5, .56]]
  .map(([x, y]) => ({ x, y }));
const time = (seconds: number | null) => formatTime(seconds === null ? null : Math.round(seconds * 1000));
type Trace = ReturnType<Awaited<ReturnType<typeof createCubeTracker>>["result"]>;
type Reconstruction = Awaited<ReturnType<typeof reconstructSolve>>;

export function SolveVideo({ onBack }: { onBack: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [clip, setClip] = useState<{ name: string; url: string } | null>(null);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  return (
    <main id="main-content" tabIndex={-1} className="page-content video-analysis">
      <header className="video-header">
        <div>
          <button className="video-back" onClick={onBack}><ArrowLeft size={15} /> 練習</button>
          <h1>動画解析</h1>
        </div>
        <input
          hidden ref={fileInput} type="file" accept="video/*,.mov,.mp4"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setClip({ name: file.name, url: URL.createObjectURL(file) });
            event.target.value = "";
          }}
        />
        {clip && <button onClick={() => fileInput.current?.click()}>動画を変更</button>}
      </header>
      {clip ? <VideoWorkspace key={clip.url} {...clip} /> : (
        <div className="video-empty">
          <Film size={34} strokeWidth={1.45} aria-hidden="true" />
          <button className="primary" onClick={() => fileInput.current?.click()}>動画を選ぶ</button>
          <p>3×3 のソルブ動画を端末内で解析します。</p>
        </div>
      )}
    </main>
  );
}

function VideoWorkspace({ name, url }: { name: string; url: string }) {
  const player = useRef<HTMLVideoElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const task = useRef<AbortController | null>(null);
  const [metadata, setMetadata] = useState({ duration: 0, ratio: 1 });
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [fileError, setFileError] = useState("");
  const [scramble, setScramble] = useState("");
  const [slowdown, setSlowdown] = useState(1);
  const [crossColor, setCrossColor] = useState(0);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [picking, setPicking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [region, setRegion] = useState<Region>(initialRegion);
  const [progress, setProgress] = useState<number | null>(null);
  const [scanError, setScanError] = useState("");
  const [result, setResult] = useState<{ trace: Trace; samples: Sample[] } | null>(null);
  const [sensitivity, setSensitivity] = useState(3);
  const [minimum, setMinimum] = useState(0.2);
  useEffect(() => () => task.current?.abort(), []);
  useEffect(() => { resultHeading.current?.focus(); }, [result]);

  const { duration, ratio } = metadata;
  const busy = progress !== null;
  const ready = duration > 0 && !fileError;
  const stickers = stickerPoints(points);
  const range = anchor !== null && (end ?? duration) > anchor ? { start: anchor, end: end ?? duration } : null;
  const marks = result?.trace?.marks ?? null;
  const finish = marks?.[4] ?? null;
  const total = marks && finish !== null ? (finish - marks[0]) / slowdown : null;
  const splits = marks ? splitTimes(marks, slowdown) : [];
  const pauseRange = range && { start: marks?.[0] ?? range.start, end: finish ?? range.end };
  const pauseSamples = result?.samples.filter(({ time }) => pauseRange && time >= pauseRange.start && time <= pauseRange.end);
  const candidates = pauseSamples ? pauseCandidates(pauseSamples, slowdown, sensitivity / 100, minimum) : [];
  const observed = pauseSamples?.reduce((sum, sample, index) =>
    index === 0 || sample.change === null ? sum : sum + sample.time - pauseSamples[index - 1].time, 0);
  const incomplete = pauseRange && observed !== undefined && (pauseRange.end - pauseRange.start - observed) / slowdown > 3 / CAPTURE_FPS;

  function clearResult() {
    setResult(null);
    setScanError("");
  }

  function seek(seconds: number) {
    const video = player.current;
    if (!video || !ready || busy || picking) return;
    video.pause();
    video.currentTime = Math.max(0, Math.min(duration, seconds));
    setPosition(video.currentTime);
  }

  function jump(seconds: number) {
    seek(seconds);
    player.current?.closest(".video-preview")?.scrollIntoView({ block: "nearest" });
  }

  function beginCalibration() {
    const video = player.current!;
    video.pause();
    setAnchor(video.currentTime);
    setPoints([]);
    setPicking(true);
    clearResult();
  }

  function addPoint(point: Point) {
    const next = [...points, point];
    if (next.length !== 7) {
      setPoints(next);
      return;
    }
    const samples = stickerPoints(next);
    if (!samples) {
      setScanError("3面の形を読み取れません。図の順番を確認して、点を指定し直してください。");
      return;
    }
    setScanError("");
    setPoints(next);
    setPicking(false);

    const xs = next.map(({ x }) => x * ratio), ys = next.map(({ y }) => y);
    const side = Math.min(ratio, 1);
    const size = Math.min(100, Math.max(20, Math.round(
      Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / side * 105
    )));
    const fitted = size / 100 * side;
    const offset = (values: number[], length: number) => length > fitted
      ? Math.max(0, Math.min(100, (Math.min(...values) + Math.max(...values) - fitted) / 2 / (length - fitted) * 100))
      : 50;
    setRegion({ x: offset(xs, ratio), y: offset(ys, 1), size });
  }

  async function analyze(selected: Interval) {
    const video = player.current;
    if (!video || task.current || !stickers) return;
    const controller = new AbortController();
    task.current = controller;
    setScanError("");
    setProgress(0);
    try {
      const { scramble: initial } = await checkScramble(scramble);
      const tracker = await createCubeTracker(initial, crossColor, slowdown / CAPTURE_FPS);
      if (controller.signal.aborted) return;
      const samples = await scanVideoMotion(
        video, selected, slowdown, region, controller.signal, setProgress, stickers,
        (time, pixels) => tracker.observe(time, pixels),
      );
      const trace = tracker.result();
      setResult({ samples, trace });
      if (trace?.marks[4] != null) setSettingsOpen(false);
    } catch (error) {
      if (!controller.signal.aborted) {
        setScanError(error instanceof Error ? error.message : "動画を解析できませんでした。");
      }
    } finally {
      task.current = null;
      if (video.isConnected) setProgress(null);
    }
  }

  return (
    <div className="video-workspace">
      <section className="video-panel video-preview" aria-label="ソルブ動画">
        <div className="video-file" title={name}><Film size={15} /> <span>{name}</span></div>
        <div className="video-screen">
          <div className="video-frame" style={{ width: `min(100%, ${ratio * 48}vh)` }}>
            <video
              ref={player} src={url} playsInline preload="auto" aria-label="ソルブ動画"
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                if (Number.isFinite(video.duration) && video.duration > 0 && video.videoHeight > 0) {
                  setMetadata({ duration: video.duration, ratio: video.videoWidth / video.videoHeight });
                } else setFileError("動画の長さを取得できませんでした。");
              }}
              onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
              onSeeking={() => setSeeking(true)}
              onSeeked={(event) => {
                setSeeking(false);
                setPosition(event.currentTarget.currentTime);
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={() => setFileError("動画を開けませんでした。このブラウザで再生できる MP4 などを選んでください。")}
            />
            {(picking || points.length > 0 && (position === anchor || busy)) && (
              <CubeGuide points={points} active={picking} onPoint={addPoint} />
            )}
          </div>
        </div>
        <div className="video-controls">
          <button type="button" aria-label={playing && !busy ? "一時停止" : "再生"} disabled={!ready || busy || picking} onClick={() => {
            const video = player.current!;
            if (!video.paused) video.pause();
            else void video.play().catch(() => setFileError("動画を再生できませんでした。"));
          }}>{playing && !busy ? <Pause size={17} /> : <Play size={17} />}</button>
          <button type="button" aria-label="前のコマ" disabled={!ready || busy || picking || position <= 0} onClick={() => seek(player.current!.currentTime - slowdown / CAPTURE_FPS)}><SkipBack size={17} /></button>
          <button type="button" aria-label="次のコマ" disabled={!ready || busy || picking || position >= duration} onClick={() => seek(player.current!.currentTime + slowdown / CAPTURE_FPS)}><SkipForward size={17} /></button>
          <span className="video-time" aria-label="動画内の時刻">{time(position)}</span>
          <input aria-label="動画の再生位置" type="range" min="0" max={duration || 1} step="any" value={position} disabled={!ready || busy || picking} onChange={(event) => seek(event.currentTarget.valueAsNumber)} />
        </div>
        {picking && (
          <div className="video-calibration">
            <GuideLines points={diagram} numbered />
            <div>
              <p role="status">{points.length + 1}. {corners[points.length]}を選択</p>
              {scanError && <p role="alert">{scanError}</p>}
              <div className="video-calibration-actions">
                <button disabled={!points.length} onClick={() => { setPoints(points.slice(0, -1)); setScanError(""); }}>
                  <Undo2 size={14} /> 1 点戻す
                </button>
                <button onClick={() => { setPicking(false); setPoints([]); setAnchor(null); setScanError(""); }}>中止</button>
              </div>
            </div>
          </div>
        )}
        {fileError && <p className="video-message" role="alert">{fileError}</p>}
        {!ready && !fileError && <p className="video-message" role="status">動画を読み込んでいます…</p>}
      </section>
      <div className="video-annotations">
        <section className="video-panel video-settings" aria-label="ソルブの設定">
          <details open={settingsOpen} onToggle={(event) => setSettingsOpen(event.currentTarget.open)}>
            <summary>解析設定</summary>
            <fieldset disabled={busy} className="video-panel-body video-setup">
              <label>初期スクランブル
                <textarea value={scramble} rows={2} spellCheck={false} placeholder="R U R' F2 …" onChange={(event) => {
                  setScramble(event.currentTarget.value);
                  clearResult();
                }} />
              </label>
              <div className="video-settings-row">
                <label>クロスの色
                  <select value={crossColor} onChange={(event) => { setCrossColor(Number(event.currentTarget.value)); clearResult(); }}>
                    {cubeColors.map((color, index) => <option key={color} value={index}>{color}</option>)}
                  </select>
                </label>
                <label>動画の時間倍率
                  <select value={slowdown} aria-describedby="video-multiplier-help" onChange={(event) => {
                    setSlowdown(Number(event.currentTarget.value));
                    clearResult();
                  }}>
                    <option value={1}>1倍（等速）</option>
                    <option value={2}>2倍</option>
                    <option value={4}>4倍</option>
                    <option value={8}>8倍</option>
                  </select>
                </label>
              </div>
              <p id="video-multiplier-help" className="muted">実際の1秒が動画で4秒なら4倍を選びます。</p>
              <div className="video-anchor">
                <p className="muted">最初の手を回す直前に止め、上・前・右の3面の角を指定してください。カメラが固定され、キューブの位置が大きく変わらない映像に対応します。</p>
                <button disabled={!ready || seeking || picking || position >= duration} onClick={beginCalibration}>{stickers ? "3面を指定し直す" : "動画で3面を指定"}</button>
                {stickers && anchor !== null && <button className="video-jump video-time" onClick={() => jump(anchor)} aria-label="解析の開始位置へ移動">{time(anchor)}</button>}
              </div>
              <details>
                <summary>解析の終了位置</summary>
                <p className="muted">スロー区間の途中で倍率が変わる場合は、その手前を指定してください。</p>
                <div className="video-calibration-actions">
                  <button disabled={!ready || picking || seeking || playing || anchor !== null && position <= anchor} onClick={() => {
                    setEnd(player.current!.currentTime);
                    clearResult();
                  }}>ここまで解析</button>
                  {end !== null && <>
                    <button className="video-jump video-time" onClick={() => jump(end)}>{time(end)}</button>
                    <button onClick={() => { setEnd(null); clearResult(); }}>解除</button>
                  </>}
                </div>
              </details>
            </fieldset>
            {!busy && (
              <div className="video-panel-body video-run">
                {scanError && !picking && <p role="alert">{scanError}</p>}
                {anchor !== null && end !== null && end <= anchor && <p role="alert">終了位置を開始位置より後に設定してください。</p>}
                <button className="primary" disabled={!ready || !range || !stickers || !scramble.trim()} onClick={() => { if (range) void analyze(range); }}>自動解析</button>
              </div>
            )}
          </details>
          {busy && <div className="video-panel-body video-run">
            <progress aria-label="動画解析の進み具合" max="1" value={progress} />
            <button onClick={() => task.current?.abort()}>解析を中止</button>
          </div>}
        </section>
        {result && !busy && (
          <section className="video-panel" aria-labelledby="video-split-title">
            <div className="video-panel-heading">
              <h2 id="video-split-title" ref={resultHeading} tabIndex={-1}>CFOP の推定結果</h2>
              {total !== null && <span>合計 <b className="video-time">{time(total)}</b> 秒</span>}
            </div>
            <div className="video-panel-body">
              {!result.trace
                ? <p role="status">開始時のステッカーがスクランブルと一致しませんでした。開始位置、3面の角、スクランブルを確認してください。</p>
                : <>
                  {finish === null && <div role="status">
                    <p>最後まで追跡できませんでした。確認できた区間のみ表示します。</p>
                    <button className="video-jump" onClick={() => jump(result.trace!.lastMatch)}>最後に認識した位置を確認</button>
                  </div>}
                  <table className="video-splits">
                    <thead><tr><th scope="col">ステップ</th><th scope="col">完了した動画時刻</th><th scope="col">実時間（秒）</th></tr></thead>
                    <tbody>{stages.map((label, index) => {
                      const mark = marks![index + 1];
                      return (
                        <tr key={label}>
                          <th scope="row">{label}</th>
                          <td>{mark === null ? "—" : <button className="video-jump video-time" onClick={() => jump(mark)} aria-label={`${label}の完了位置へ移動（${time(mark)}）`}>{time(mark)}</button>}</td>
                          <td className="video-time">{time(splits[index])}</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </>}
            </div>
          </section>
        )}
        {result && !busy && pauseRange && (
          <PauseResults range={pauseRange} candidates={candidates} slowdown={slowdown} incomplete={!!incomplete}
            sensitivity={sensitivity} minimum={minimum} seek={jump} setSensitivity={setSensitivity} setMinimum={setMinimum} />
        )}
        {result?.trace?.notation && finish !== null && !busy
          ? <details className="video-panel video-reconstruction">
            <summary>推定手順</summary>
            <div className="video-panel-body">
              <code>{result.trace.notation}</code>
              <Replay reconstruction={{ scramble: result.trace.setup, moves: result.trace.notation, solved: true }} />
            </div>
          </details>
          : <ManualReplay scramble={scramble} />}
      </div>
    </div>
  );
}

function GuideLines({ points, numbered = false }: { points: Point[]; numbered?: boolean }) {
  return (
    <svg className={numbered ? "video-guide-diagram" : "video-guide-lines"} viewBox="0 0 100 100" preserveAspectRatio={numbered ? "xMidYMid meet" : "none"} aria-hidden="true">
      {visibleFaces.map((face, index) => (
        face.every((corner) => points[corner]) && <polygon key={index} points={face.map((corner) => `${points[corner].x * 100},${points[corner].y * 100}`).join(" ")} />
      ))}
      {numbered && points.map(({ x, y }, index) => <text key={index} x={x * 100} y={y * 100}>{index + 1}</text>)}
    </svg>
  );
}

function CubeGuide({ points, active, onPoint }: { points: Point[]; active: boolean; onPoint: (point: Point) => void }) {
  const [cursor, setCursor] = useState({ x: .5, y: .5 });
  const target = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (active) target.current?.focus(); }, [active]);
  const next = corners[points.length];
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

function PauseResults({ range, candidates, slowdown, incomplete, sensitivity, minimum, seek, setSensitivity, setMinimum }: {
  range: Interval; candidates: Interval[]; slowdown: number; incomplete: boolean;
  sensitivity: number; minimum: number; seek: (seconds: number) => void;
  setSensitivity: (value: number) => void; setMinimum: (value: number) => void;
}) {
  return (
    <section className="video-panel video-pauses" aria-labelledby="video-pause-title">
      <div className="video-panel-heading">
        <h2 id="video-pause-title">停止候補</h2>
        <span>{candidates.length} 件・合計 <b className="video-time">{time(candidates.reduce((sum, pause) => sum + pause.end - pause.start, 0) / slowdown)}</b> 秒</span>
      </div>
      <div className="video-panel-body">
        {incomplete && <p className="muted">読み取れなかったフレームを含みます。</p>}
        {candidates.length > 0 && <>
          <div className="video-timeline" aria-hidden="true">
            {candidates.map((pause) => <span key={pause.start} style={{ left: `${(pause.start - range.start) / (range.end - range.start) * 100}%`, width: `${(pause.end - pause.start) / (range.end - range.start) * 100}%` }} />)}
          </div>
          <ul className="video-pause-list" aria-label="停止候補の時刻">
            {candidates.map((pause) => (
              <li key={pause.start}>
                <button onClick={() => seek(pause.start)}>
                  <Play size={13} aria-hidden="true" />
                  <span className="video-time">{time((pause.start - range.start) / slowdown)} – {time((pause.end - range.start) / slowdown)}</span>
                  <strong className="video-time">{time((pause.end - pause.start) / slowdown)} 秒</strong>
                </button>
              </li>
            ))}
          </ul>
        </>}
        <details>
          <summary>停止の検出設定</summary>
          <div className="video-detection-settings">
            <p className="muted">指定した3面の周辺を調べます。手やカメラの動きも検出に影響します。</p>
            <label>動きの判定
              <select value={sensitivity} onChange={(event) => setSensitivity(Number(event.currentTarget.value))}>
                <option value="1">小さな動きも検出</option>
                <option value="3">標準</option>
                <option value="7">大きな動きを検出</option>
              </select>
            </label>
            <label>停止の最短時間
              <select value={minimum} onChange={(event) => setMinimum(Number(event.currentTarget.value))}>
                <option value="0.1">0.10 秒</option>
                <option value="0.2">0.20 秒</option>
                <option value="0.35">0.35 秒</option>
                <option value="0.5">0.50 秒</option>
              </select>
            </label>
          </div>
        </details>
      </div>
    </section>
  );
}

function ManualReplay({ scramble }: { scramble: string }) {
  const [moves, setMoves] = useState("");
  const [reconstruction, setReconstruction] = useState<Reconstruction | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  useEffect(() => { setReconstruction(null); setError(""); }, [scramble]);
  async function verify() {
    setChecking(true);
    setError("");
    setReconstruction(null);
    try {
      setReconstruction(await reconstructSolve(scramble, moves));
    } catch (error) {
      setError(error instanceof Error ? error.message : "手順を確認できませんでした。");
    } finally {
      setChecking(false);
    }
  }

  return (
    <details className="video-panel video-reconstruction">
      <summary>手順を入力して確認</summary>
      <div className="video-panel-body">
        <label>解法手順
          <textarea rows={3} value={moves} spellCheck={false} disabled={checking} onChange={(event) => {
            setMoves(event.currentTarget.value);
            setReconstruction(null);
            setError("");
          }} placeholder="R U R' …" />
        </label>
        <button disabled={checking || !scramble.trim() || !moves.trim()} onClick={() => void verify()}>{checking ? "確認中…" : "手順を読み込む"}</button>
        {error && <p role="alert">{error}</p>}
        {reconstruction && <>
          <p role="status">{reconstruction.solved ? "入力した手順で全面が揃います。" : "入力した手順では全面が揃いません。"}</p>
          <Replay reconstruction={reconstruction} />
        </>}
      </div>
    </details>
  );
}

function Replay({ reconstruction }: { reconstruction: Reconstruction }) {
  const host = useRef<HTMLDivElement>(null);
  const { scramble, moves } = reconstruction;
  useEffect(() => {
    const cube = new TwistyPlayer({
      puzzle: "3x3x3",
      experimentalSetupAlg: scramble,
      alg: moves,
      visualization: "2D",
      background: "none",
      hintFacelets: "none",
    });
    host.current?.replaceChildren(cube);
    return () => cube.remove();
  }, [scramble, moves]);
  return <div className="video-replay" ref={host} aria-label="解法手順の再生" />;
}
