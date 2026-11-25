import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { download, parseImport } from "../../lib/import";
import type { Operation, Settings as Preferences } from "../../lib/model";
export function Settings({
  value,
  save,
  ops,
  importOps,
}: {
  value: Preferences;
  save: (s: Preferences) => Promise<void>;
  ops: Operation[];
  importOps: (ops: Operation[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const set = <K extends keyof Preferences>(key: K, v: Preferences[K]) =>
    setDraft({ ...draft, [key]: v });
  return (
    <>
      <form
        className="settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await save(draft);
            setMessage("設定を保存しました。");
          } catch {
            setMessage("保存できません。もう一度試してください。");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>外観</h3>
        <div className="inline-fields">
          <label>
            テーマ
            <select
              aria-label="テーマ"
              value={draft.theme}
              onChange={(e) =>
                set("theme", e.target.value as Preferences["theme"])
              }
            >
              <option value="light">ライト</option>
              <option value="dark">ダーク</option>
              <option value="system">端末に合わせる</option>
            </select>
          </label>
          <label>
            アクセント
            <input
              type="color"
              value={draft.accent}
              onChange={(e) => set("accent", e.target.value)}
            />
          </label>
        </div>
        <label>
          小数点以下の桁数
          <select
            value={draft.precision}
            onChange={(e) => set("precision", Number(e.target.value) as 2 | 3)}
          >
            <option value="3">3桁</option>
            <option value="2">2桁</option>
          </select>
        </label>
        <h3>計測</h3>
        <div className="inline-fields">
          <label>
            開始までの長押し
            <select
              value={draft.hold}
              onChange={(e) => set("hold", Number(e.target.value))}
            >
              <option value="0">なし</option>
              <option value="300">0.3秒</option>
              <option value="550">0.55秒</option>
            </select>
          </label>
          <label>
            区間数
            <select
              value={draft.phases}
              onChange={(e) => set("phases", Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "区間なし" : `${n}区間`}
                </option>
              ))}
            </select>
          </label>
        </div>
        {(
          [
            ["inspection", "15秒インスペクション"],
            ["sound", "8秒・12秒の通知音"],
            ["hideRunning", "計測中のタイムを隠す"],
            ["showDiagram", "スクランブルの展開図"],
          ] as const
        ).map(([key, label]) => (
          <label className="toggle-row" key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={draft[key]}
              onChange={(e) => set(key, e.target.checked)}
            />
          </label>
        ))}
        <h3>クロスのヒント</h3>
        <div className="inline-fields">
          <label>
            対象の面
            <select
              aria-label="ヒントの対象面"
              value={draft.hintFace}
              onChange={(e) =>
                set("hintFace", e.target.value as Preferences["hintFace"])
              }
            >
              {(
                [
                  ["D", "D · 黄"],
                  ["U", "U · 白"],
                  ["F", "F · 緑"],
                  ["B", "B · 青"],
                  ["R", "R · 赤"],
                  ["L", "L · 橙"],
                ] as const
              ).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            種類
            <select
              aria-label="ヒントの種類"
              value={draft.hintType}
              onChange={(e) =>
                set("hintType", e.target.value as Preferences["hintType"])
              }
            >
              <option value="cross">クロス</option>
              <option value="xcross">X-cross</option>
            </select>
          </label>
        </div>
        <button className="primary" disabled={busy}>
          設定を保存
        </button>
      </form>
      <section className="backup">
        <h3>データ</h3>
        <div className="button-row">
          <button
            onClick={() =>
              download(
                `split-${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify({ format: "split-v1", operations: ops }),
              )
            }
          >
            <Download size={16} />
            バックアップ
          </button>
          <label className="file-button">
            <Upload size={16} />
            取り込む
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 30 * 1024 * 1024)
                    throw Error("30MB以下のファイルを選んでください。");
                  const imported = parseImport(await file.text());
                  await importOps(imported);
                  setMessage("記録を取り込みました。");
                } catch (err) {
                  setMessage(
                    err instanceof Error
                      ? err.message
                      : "取り込みに失敗しました。",
                  );
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="muted">
          SPLITとcsTimerのJSONに対応しています。既存の記録は残ります。
        </p>
      </section>
      {message && (
        <p role="status" className="form-message">
          {message}
        </p>
      )}
      <section className="backup">
        <h3>iPhoneに追加</h3>
        <p className="muted">
          Safariの共有メニューから「ホーム画面に追加」を選択してください。一度オンラインで開くと、オフラインでも計測できます。
        </p>
      </section>
    </>
  );
}
