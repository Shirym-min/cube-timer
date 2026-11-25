import { Play } from "lucide-react";
import { formatTime } from "../../lib/model";
import type { Interval } from "../../lib/solveVideo";

export const formatVideoTime = (seconds: number | null) => formatTime(seconds === null ? null : Math.round(seconds * 1000));

export function PauseResults({ range, candidates, slowdown, incomplete, sensitivity, minimum, seek, setSensitivity, setMinimum }: {
  range: Interval; candidates: Interval[]; slowdown: number; incomplete: boolean;
  sensitivity: number; minimum: number; seek: (seconds: number) => void;
  setSensitivity: (value: number) => void; setMinimum: (value: number) => void;
}) {
  return (
    <section className="video-panel video-pauses" aria-labelledby="video-pause-title">
      <div className="video-panel-heading">
        <h2 id="video-pause-title">停止候補</h2>
        <span>{candidates.length} 件・合計 <b className="video-time">{formatVideoTime(candidates.reduce((sum, pause) => sum + pause.end - pause.start, 0) / slowdown)}</b> 秒</span>
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
                  <span className="video-time">{formatVideoTime((pause.start - range.start) / slowdown)} – {formatVideoTime((pause.end - range.start) / slowdown)}</span>
                  <strong className="video-time">{formatVideoTime((pause.end - pause.start) / slowdown)} 秒</strong>
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
