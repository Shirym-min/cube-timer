import { useState } from "react";
import { Cloud, LogOut, RefreshCw } from "lucide-react";
import { googleClientId, type DriveUser } from "../lib/cloud";

export function DriveSync({
  user,
  signIn,
  signOut,
  loaded,
  importGuest,
  sync,
  status,
  error,
}: {
  user: DriveUser | null;
  signIn: () => Promise<void>;
  signOut: () => void;
  loaded: boolean;
  importGuest: () => Promise<void>;
  sync: () => Promise<void>;
  status: string;
  error: string;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function task(fn: () => void | Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "処理に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  if (!googleClientId) return <p>Google Drive 同期は設定されていません。</p>;

  if (!user)
    return (
      <div className="stack">
        <button className="primary" onClick={() => void task(signIn)} disabled={busy}>
          <Cloud size={16} />
          {busy ? "ログイン中…" : "Google でログイン"}
        </button>
        {(message || error) && <p role="alert">{message || error}</p>}
      </div>
    );

  const syncing = status === "同期中";
  return (
    <div className="stack">
      <p className="account-email">{user.email || "Google Drive"}</p>
      <p role="status">{status}</p>
      <button className="primary" onClick={() => void task(sync)} disabled={busy || syncing || !loaded}>
        <RefreshCw size={16} />
        今すぐ同期
      </button>
      <button
        onClick={() => void task(async () => {
          await importGuest();
          setMessage("ログイン前の記録を取り込みました。「今すぐ同期」で Drive に保存できます。");
        })}
        disabled={busy || syncing || !loaded}
      >
        ゲストの記録を取り込む
      </button>
      <button onClick={() => void task(signOut)} disabled={busy || syncing}>
        <LogOut size={16} />
        接続を解除
      </button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
