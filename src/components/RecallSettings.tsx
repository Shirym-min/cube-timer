import { topColors, type TopColor } from "../lib/recallFaces";
import existingCases from "../data/recall-cases.json";
import extraCases from "../data/recall-extra-cases.json";

export const recallCases = { ...existingCases, ...extraCases };
type SetName = keyof typeof recallCases;
type View = "3d" | "top" | "net";
export type RecallSettings = {
  set: SetName;
  view: View;
  seconds: number;
  top: TopColor;
  sides: number;
  aufEnabled: boolean;
  grayUnneeded: boolean;
};
export const settingsKey = "split-recall-settings";
const defaults: RecallSettings = {
  set: "PLL",
  view: "3d",
  seconds: 5,
  top: "yellow",
  sides: 2,
  aufEnabled: false,
  grayUnneeded: false,
};
export function readSettings(): RecallSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) ?? "null") as
      | Partial<RecallSettings>
      | null;
    if (!saved) return defaults;
    const { set, view, seconds, top, sides, aufEnabled, grayUnneeded } = saved;
    return {
      set: set && Object.hasOwn(recallCases, set) ? set : defaults.set,
      view: view === "3d" || view === "top" || view === "net" ? view : defaults.view,
      seconds:
        typeof seconds === "number" && Number.isInteger(seconds) && seconds >= 1 && seconds <= 10
          ? seconds
          : defaults.seconds,
      top: top && topColors.some(([color]) => color === top) ? top : defaults.top,
      sides: sides === 2 || sides === 3 || sides === 4 ? sides : defaults.sides,
      aufEnabled: aufEnabled === true,
      grayUnneeded: grayUnneeded === true,
    };
  } catch {
    return defaults;
  }
}

export function RecallControls({ settings, updateSettings, changeAuf }: {
  settings: RecallSettings;
  updateSettings: (patch: Partial<RecallSettings>) => void;
  changeAuf: (enabled: boolean) => void;
}) {
  const { set, view, top, sides, grayUnneeded, aufEnabled, seconds } = settings;
  return (
    <div className="recall-controls">
      <label>
        パターン
        <select
          aria-label="パターン"
          value={set}
          onChange={(e) => updateSettings({ set: e.target.value as SetName })}
        >
          {Object.keys(recallCases).map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label>
        表示
        <select
          aria-label="表示"
          value={view}
          onChange={(e) => updateSettings({ view: e.target.value as View })}
        >
          <option value="3d">3D</option>
          <option value="top">上面</option>
          <option value="net">上面と側面</option>
        </select>
      </label>
      <label>
        上面の色
        <select
          aria-label="上面の色"
          value={top}
          onChange={(e) => updateSettings({ top: e.target.value as TopColor })}
        >
          {topColors.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {view === "net" && (
        <label>
          側面の数
          <select
            aria-label="側面の数"
            value={sides}
            onChange={(e) => updateSettings({ sides: Number(e.target.value) })}
          >
            <option value="2">2面</option>
            <option value="3">3面</option>
            <option value="4">4面</option>
          </select>
        </label>
      )}
      {view === "net" && (
        <label className="recall-mask-setting">
          <input
            type="checkbox"
            checked={grayUnneeded}
            onChange={(e) => updateSettings({ grayUnneeded: e.target.checked })}
          />
          <span>判別に不要な部分を灰色にする</span>
        </label>
      )}
      <label>
        AUF
        <select
          aria-label="AUF"
          value={aufEnabled ? "random" : "none"}
          onChange={(e) => changeAuf(e.target.value === "random")}
        >
          <option value="none">なし</option>
          <option value="random">ランダム</option>
        </select>
      </label>
      <label className="recall-interval">
        <span>切り替え間隔 <output>{seconds}秒</output></span>
        <input
          aria-label="切り替え間隔"
          aria-valuetext={`${seconds}秒`}
          type="range"
          min={1}
          max={10}
          step={1}
          value={seconds}
          onChange={(e) => updateSettings({ seconds: e.target.valueAsNumber })}
        />
      </label>
    </div>
  );
}
