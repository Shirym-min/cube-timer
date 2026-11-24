import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { auth } from "../lib/auth";
import { LogOut } from "lucide-react";
export function Account({
  user,
  recovery,
  doneRecovery,
  ready,
}: {
  user: User | null;
  recovery: boolean;
  doneRecovery: () => void;
  ready: boolean;
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
  const client = auth;
  if (!client) return <p>メールでのログインは設定されていません。</p>;
  if (!ready) return <p role="status">ログイン状態を確認しています…</p>;
  if (user && !recovery)
    return (
      <div className="stack">
        <p className="account-email">{user.email}</p>
        <button
          onClick={() =>
            void task(async () => {
              const { error } = await client.signOut();
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
            const { error } = await client.updateUser({ password });
            if (error) throw error;
            doneRecovery();
            setMessage("パスワードを変更しました。");
            return;
          }
          if (mode === "reset") {
            const { error } = await client.resetPasswordForEmail(email, {
              redirectTo: location.origin + import.meta.env.BASE_URL,
            });
            if (error) throw error;
            setMessage("登録済みのアドレスなら、再設定メールが届きます。");
            return;
          }
          const { error } =
            mode === "signup"
              ? await client.signUp({
                  email,
                  password,
                  options: {
                    emailRedirectTo: location.origin + import.meta.env.BASE_URL,
                  },
                })
              : await client.signInWithPassword({ email, password });
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
