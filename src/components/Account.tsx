import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { cloud } from "../lib/cloud";
import { Cloud, LogOut, RefreshCw } from "lucide-react";
export function Account({
  user,
  recovery,
  doneRecovery,
  importGuest,
  sync,
  status,
}: {
  user: User | null;
  recovery: boolean;
  doneRecovery: () => void;
  importGuest: () => Promise<void>;
  sync: () => Promise<void>;
  status: string;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function task(fn: () => Promise<void>) {
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
  if (!cloud)
    return (
      <div className="account-empty">
        <Cloud size={36} />
        <h3>同期先がまだ設定されていません</h3>
        <p>
          現在の記録はこの端末に保存されます。Supabaseを接続すると、メールアドレスで登録して端末間で同期できます。
        </p>
        <p className="muted">
          管理者はREADMEの手順でDBを作成し、環境変数を設定してください。記録は設定画面からバックアップできます。
        </p>
      </div>
    );
  if (user && !recovery)
    return (
      <div className="stack">
        <p className="account-email">{user.email}</p>
        <p>{status}</p>
        <button onClick={() => void task(sync)} disabled={busy}>
          <RefreshCw size={16} />
          今すぐ同期
        </button>
        <button
          onClick={() =>
            void task(async () => {
              await importGuest();
              await sync();
              setMessage("この端末のゲスト記録を取り込みました。");
            })
          }
          disabled={busy}
        >
          ゲストの記録を取り込む
        </button>
        <p className="muted">
          ログイン前の記録は、自動ではアカウントに追加されません。
        </p>
        <button
          onClick={() =>
            void task(async () => {
              const { error } = await cloud!.auth.signOut();
              if (error) throw error;
            })
          }
          disabled={busy}
        >
          <LogOut size={16} />
          ログアウト
        </button>
        {message && <p role="status">{message}</p>}
      </div>
    );
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void task(async () => {
          if (recovery) {
            const { error } = await cloud!.auth.updateUser({ password });
            if (error) throw error;
            doneRecovery();
            setMessage("パスワードを変更しました。");
            return;
          }
          if (mode === "reset") {
            const { error } = await cloud!.auth.resetPasswordForEmail(email, {
              redirectTo: location.origin + import.meta.env.BASE_URL,
            });
            if (error) throw error;
            setMessage("登録済みのアドレスなら、再設定メールが届きます。");
            return;
          }
          const { error } =
            mode === "signup"
              ? await cloud!.auth.signUp({
                  email,
                  password,
                  options: {
                    emailRedirectTo: location.origin + import.meta.env.BASE_URL,
                  },
                })
              : await cloud!.auth.signInWithPassword({ email, password });
          if (error) throw error;
          if (mode === "signup")
            setMessage("確認メールのリンクを開いて登録を完了してください。");
        });
      }}
    >
      {!recovery && (
        <div className="segmented">
          <button
            type="button"
            className={mode === "login" ? "selected" : ""}
            onClick={() => setMode("login")}
          >
            ログイン
          </button>
          <button
            type="button"
            className={mode === "signup" ? "selected" : ""}
            onClick={() => setMode("signup")}
          >
            新規登録
          </button>
        </div>
      )}
      {!recovery && (
        <label>
          メールアドレス
          <input
            type="email"
            value={email}
            autoComplete="email"
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      )}
      {(mode !== "reset" || recovery) && (
        <label>
          {recovery ? "新しいパスワード" : "パスワード"}
          <input
            type="password"
            value={password}
            minLength={8}
            required
            autoComplete={
              mode === "signup" || recovery
                ? "new-password"
                : "current-password"
            }
            onChange={(e) => setPassword(e.target.value)}
          />
          <small>8文字以上</small>
        </label>
      )}
      <button className="primary" disabled={busy}>
        {busy
          ? "処理中…"
          : recovery
            ? "パスワードを変更"
            : mode === "signup"
              ? "アカウントを作成"
              : mode === "reset"
                ? "再設定メールを送信"
                : "ログイン"}
      </button>
      {!recovery && (
        <button
          type="button"
          className="text-button"
          onClick={() => setMode(mode === "reset" ? "login" : "reset")}
        >
          {mode === "reset" ? "ログインへ戻る" : "パスワードを忘れた場合"}
        </button>
      )}
      {message && (
        <p role="status" className="form-message">
          {message}
        </p>
      )}
    </form>
  );
}
