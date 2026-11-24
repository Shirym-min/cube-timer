import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  authorizeDrive,
  DriveAuthorizationError,
  googleClientId,
  loadGoogle,
  syncOps,
  type DriveUser,
} from "./cloud";
import { readOps, writeOps } from "./db";
import { materialize, validOperation, type Operation } from "./model";

const accountKey = "split-drive-account";

function cachedUser(): DriveUser | null {
  if (!googleClientId) return null;
  try {
    const user = JSON.parse(localStorage.getItem(accountKey) ?? "null");
    return typeof user?.id === "string" && user.id && typeof user.email === "string"
      ? user
      : null;
  } catch {
    return null;
  }
}

export function useStore(accountId: string | undefined, authReady: boolean) {
  const [user, setUser] = useState(cachedUser),
    [ops, setOps] = useState<Operation[]>([]),
    [loadedScope, setLoadedScope] = useState<string>(),
    [error, setError] = useState(""),
    [syncStatus, setSyncStatus] = useState("同期待ち");
  const localAccount = accountId ?? "guest";
  const name = user ? `drive:${user.id}` : localAccount;
  const ready = !!user || authReady;
  const loaded = ready && loadedScope === name;
  const scope = useRef(name),
    opsRef = useRef(ops),
    busy = useRef(false),
    credentials = useRef<Awaited<ReturnType<typeof authorizeDrive>> | null>(null),
    channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (googleClientId) void loadGoogle().catch(() => {});
  }, []);
  const update = (next: Operation[]) => {
    opsRef.current = next;
    setOps(next);
  };
  const merge = (incoming: Operation[]) => {
    const m = new Map(opsRef.current.map((o) => [o.id, o]));
    incoming.forEach((o) => m.set(o.id, o));
    update([...m.values()]);
  };
  useEffect(() => {
    if (!ready) return;
    scope.current = name;
    setLoadedScope(undefined);
    update([]);
    setError("");
    setSyncStatus("同期待ち");
    let active = true;
    readOps(name)
      .then(async (data) => {
        if (!active) return;
        if (!data.length) {
          const now = 0,
            sid = "00000000-0000-4000-8000-000000000001";
          data = [
            {
              id: "00000000-0000-4000-8000-000000000002",
              entityId: sid,
              kind: "session",
              stamp: now,
              value: {
                id: sid,
                name: "メインセッション",
                event: "333",
                createdAt: now,
              },
            },
          ];
          await writeOps(name, data);
        }
        if (active && scope.current === name) {
          update(data);
          setLoadedScope(name);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "端末に保存できません。ブラウザのストレージ設定と空き容量を確認してください。",
          );
      });
    return () => {
      active = false;
    };
  }, [name, ready]);

  async function signIn() {
    await loadGoogle();
    const account = await authorizeDrive();
    localStorage.setItem(accountKey, JSON.stringify(account.user));
    credentials.current = account;
    scope.current = `drive:${account.user.id}`;
    setLoadedScope(undefined);
    setUser(account.user);
  }

  function signOut() {
    if (busy.current) return;
    localStorage.removeItem(accountKey);
    credentials.current = null;
    scope.current = localAccount;
    setLoadedScope(undefined);
    setUser(null);
  }

  const sync = useCallback(async () => {
    if (!user || !loaded || busy.current || scope.current !== name) return;
    busy.current = true;
    setSyncStatus("同期中");
    try {
      let account = credentials.current;
      if (!account || account.user.id !== user.id || account.token.expiresAt <= Date.now() + 30_000) {
        await loadGoogle();
        account = await authorizeDrive(user);
        credentials.current = account;
      }
      const all = await syncOps(account.token.value, await readOps(name));
      await writeOps(name, all);
      const current = await readOps(name);
      if (scope.current === name) {
        merge(current);
        const syncedIds = new Set(all.map((op) => op.id));
        setSyncStatus(
          opsRef.current.every((op) => syncedIds.has(op.id)) ? "同期済み" : "同期待ち",
        );
        setError("");
        channel.current?.postMessage(name);
      }
    } catch (e) {
      if (e instanceof DriveAuthorizationError) credentials.current = null;
      if (scope.current === name) {
        setSyncStatus("同期を再試行");
        setError(e instanceof Error ? e.message : "Google Drive と同期できませんでした。");
      }
    } finally {
      busy.current = false;
    }
  }, [user, loaded, name]);

  useEffect(() => {
    const c = new BroadcastChannel("split-storage");
    channel.current = c;
    c.onmessage = ({ data: name }: MessageEvent<string>) => {
      if (name !== scope.current) return;
      readOps(name)
        .then((data) => {
          if (scope.current === name) {
            const known = new Set(opsRef.current.map((op) => op.id));
            const changed = data.some((op) => !known.has(op.id));
            if (changed && !busy.current) setSyncStatus("同期待ち");
            merge(data);
          }
        })
        .catch(() => setError("別タブの記録を読み込めません。"));
    };
    return () => c.close();
  }, []);
  async function commit(
    kind: Operation["kind"],
    entityId: string,
    value: Operation["value"],
  ) {
    if (!loaded || scope.current !== name) throw Error("記録の読み込み中です。");
    const stamp = opsRef.current.reduce(
      (n, o) => Math.max(n, o.stamp + 1),
      Date.now(),
    );
    const op: Operation = {
      id: crypto.randomUUID(),
      entityId,
      kind,
      value,
      stamp,
    };
    if (!validOperation(op)) throw Error("入力内容を確認してください。");
    try {
      await writeOps(name, [op]);
      if (scope.current === name) {
        merge([op]);
        if (!busy.current) setSyncStatus("同期待ち");
      }
      channel.current?.postMessage(name);
    } catch (e) {
      setError(
        "記録を保存できません。空き容量を確認して、もう一度保存してください。",
      );
      throw e;
    }
  }
  async function importOps(incoming: Operation[]) {
    if (!incoming.every(validOperation))
      throw Error("読み込めないデータが含まれています。");
    if (!loaded || scope.current !== name) throw Error("記録の読み込み中です。");
    await writeOps(name, incoming);
    if (name === scope.current) {
      merge(incoming);
      if (!busy.current) setSyncStatus("同期待ち");
    }
    channel.current?.postMessage(name);
  }
  const state = useMemo(() => materialize(ops), [ops]);
  return {
    ...state,
    ops,
    driveUser: user,
    storageScope: name,
    loaded,
    error,
    setError,
    syncStatus,
    sync,
    commit,
    importOps,
    signIn,
    signOut,
    importGuest: async () => importOps(await readOps("guest")),
  };
}
